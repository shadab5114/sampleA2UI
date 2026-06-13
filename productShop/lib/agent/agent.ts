import { A2uiMessage } from '@/lib/a2ui/types';
import { materialize } from '@/lib/a2ui/materializer';
import { runReasoner } from '@/lib/agui/reasoner';
import { AguiDecision } from '@/lib/agui/types';
import { ChannelContext, DEFAULT_CONTEXT } from '@/lib/context/channelContext';

// Re-export the shared cart type from its new home (lib/agui/types) so existing
// imports `from '@/lib/agent/agent'` keep working.
export type { CartItemData } from '@/lib/agui/types';
import { CartItemData } from '@/lib/agui/types';

/** What a full agent turn produces: the AGUI decision and the A2UI it materialized. */
export interface AgentResult {
  decision: AguiDecision;
  messages: A2uiMessage[];
}

/**
 * Orchestrates one agent turn — the thin seam between the two layers:
 *   1. AGUI reasons about the request → AguiDecision   ("decides")
 *   2. A2UI materializes the decision → A2UI messages  ("materializes")
 *
 * Both the decision and the messages are returned so the UI can show the trace.
 */
export async function runAgent(
  userMessage: string,
  cartItems?: CartItemData[],
  context?: ChannelContext,
): Promise<AgentResult> {
  const ctx = context ?? DEFAULT_CONTEXT;

  const decision = await runReasoner(userMessage, ctx, cartItems);
  const messages = await materialize(decision);

  return { decision, messages };
}
