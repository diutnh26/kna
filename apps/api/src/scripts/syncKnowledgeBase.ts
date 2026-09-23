import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AI } from "../ai/config";
import { buildCorpus, documentKey } from "../ai/corpus";
import { buildReferenceCorpus } from "../ai/documents";
import { buildSiteCorpus } from "../ai/siteContent";
import { embedDocuments } from "../ai/llm";
import { packEmbedding } from "../ai/vector";

/**
 * Rebuilds the assistant's knowledge base from the published record.
 *
 *   npm run ai:sync --workspace apps/api
 *
 * Run it after seeding, and after the Committee publishes or withdraws
 * anything. It is idempotent and cheap to re-run: unchanged documents are
 * recognised by content and skipped, so only new or edited passages pay
 * for an embedding.
 *
 * The step that matters most is the one that deletes. Everything in
 * KnowledgeDocument that no longer corresponds to a published source is
 * removed — which is what makes a Committee withdrawal actually withdraw.
 * A version of this script that only ever inserted would leave a rejected
 * entry retrievable forever, silently overriding the moderation the whole
 * platform is built around.
 */

/**
 * Exported for the test suite, which injects a fake `embed` so the
 * reconciliation logic is provable without a GPU in CI. The CLI entry at
 * the bottom passes the real one.
 */
export async function sync(
  prisma: PrismaClient,
  embed: (texts: string[]) => Promise<number[][]> = embedDocuments
) {
  const backend = AI.provider === "gemini" ? "the Gemini API" : AI.ollamaUrl;
  console.log(`Embedding model: ${AI.embedModel} (${AI.embedDimensions} dims) via ${backend}`);

  const published = await buildCorpus(prisma);
  console.log(`Published corpus: ${published.length} documents.`);

  // The data/ folder — project reference PDFs and DOCX, chunked. Same
  // reconciliation as everything else: delete the file, re-run the sync,
  // and its passages stop existing.
  const reference = await buildReferenceCorpus();
  if (reference.length > 0) {
    console.log(`Reference documents (data/): ${reference.length} passages.`);
  }

  // The website's own prose (landing, explore, carbon…), per locale.
  const site = await buildSiteCorpus();
  if (site.length > 0) {
    console.log(`Site content (locale files): ${site.length} passages.`);
  }

  const drafts = [...published, ...reference, ...site];

  const existing = await prisma.knowledgeDocument.findMany({
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      locale: true,
      kind: true,
      content: true,
      model: true,
      dim: true,
    },
  });
  const byKey = new Map(existing.map((doc) => [documentKey(doc), doc]));

  // ── Reconcile: delete what is no longer published ──────────────────
  const wantedKeys = new Set(drafts.map(documentKey));
  const orphans = existing.filter((doc) => !wantedKeys.has(documentKey(doc)));
  if (orphans.length > 0) {
    await prisma.knowledgeDocument.deleteMany({
      where: { id: { in: orphans.map((o) => o.id) } },
    });
    console.log(`Removed ${orphans.length} document(s) whose source is no longer published.`);
  }

  // ── Embed what is new or changed ───────────────────────────────────
  const stale = drafts.filter((draft) => {
    const current = byKey.get(documentKey(draft));
    return (
      !current ||
      current.content !== draft.content ||
      current.model !== AI.embedModel ||
      current.dim !== AI.embedDimensions
    );
  });
  console.log(`${stale.length} to embed, ${drafts.length - stale.length} unchanged.`);

  // Small batches: each one is a round trip to a GPU that is also serving
  // live questions, and progress that prints beats progress that hangs.
  //
  // The cache is for documents emitted under both locales with identical
  // content (archive entries, reference chunks): the same text embeds to
  // the same vector, so it is embedded once and reused.
  const vectorByContent = new Map<string, number[]>();
  const BATCH = 8;
  for (let i = 0; i < stale.length; i += BATCH) {
    const batch = stale.slice(i, i + BATCH);
    const unseen = [...new Set(batch.map((d) => d.content))].filter(
      (content) => !vectorByContent.has(content)
    );
    if (unseen.length > 0) {
      // The Gemini batch endpoint intermittently returns an empty vector
      // for one item under sustained load, which surfaces as a dimension
      // error. One item re-tried in isolation embeds fine, so retry the
      // batch with a pause before giving up on the run.
      let vectors: number[][] | undefined;
      for (let attempt = 1; ; attempt++) {
        try {
          vectors = await embed(unseen);
          break;
        } catch (err) {
          if (attempt >= 4) throw err;
          const waitMs = attempt * 3_000;
          console.log(`  retrying batch after error (${(err as Error).message.slice(0, 80)}), waiting ${waitMs / 1000}s…`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
      unseen.forEach((content, k) => vectorByContent.set(content, vectors![k]));
    }

    for (let j = 0; j < batch.length; j++) {
      const draft = batch[j];
      const embedding = packEmbedding(vectorByContent.get(draft.content)!);
      await prisma.knowledgeDocument.upsert({
        where: {
          sourceType_sourceId_locale_kind: {
            sourceType: draft.sourceType,
            sourceId: draft.sourceId,
            locale: draft.locale,
            kind: draft.kind,
          },
        },
        create: {
          sourceType: draft.sourceType,
          sourceId: draft.sourceId,
          locale: draft.locale,
          kind: draft.kind,
          title: draft.title,
          content: draft.content,
          metadata: draft.metadata as object,
          href: draft.href,
          embedding,
          model: AI.embedModel,
          dim: AI.embedDimensions,
        },
        update: {
          title: draft.title,
          content: draft.content,
          metadata: draft.metadata as object,
          href: draft.href,
          embedding,
          model: AI.embedModel,
          dim: AI.embedDimensions,
        },
      });
    }
    console.log(`  ${Math.min(i + BATCH, stale.length)}/${stale.length}`);
  }

  const total = await prisma.knowledgeDocument.count();
  console.log(`Done. Knowledge base holds ${total} documents.`);
}

// CLI entry — guarded so the test suite can import `sync` without running it.
if (require.main === module) {
  const prisma = new PrismaClient();
  sync(prisma)
    .catch((err) => {
      console.error("Sync failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
