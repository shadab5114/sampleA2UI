// ─────────────────────────────────────────────────────────────────────────────
// Headless agent service — the transport-agnostic core of the API.
//
// Contains ZERO Next.js / React. Any transport (Next route, standalone Node, A2A)
// can call handleAgentRequest() and serialize the result. This is the seam that
// makes the same backend consumable by web AND native clients.
//
// Pipeline:  validate → normalize context → run agent (CANONICAL surface)
//            → adaptLayout for the declared form factor (RENDER-READY) → envelope
// ─────────────────────────────────────────────────────────────────────────────

import { runAgent } from '@/lib/agent/agent';
import { adaptLayout } from '@/lib/a2ui/layout';
import { normalizeContext } from '@/lib/context/channelContext';
import { activeProviderName } from '@/lib/agent/llm';
import { AgentRequest, AgentResponse, PROTOCOL_VERSION } from './contract';

/** Carries an HTTP status + machine code so any transport can map it. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function handleAgentRequest(input: AgentRequest): Promise<AgentResponse> {
  const message = typeof input?.message === 'string' ? input.message.trim() : '';
  if (!message) {
    throw new ApiError(400, 'invalid_request', 'message is required');
  }

  // Normalize the client-declared context (defaults fill any gaps).
  const context = normalizeContext(input?.context);
  const cart = Array.isArray(input?.cart) ? input.cart : undefined;

  // Only the active provider's key is required.
  const provider = activeProviderName();
  const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  if (!process.env[keyName]) {
    throw new ApiError(
      503,
      'provider_unconfigured',
      `${keyName} is not set on the server (LLM_PROVIDER=${provider}).`,
    );
  }

  // 1) The agent produces a CANONICAL, device-agnostic surface.
  const { decision, messages } = await runAgent(message, cart, context);

  // 2) The boundary adapts it to the declared form factor → render-ready JSON.
  //    Native clients render this verbatim; no client-side layout logic needed.
  const adapted = adaptLayout(messages, context.formFactor);

  return { protocolVersion: PROTOCOL_VERSION, decision, messages: adapted };
}
