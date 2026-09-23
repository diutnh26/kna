import type { PrismaClient } from "@prisma/client";
import type { DocumentKind, DocumentSourceType } from "../lib/enums";

/**
 * Turns the published record into the passages the assistant may quote.
 *
 * One function, called by both the sync script and its test, so what gets
 * embedded is decided in exactly one place. Every rule about *what the
 * assistant is allowed to know* lives here and is therefore reviewable in
 * one sitting.
 *
 * Two of those rules are worth stating out loud:
 *
 *   Nothing unpublished is ever included. Every query below filters on the
 *   moderation status, and the sync deletes anything whose source is no
 *   longer in the returned set.
 *
 *   Prices are excluded from embedded text, though they stay in metadata.
 *   A number embedded into a vector cannot be corrected without
 *   re-embedding, and a stale price quoted confidently is the kind of
 *   wrong that costs a household a booking.
 */

export interface DraftDocument {
  sourceType: DocumentSourceType;
  sourceId: string;
  locale: "en" | "vi";
  kind: DocumentKind;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  href: string | null;
}

/** Identity of a document, for the reconciliation the sync performs. */
export function documentKey(d: {
  sourceType: string;
  sourceId: string;
  locale: string;
  kind: string;
}) {
  return `${d.sourceType}:${d.sourceId}:${d.locale}:${d.kind}`;
}

