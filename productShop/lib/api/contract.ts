// ─────────────────────────────────────────────────────────────────────────────
// Public API contract for /agent.
//
// This is the artifact native (and web) clients code against. It is intentionally
// transport-agnostic and free of Next.js / React imports — the same shapes apply
// whether the service is mounted as a Next route, a standalone Node server, or an
// A2A endpoint. See API.md for documentation + example payloads.
// ─────────────────────────────────────────────────────────────────────────────

import { A2uiMessage } from '@/lib/a2ui/types';
import { AguiDecision, CartItemData } from '@/lib/agui/types';
import {
  ChannelId,
  FormFactor,
  JourneyStep,
  Platform,
  Viewport,
} from '@/lib/context/channelContext';

/** Bumped when the A2UI message/binding semantics change in a breaking way. */
export const PROTOCOL_VERSION = '0.9';

/** Context the client DECLARES about itself. The agent never guesses device. */
export interface RequestContext {
  /** Calling platform. Default 'web'. */
  platform?: Platform;
  /** Device class that drives server-side layout adaptation. Default 'desktop'. */
  formFactor?: FormFactor;
  /** Optional exact viewport (reserved for finer width-based adaptation). */
  viewport?: Viewport;
  /** Where the user is in the journey. Default 'browsing'. */
  journeyStep?: JourneyStep;
  /** Who the user is. */
  userState?: {
    authenticated?: boolean;
    role?: 'customer' | 'rep';
    name?: string;
  };
  /** Optional — demo/analytics label only; does NOT affect layout. */
  channel?: ChannelId;
}

/** Forward-looking: lets the server target only what this client can render. */
export interface ClientCapabilities {
  protocolVersion?: string;
  catalogVersion?: string;
  /** Catalog component names this client has implemented a renderer for. */
  components?: string[];
}

/** POST /agent request body. */
export interface AgentRequest {
  /** The user's message / prompt. Required. */
  message: string;
  /** What the client is and where the user is. */
  context?: RequestContext;
  /** Cart snapshot — pass on a cart action so the agent confirms it. */
  cart?: CartItemData[];
  /** Reserved: capability negotiation (enforcement coming). */
  capabilities?: ClientCapabilities;
}

/** Successful response. `messages` are render-ready (already layout-adapted). */
export interface AgentResponse {
  protocolVersion: string;
  /** What the AGUI layer decided (intent, products, journey). Useful for app chrome/nav. */
  decision: AguiDecision;
  /** The A2UI surface to render, adapted to context.formFactor. */
  messages: A2uiMessage[];
}

/** Error response (same envelope shape for every failure). */
export interface AgentErrorResponse {
  protocolVersion: string;
  error: { code: string; message: string };
}
