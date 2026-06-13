import { createProvider, AgentMessage } from '@/lib/agent/llm';
import { AguiDecision } from '@/lib/agui/types';
import { A2uiMessage } from './types';
import { messagesSchema } from './schema';
import { buildMaterializerPrompt } from './materializerPrompt';

// ─────────────────────────────────────────────────────────────────────────────
// A2UI materializer — the "materializes" half of "AGUI decides, A2UI materializes".
//
// Takes a finished AguiDecision and produces validated A2UI messages in a single
// tool-less LLM call. It never searches or reasons — all data is handed to it by
// the reasoner. Swapping this out (e.g. per channel) requires no change to AGUI.
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  const clean = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  return JSON.parse(clean);
}

/** Compact, model-facing view of the decision (drops the verbose context echo). */
function decisionPayload(decision: AguiDecision): string {
  return JSON.stringify(
    {
      intent: decision.intent,
      headline: decision.headline,
      note: decision.note,
      journeyStep: decision.journeyStep,
      products: decision.products,
      cart: decision.cart,
    },
    null,
    2,
  );
}

export async function materialize(decision: AguiDecision): Promise<A2uiMessage[]> {
  const provider = createProvider();

  const systemPrompt = await buildMaterializerPrompt(decision.context);
  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Materialize this AGUI decision into A2UI messages:\n\n${decisionPayload(
        decision,
      )}`,
    },
  ];

  const response = await provider.chat(messages, [], true);
  const parsed = extractJson(response.content ?? '') as { messages?: unknown };
  const raw = Array.isArray(parsed) ? parsed : (parsed.messages ?? parsed);
  return messagesSchema.parse(raw) as A2uiMessage[];
}