export async function buildCorpus(prisma: PrismaClient): Promise<DraftDocument[]> {
  const docs: DraftDocument[] = [];

  // ── Knowledge cards ────────────────────────────────────────────────
  //
  // The only source written *for* the assistant. Each card yields four
  // documents: the question in each language, matched against what
  // somebody asked to decide whether the approved answer can be returned
  // verbatim; and the question-plus-answer in each language, retrieved as
  // evidence when no card matches closely enough for that.
  const cards = await prisma.knowledgeCard.findMany({
    where: { moderationStatus: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  for (const card of cards) {
    const langs = [
      { locale: "en" as const, question: card.question, answer: card.answer },
      { locale: "vi" as const, question: card.questionVi, answer: card.answerVi },
    ];

    for (const { locale, question, answer } of langs) {
      const metadata = {
        topic: card.topic,
        attributedTo: card.attributedTo,
        // Carried so the verbatim tier can return the approved text
        // without a second database round trip.
        answer,
      };

      docs.push({
        sourceType: "KnowledgeCard",
        sourceId: card.id,
        locale,
        kind: "QUESTION",
        title: question,
        content: question,
        metadata,
        href: card.href,
      });

      docs.push({
        sourceType: "KnowledgeCard",
        sourceId: card.id,
        locale,
        kind: "PASSAGE",
        title: question,
        content: `${question}\n\n${answer}`,
        metadata,
        href: card.href,
      });
    }
  }

  // ── Archive entries that actually carry prose ──────────────────────
  //
  // Most do not, and that is not a defect: an ArchiveEntry indexes media —
  // a 14-minute recording, a 40-frame photo essay — and `meta` is its
  // caption. Embedding "Narrated by Amí H'Bia · 14 min" would put a
  // library spine label into the knowledge base, where it would match
  // questions it cannot answer.
  //
  // So entries join the corpus only once they have a body. When the media
  // pipeline lands and transcripts start filling that column, they flow in
  // here with no change to this file.
  const entries = await prisma.archiveEntry.findMany({
    where: { moderationStatus: "PUBLISHED", body: { not: null } },
  });

  for (const entry of entries) {
    const body = entry.body?.trim();
    if (!body) continue;

    const metadata = {
      type: entry.type,
      pillar: entry.pillar,
      keeperBuon: entry.keeperBuon,
    };

    // The archive is stored in one language. Emitting it under both
    // locales lets a Vietnamese question retrieve it — bge-m3 is
    // cross-lingual, so this works — while the answer is still written in
    // the reader's language by the model. Machine-translating the entry
    // itself is not on the table: it is elder testimony that a Committee
    // approved in the words it was approved in.
    for (const locale of ["en", "vi"] as const) {
      docs.push({
        sourceType: "ArchiveEntry",
        sourceId: entry.id,
        locale,
        kind: "PASSAGE",
        title: entry.title,
        content: `${entry.title}\n${entry.meta}\nKept by ${entry.keeperBuon}.\n\n${body}`,
        metadata,
        href: "#explore",
      });
    }
  }

  // ── Phrasebook ─────────────────────────────────────────────────────
  //
  // The Committee ruled in April 2026 that everyday speech is publishable
  // and ceremonial or clan-specific speech is not. That ruling is enforced
  // by the moderation status, so this query inherits it.
  const phrases = await prisma.phrase.findMany({
    where: { moderationStatus: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  for (const phrase of phrases) {
    const metadata = { ede: phrase.ede, en: phrase.en, note: phrase.note };

    docs.push({
      sourceType: "Phrase",
      sourceId: phrase.id,
      locale: "en",
      kind: "PASSAGE",
      title: `Ê Đê phrase: ${phrase.ede}`,
      content: `Ê Đê: "${phrase.ede}" means "${phrase.en}". When to use it: ${phrase.note}.`,
      metadata,
      href: "#explore",
    });

    // The gloss stays in the language the Committee approved it in. The
    // frame around it is Vietnamese so a Vietnamese question finds it.
    docs.push({
      sourceType: "Phrase",
      sourceId: phrase.id,
      locale: "vi",
      kind: "PASSAGE",
      title: `Từ tiếng Ê Đê: ${phrase.ede}`,
      content:
        `Tiếng Ê Đê: "${phrase.ede}" — nghĩa là "${phrase.en}". ` +
        `Ngữ cảnh dùng: ${phrase.note}.`,
      metadata,
      href: "#explore",
    });
  }

  // ── What is on offer ───────────────────────────────────────────────
  //
  // `customs` is the reason listings are in here at all. Guardrail two
  // says the assistant never speaks for a household, so when someone asks
  // what the rules are somewhere, the answer has to be *that household's*
  // rule, quoted, rather than a generalisation about Ê Đê homes.
  const listings = await prisma.listing.findMany({
    where: { published: true },
    include: { provider: true },
  });

  for (const listing of listings) {
    const metadata = {
      category: listing.category,
      // Kept out of `content`, in metadata: a price embedded into a vector
      // cannot be corrected without re-embedding, and the live figure is
      // one join away whenever it is actually needed.
      priceVnd: listing.priceVnd,
      unit: listing.unit,
      provider: listing.provider.displayName,
      buon: listing.provider.buon,
    };

    const shared =
      `Host: ${listing.provider.displayName}, ${listing.provider.buon}.\n` +
      `${listing.blurb}\n` +
      `Duration: ${listing.duration}. Group size: ${listing.groupSize}. ` +
      `Carbon rating: ${listing.carbonRating}.\n` +
      `House rules from this household: ${listing.customs || "none recorded"}.`;

    docs.push({
      sourceType: "Listing",
      sourceId: listing.id,
      locale: "en",
      kind: "PASSAGE",
      title: listing.title,
      content: `${listing.title}\n${shared}`,
      metadata,
      href: "#travel",
    });

    docs.push({
      sourceType: "Listing",
      sourceId: listing.id,
      locale: "vi",
      kind: "PASSAGE",
      title: listing.title,
      content:
        `Trải nghiệm: ${listing.title}\n` +
        `Chủ nhà: ${listing.provider.displayName}, ${listing.provider.buon}.\n` +
        `${listing.blurb}\n` +
        `Thời lượng: ${listing.duration}. Số khách: ${listing.groupSize}.\n` +
        `Quy định của hộ gia đình này: ${listing.customs || "chưa ghi nhận"}.`,
      metadata,
      href: "#travel",
    });
  }

  // ── Marketplace products ───────────────────────────────────────────
  //
  // Same reasoning as listings: when someone asks about the gùi basket or
  // the brass wrist rings, the answer should be the maker's own note,
  // quoted. Prices stay in metadata for the same reason listing prices do
  // — a number in a vector cannot be corrected without re-embedding.
  const products = await prisma.product.findMany({
    where: { published: true },
    include: { provider: true },
  });

  for (const product of products) {
    const metadata = {
      category: product.category,
      priceVnd: product.priceVnd,
      stock: product.stock,
      provider: product.provider.displayName,
      buon: product.provider.buon,
    };

    docs.push({
      sourceType: "Product",
      sourceId: product.id,
      locale: "en",
      kind: "PASSAGE",
      title: product.title,
      content:
        `Marketplace product: ${product.title}\n` +
        `Made by ${product.provider.displayName}, ${product.provider.buon}. ` +
        `Category: ${product.category}.\n${product.note}`,
      metadata,
      href: "#marketplace",
    });

    docs.push({
      sourceType: "Product",
      sourceId: product.id,
      locale: "vi",
      kind: "PASSAGE",
      title: product.title,
      content:
        `Sản phẩm thủ công trên chợ KNĂ: ${product.title}\n` +
        `Nghệ nhân: ${product.provider.displayName}, ${product.provider.buon}. ` +
        `Nhóm hàng: ${product.category}.\n${product.note}`,
      metadata,
      href: "#marketplace",
    });
  }

  // ── Governance ─────────────────────────────────────────────────────
  //
  // The Community screen's whole argument is that the record is public:
  // who sits on the Committee, what it decided (including refusals), and
  // where every đồng of the fund went. Public on screen means answerable
  // in chat. Emitted under both locales, the ArchiveEntry precedent —
  // the embeddings are cross-lingual, and the answer is written in the
  // reader's language by the model.
  //
  // Fund amounts ARE embedded, unlike prices: an allocation is a
  // historical record that never changes, so it cannot go stale.
  const committee = await prisma.committeeMember.findMany({
    orderBy: { sortOrder: "asc" },
    include: { user: true },
  });
  if (committee.length > 0) {
    const lines = committee.map(
      (m) => `${m.user.fullName} — ${m.role} (${m.buon}, since ${m.since})`
    );
    for (const locale of ["en", "vi"] as const) {
      docs.push({
        sourceType: "Governance",
        sourceId: "committee",
        locale,
        kind: "PASSAGE",
        title:
          locale === "vi"
            ? "Hội đồng Quản trị Cộng đồng — thành viên"
            : "The Community Governance Committee — members",
        content:
          "The Community Governance Committee (Hội đồng Quản trị Cộng đồng) governs " +
          "what KNĂ publishes and how the Community Fund is spent. Its members:\n" +
          lines.join("\n"),
        metadata: { members: committee.length },
        href: "#community",
      });
    }
  }

  const decisions = await prisma.committeeDecision.findMany({ orderBy: { date: "desc" } });
  for (const decision of decisions) {
    for (const locale of ["en", "vi"] as const) {
      docs.push({
        sourceType: "Governance",
        sourceId: `decision:${decision.id}`,
        locale,
        kind: "PASSAGE",
        title: decision.title,
        content:
          `Committee decision: ${decision.title}\n` +
          `Status: ${decision.status}. Proposed by ${decision.fromLabel}, ` +
          `${decision.date.toISOString().slice(0, 10)}.\n${decision.note}`,
        metadata: { status: decision.status, date: decision.date.toISOString().slice(0, 10) },
        href: "#community",
      });
    }
  }

  const fundEntries = await prisma.communityFundEntry.findMany();
  const byQuarter = new Map<string, typeof fundEntries>();
  for (const entry of fundEntries) {
    byQuarter.set(entry.quarter, [...(byQuarter.get(entry.quarter) ?? []), entry]);
  }
  for (const [quarter, entries] of byQuarter) {
    const total = entries.reduce((sum, e) => sum + e.amountVnd, 0);
    const lines = entries.map(
      (e) => `${e.what} — ${e.amountVnd.toLocaleString("vi-VN")} ₫ → ${e.toBuon}`
    );
    for (const locale of ["en", "vi"] as const) {
      docs.push({
        sourceType: "Governance",
        sourceId: `fund:${quarter}`,
        locale,
        kind: "PASSAGE",
        title:
          locale === "vi"
            ? `Quỹ Cộng đồng — chi tiêu ${quarter}`
            : `Community Fund — allocations ${quarter}`,
        content:
          `Community Fund (Quỹ Cộng đồng) allocations for ${quarter}, ` +
          `total ${total.toLocaleString("vi-VN")} ₫:\n` +
          lines.join("\n"),
        metadata: { quarter, totalVnd: total },
        href: "#community",
      });
    }
  }

  // Reference documents (the PDFs and DOCX in apps/api/data) and the
  // website's own locale-file prose deliberately do NOT live here: this
  // function is the reviewable list of what the *database record*
  // contributes. File ingestion is src/ai/documents.ts and
  // src/ai/siteContent.ts; the sync concatenates all three.
  return docs;
}
