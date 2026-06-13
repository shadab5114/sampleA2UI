import { createProvider, AgentMessage } from '@/lib/agent/llm';
import {
  searchProductsTool,
  executeSearchProducts,
  SearchParams,
} from '@/lib/agent/tools';
import { ChannelContext } from '@/lib/context/channelContext';
import { buildReasonerPrompt } from './reasonerPrompt';
import { AguiDecision, CartItemData, Product, RawDecision } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// AGUI reasoner — the "decides" half of "AGUI decides, A2UI materializes".
//
// Runs the agentic tool loop (search_products) and resolves the model's compact
// RawDecision into a fully-grounded AguiDecision. Crucially it returns a DECISION,
// never UI — the materializer is a separate step. This separation means the same
// reasoning can drive any channel's materializer unchanged.
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  const clean = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  return JSON.parse(clean);
}

const VALID_INTENTS = ['browse', 'search', 'detail', 'compare', 'empty'] as const;

export async function runReasoner(
  userMessage: string,
  context: ChannelContext,
  cartItems?: CartItemData[],
): Promise<AguiDecision> {
  // ── Cart path: deterministic, no LLM needed to "decide" ──────────────────
  // When the chat UI hands us a cart snapshot, the decision is unambiguous:
  // confirm the cart. We skip the reasoning round-trip entirely.
  if (cartItems && cartItems.length > 0) {
    const total = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    return {
      intent: 'cart_confirm',
      headline: 'Added to Cart',
      note: 'Here is your updated cart.',
      products: [],
      cart: { items: cartItems, total: `£${total.toFixed(2)}` },
      journeyStep: 'cart',
      context,
    };
  }

  // ── Search path: LLM tool loop ending in a RawDecision ───────────────────
  const provider = createProvider();
  const messages: AgentMessage[] = [
    { role: 'system', content: buildReasonerPrompt(context) },
    { role: 'user', content: userMessage },
  ];

  // Accumulate every product the tools surfaced, keyed by id, so we can resolve
  // the model's productIds against real data (and never trust it to transcribe).
  const seen = new Map<string, Product>();

  for (let turn = 0; turn < 5; turn++) {
    const response = await provider.chat(messages, [searchProductsTool], true);

    if (!response.done) {
      messages.push({ role: 'assistant', content: null, toolCalls: response.toolCalls });
      for (const tc of response.toolCalls) {
        const params = JSON.parse(tc.arguments) as SearchParams;
        const results = executeSearchProducts(params) as Product[];
        for (const p of results) seen.set(p.id, p);
        messages.push({
          role: 'tool_result',
          toolCallId: tc.id,
          content: JSON.stringify(results),
        });
      }
      continue;
    }

    const raw = extractJson(response.content ?? '') as RawDecision;
    return resolveDecision(raw, seen, context);
  }

  throw new Error('AGUI reasoner exceeded maximum turns');
}

/** Turn the model's compact RawDecision + captured products into a real decision. */
function resolveDecision(
  raw: RawDecision,
  seen: Map<string, Product>,
  context: ChannelContext,
): AguiDecision {
  const intent = (VALID_INTENTS as readonly string[]).includes(raw.intent)
    ? raw.intent
    : 'browse';

  // Resolve products: explicit ids → those products (in order); omitted → all seen.
  let products: Product[];
  if (raw.productIds && raw.productIds.length > 0) {
    products = raw.productIds.map((id) => seen.get(id)).filter((p): p is Product => Boolean(p));
  } else {
    products = [...seen.values()];
  }

  const journeyStep =
    raw.journeyStep ?? (intent === 'compare' ? 'comparing' : 'browsing');

  return {
    intent: products.length === 0 && intent !== 'empty' ? 'empty' : intent,
    headline: raw.headline?.trim() || 'PhoneHub',
    note: raw.note?.trim() || undefined,
    products,
    journeyStep,
    context,
  };
}
