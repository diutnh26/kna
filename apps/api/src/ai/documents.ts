import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { AI } from "./config";
import type { DraftDocument } from "./corpus";

/**
 * Reference documents: the PDF and DOCX files in `apps/api/data`.
 *
 * These are the project's own background material — ethnographic notes on
 * the Ê Đê, the NEXUS competition reports and forms — dropped into a
 * folder rather than authored through the moderation queue. They enter the
 * corpus as `ReferenceDocument` passages so tier B can quote them, and
 * they are labelled as project reference material in the prompt so the
 * model never presents them as elder testimony.
 *
 * The trade-off is stated plainly: unlike every other source, nothing here
 * passed the Committee. Whoever puts a file in `data/` is publishing it to
 * the assistant. Removing the file and re-running the sync withdraws it —
 * the same reconciliation that enforces Committee withdrawals.
 *
 * Extraction is text-layer only. A scanned PDF with no text layer yields
 * nothing and is skipped with a warning, not OCR'd.
 */

/** Chunk sizing, in characters. ~1,400 chars ≈ a few paragraphs: small
 * enough that a retrieved chunk is about one thing, large enough that the
 * model has context to quote from. */
const TARGET_CHUNK_CHARS = 1400;
const MAX_PIECE_CHARS = 2000;
/** Fragments shorter than this (a page number, a lone heading) are noise. */
const MIN_CHUNK_CHARS = 80;

function cleanText(raw: string): string {
  return raw
    // PDF extraction leaves control characters and the occasional unpaired
    // surrogate behind; either can make an embedding API return an empty
    // vector for the whole passage.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits an over-long paragraph on sentence ends, hard-slicing any
 * sentence that is itself longer than the cap (tables flattened to one
 * line do this). */
function splitLongParagraph(paragraph: string): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const sentence of paragraph.split(/(?<=[.!?…:])\s+/)) {
    for (
      let start = 0;
      start < sentence.length;
      start += MAX_PIECE_CHARS
    ) {
      const part = sentence.slice(start, start + MAX_PIECE_CHARS);
      if (current && current.length + part.length + 1 > MAX_PIECE_CHARS) {
        pieces.push(current);
        current = part;
      } else {
        current = current ? `${current} ${part}` : part;
      }
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const pieces =
      paragraph.length > MAX_PIECE_CHARS ? splitLongParagraph(paragraph) : [paragraph];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > TARGET_CHUNK_CHARS) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);

  return chunks.filter((chunk) => chunk.length >= MIN_CHUNK_CHARS);
}

async function extractText(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === ".pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();
      return cleanText(parsed.text ?? "");
    } finally {
      await parser.destroy();
    }
  }
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return cleanText(value ?? "");
  }
  if (ext === ".md" || ext === ".txt") {
    // Plain text is the cheapest way to hand the assistant new knowledge:
    // drop a file in data/, run ai:sync, done.
    return cleanText(buffer.toString("utf8"));
  }
  return null; // .doc, images, anything else: not handled, deliberately.
}

/**
 * The reference corpus, or [] when the folder is absent or disabled
 * (AI_REFERENCE_DIR="" — which is what the test suite sets, so its exact
 * document counts stay about the database, not this machine's files).
 *
 * Each chunk is emitted under both locales with the same content, the
 * ArchiveEntry precedent: the embedding models are cross-lingual, so a
 * Vietnamese question retrieves a Vietnamese source stored once, and the
 * sync's content-level cache means the identical text is embedded once,
 * not twice.
 */
export async function buildReferenceCorpus(): Promise<DraftDocument[]> {
  if (!AI.referenceDir) return [];

  let names: string[];
  try {
    names = await fs.readdir(AI.referenceDir);
  } catch {
    return []; // No data/ folder is a fine state, not an error.
  }

  const docs: DraftDocument[] = [];

  // The same document exported twice (X.docx and X.pdf) must not enter the
  // corpus twice: duplicate passages masquerade as corroborating sources
  // and crowd the top-K. Prefer the DOCX — its text layer is authoritative.
  const lowered = new Set(names.map((n) => n.toLowerCase()));
  const isDuplicatePdf = (name: string) =>
    name.toLowerCase().endsWith(".pdf") &&
    lowered.has(name.toLowerCase().replace(/\.pdf$/, ".docx"));

  for (const name of names.sort()) {
    const ext = path.extname(name).toLowerCase();
    if (![".pdf", ".docx", ".md", ".txt"].includes(ext)) continue;
    if (isDuplicatePdf(name)) {
      console.log(`  (skipping ${name} — same document exists as .docx)`);
      continue;
    }

    let text: string | null;
    try {
      text = await extractText(path.join(AI.referenceDir, name));
    } catch (err) {
      console.warn(`  ! Could not read ${name}: ${(err as Error).message}`);
      continue;
    }
    if (!text || text.length < MIN_CHUNK_CHARS) {
      console.warn(`  ! ${name} has no extractable text (scanned images?) — skipped.`);
      continue;
    }

    const title = path.basename(name, ext).replace(/[-_]+/g, " ").trim();
    const chunks = chunkText(text);

    chunks.forEach((content, i) => {
      const metadata = {
        file: name,
        part: i + 1,
        parts: chunks.length,
        attributedTo: "Tài liệu tham khảo của dự án",
      };
      for (const locale of ["en", "vi"] as const) {
        docs.push({
          sourceType: "ReferenceDocument",
          sourceId: `${name}#${i}`,
          locale,
          kind: "PASSAGE",
          title: chunks.length > 1 ? `${title} (phần ${i + 1}/${chunks.length})` : title,
          content,
          metadata,
          href: null,
        });
      }
    });
  }

  return docs;
}
