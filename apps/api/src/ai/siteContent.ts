import fs from "node:fs/promises";
import path from "node:path";
import { AI } from "./config";
import { chunkText } from "./documents";
import type { DraftDocument } from "./corpus";

/**
 * The website's own words, from the frontend locale files.
 *
 * Every screen of the app — the landing page's pitch, the Explore page's
 * introduction to Đắk Lắk and the three buôn, the Carbon Journey
 * explainer — is prose somebody wrote and reviewed, and it answers
 * exactly the questions visitors ask the assistant ("Đắk Lắk nằm ở
 * đâu?"). It lives in apps/web/src/i18n/locales/{en,vi}.json, so this
 * module reads those files at sync time and emits each content-bearing
 * section as SiteContent passages, per locale — en.json under "en",
 * vi.json under "vi", never crossed.
 *
 * Gated on AI.referenceDir like the data/ ingestion: the test suite sets
 * AI_REFERENCE_DIR="" to keep its document counts about the database, and
 * that switch means "no file ingestion" as a whole.
 */

/** Sections that carry prose worth knowing, with a display title and the
 * screen their content lives on. Everything else (nav, buttons, form
 * labels, error strings) is UI chrome, not knowledge. */
const SECTIONS: Array<{ key: string; titleEn: string; titleVi: string; href: string }> = [
  { key: "landing", titleEn: "KNĂ — about the platform", titleVi: "KNĂ — giới thiệu nền tảng", href: "#home" },
  { key: "explore", titleEn: "Explore — Đắk Lắk and the buôn", titleVi: "Khám phá — Đắk Lắk và các buôn", href: "#explore" },
  { key: "travel", titleEn: "Travel — how visiting works", titleVi: "Du lịch — cách đặt trải nghiệm", href: "#travel" },
  { key: "marketplace", titleEn: "Marketplace — how buying works", titleVi: "Chợ — cách mua sản phẩm", href: "#marketplace" },
  { key: "community", titleEn: "Community — governance and the fund", titleVi: "Cộng đồng — quản trị và quỹ", href: "#community" },
  { key: "carbon", titleEn: "Carbon Journey", titleVi: "Hành trình Carbon", href: "#carbon" },
];

/** Leaf strings shorter than this are labels ("Đặt chỗ", "Xem thêm"), not prose. */
const MIN_PROSE_CHARS = 40;

function collectProse(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    if (node.trim().length >= MIN_PROSE_CHARS) out.push(node.trim());
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectProse(item, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectProse(value, out);
  }
}

export async function buildSiteCorpus(): Promise<DraftDocument[]> {
  if (!AI.referenceDir) return [];

  const localesDir = path.join(__dirname, "..", "..", "..", "web", "src", "i18n", "locales");
  const docs: DraftDocument[] = [];

  for (const locale of ["en", "vi"] as const) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(await fs.readFile(path.join(localesDir, `${locale}.json`), "utf8"));
    } catch {
      continue; // The web app not being checked out next to the API is survivable.
    }

    for (const section of SECTIONS) {
      const prose: string[] = [];
      collectProse(parsed[section.key], prose);
      if (prose.length === 0) continue;

      const title = locale === "vi" ? section.titleVi : section.titleEn;
      const chunks = chunkText(prose.join("\n\n"));

      chunks.forEach((content, i) => {
        docs.push({
          sourceType: "SiteContent",
          sourceId: `${section.key}#${i}`,
          locale,
          kind: "PASSAGE",
          title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
          content: `${title}\n\n${content}`,
          metadata: { section: section.key },
          href: section.href,
        });
      });
    }
  }

  return docs;
}
