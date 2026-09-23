import "dotenv/config";
import { assistantGraph } from "../ai/graph";

async function main() {
  const tid = "probe-draft-" + Date.now();
  const events = assistantGraph.streamEvents(
    { question: "Which homestays can I book and what do they cost per night?", locale: "en" },
    { version: "v2", configurable: { thread_id: tid }, recursionLimit: 25 }
  );
  let byNode: Record<string, string> = {};
  for await (const ev of events) {
    if (ev.event === "on_chat_model_stream") {
      const node = (ev.metadata as any)?.langgraph_node ?? "?";
      const c = (ev.data as any)?.chunk?.content;
      const t = typeof c === "string" ? c : Array.isArray(c) ? c.map((p: any) => p?.text ?? "").join("") : "";
      byNode[node] = (byNode[node] ?? "") + t;
    }
  }
  for (const [node, text] of Object.entries(byNode)) {
    console.log(`--- ${node} ---\n${text}\n`);
  }
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
