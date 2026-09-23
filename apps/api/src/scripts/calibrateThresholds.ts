import "dotenv/config";
import { AI } from "../ai/config";
import { embedQuery } from "../ai/llm";
import { scoreAll } from "../ai/retrieval";

/**
 * Prints what the corpus actually scores for a set of questions, so the
 * two thresholds in src/ai/config.ts are chosen from evidence.
 *
 *   npm run ai:calibrate --workspace apps/api
 *   npm run ai:calibrate --workspace apps/api -- "your own question" vi
 *
 * Read it like this: the ON-topic questions should score clearly above
 * AI_EVIDENCE_THRESHOLD and their exact card phrasings near or above
 * AI_CURATED_THRESHOLD; the OFF-topic ones must all land below the
 * evidence threshold, because everything below it is (rightly) declined.
 * If the two groups overlap, the corpus needs better cards more than the
 * thresholds need moving.
 */

const DEFAULTS: Array<[string, "en" | "vi"]> = [
  // Should be answerable.
  ["How do I greet an elder?", "en"],
  ["What can I photograph in the village?", "en"],
  ["Cồng Chiêng là gì?", "vi"],
  ["Tôi nên chào người lớn tuổi thế nào?", "vi"],
  ["cach chao hoi nguoi gia o buon lang", "vi"],
  // Must be declined.
  ["What is the capital of France?", "en"],
  ["Viết giúp tôi một bài thơ về mùa thu", "vi"],
  ["How do I fix a TypeScript error?", "en"],
];

async function main() {
  const args = process.argv.slice(2);
  const probes: Array<[string, "en" | "vi"]> =
    args.length > 0 ? [[args[0], (args[1] as "en" | "vi") ?? "en"]] : DEFAULTS;

  console.log(
    `model=${AI.embedModel}  curated≥${AI.curatedThreshold}  evidence≥${AI.evidenceThreshold}\n`
  );

  for (const [question, locale] of probes) {
    const vector = Float32Array.from(await embedQuery(question));
    const matches = (await scoreAll(question, locale, vector)).slice(0, 5);

    console.log(`Q (${locale}): ${question}`);
    if (matches.length === 0) {
      console.log("  corpus is empty — run ai:sync first\n");
      continue;
    }
    for (const m of matches) {
      console.log(
        `  ${m.score.toFixed(3)}  (vec ${m.vectorScore.toFixed(3)} · lex ${m.lexicalScore.toFixed(3)})` +
          `  ${m.document.kind.padEnd(8)} ${m.document.sourceType.padEnd(13)} ${m.document.title.slice(0, 60)}`
      );
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
