import "dotenv/config";
import { embedQuery } from "../ai/llm";
import { scoreAll } from "../ai/retrieval";
import { AI } from "../ai/config";

async function main() {
  const questions = [
    "KNĂ có cho thuê xe máy không?",
    "Thuê xe máy ở Buôn Ma Thuột giá bao nhiêu?",
  ];
  for (const q of questions) {
    const vec = new Float32Array(await embedQuery(q));
    const matches = (await scoreAll(q, "vi", vec)).slice(0, 5);
    console.log(`\n=== ${q}  (threshold ${AI.evidenceThreshold})`);
    for (const m of matches) {
      console.log(
        `  ${m.score.toFixed(3)} (v=${m.vectorScore.toFixed(3)} l=${m.lexicalScore.toFixed(3)}) [${m.document.sourceType}] ${m.document.title.slice(0, 70)}`
      );
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
