import "dotenv/config";
import { assistantGraph } from "../ai/graph";

/** End-to-end ask: prints tier, answer and cited sources for one question. */
async function ask(question: string, locale: "en" | "vi") {
  const tid = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const config = { configurable: { thread_id: tid }, recursionLimit: 25 };
  await assistantGraph.invoke({ question, locale }, config);
  const snapshot = await assistantGraph.getState({ configurable: { thread_id: tid } });
  const s = snapshot.values as {
    tier?: string;
    answer?: string;
    refusalReason?: string | null;
    degraded?: boolean;
    draft?: string;
    evidence?: Array<{ title: string; sourceType: string }>;
  };
  console.log(`\n=== ${question}`);
  console.log(`tier: ${s.tier} refusal: ${s.refusalReason ?? "-"} evidence: ${s.evidence?.length ?? 0} degraded: ${s.degraded ?? "-"}`);
  if (s.draft) console.log(`draft: ${s.draft.slice(0, 400)}`);
  console.log(`answer: ${(s.answer ?? "").slice(0, 600)}`);
  console.log(
    `sources: ${(s.evidence ?? []).map((e) => `[${e.sourceType}] ${e.title}`).join(" | ")}`
  );
}

async function main() {
  await ask("KNĂ có tour lặn biển không?", "vi");
  await ask("Sản phẩm nào đang còn hàng, giá bao nhiêu?", "vi");
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
