// ─────────────────────────────────────────────────────────────────────────────
// ChannelContext — the "Contextual Awareness" spine of the architecture.
//
// One object that travels with every agent call and every render, describing
// WHO is asking, FROM WHERE, and at WHAT step of their journey. Nothing in the
// app adapted to context before this; downstream phases (adaptive Layout,
// policy-governed rendering, the channel switcher) all read from here.
//
// This module is intentionally pure / framework-free so it can be imported by
// server code (the agent) AND client code (the React provider) alike.
// ─────────────────────────────────────────────────────────────────────────────

/** The four storefront channels the single A2UI app unifies. */
export type ChannelId = 'mobile' | 'web' | 'associate' | 'pos';

/** Where in the shopping journey the user currently is. */
export type JourneyStep = 'browsing' | 'comparing' | 'cart' | 'checkout';

export type UserRole = 'customer' | 'rep';

export interface UserState {
  authenticated: boolean;
  role: UserRole;
  name?: string;
}

/** Form factor drives adaptive layout. The client DECLARES this per request. */
export type FormFactor = 'mobile' | 'tablet' | 'desktop';

/** The client platform calling the API (analytics + structural template hints). */
export type Platform = 'web' | 'ios' | 'android' | 'rn' | 'flutter';

export interface Viewport {
  width: number;
  height?: number;
}

/** The context object threaded through the whole experience layer. */
export interface ChannelContext {
  channel: ChannelId;
  journeyStep: JourneyStep;
  userState: UserState;
  /** Device class that drives server-side layout adaptation. Default 'desktop'. */
  formFactor: FormFactor;
  /** Calling platform (web / ios / android / …). Default 'web'. */
  platform: Platform;
  /** Optional exact viewport — enables finer width-based adaptation later. */
  viewport?: Viewport;
  /** Free-form description of what the agent is currently doing (set per turn). */
  agentTaskState?: string;
}

export interface ChannelMeta {
  id: ChannelId;
  /** Short code shown on the switcher chip. */
  code: string;
  label: string;
  description: string;
  formFactor: FormFactor;
}

/** Channel registry — the canonical source for channel metadata. */
export const CHANNELS: Record<ChannelId, ChannelMeta> = {
  mobile: {
    id: 'mobile',
    code: 'Mobile',
    label: 'Mobile App',
    description: 'Mobile app — a customer shopping on their phone.',
    formFactor: 'mobile',
  },
  web: {
    id: 'web',
    code: 'Web',
    label: 'Web Store',
    description: 'Web store — a customer in a desktop browser.',
    formFactor: 'desktop',
  },
  associate: {
    id: 'associate',
    code: 'Associate',
    label: 'Store Associate',
    description: 'Store associate desktop — a rep assisting a customer.',
    formFactor: 'desktop',
  },
  pos: {
    id: 'pos',
    code: 'POS',
    label: 'Retail POS',
    description: 'Retail point-of-sale on a tablet in-store.',
    formFactor: 'tablet',
  },
};

export const CHANNEL_LIST: ChannelMeta[] = Object.values(CHANNELS);

/** The default context used when no channel has been chosen yet (web customer). */
export const DEFAULT_CONTEXT: ChannelContext = {
  channel: 'web',
  journeyStep: 'browsing',
  userState: { authenticated: true, role: 'customer', name: 'Guest' },
  formFactor: 'desktop',
  platform: 'web',
};

export function channelMeta(channel: ChannelId): ChannelMeta {
  return CHANNELS[channel] ?? CHANNELS.web;
}

/**
 * Validate + normalise an untrusted context (e.g. from an API request body)
 * into a well-formed ChannelContext, falling back to defaults for missing
 * or invalid fields. Keeps the agent path defensive without a schema lib.
 */
export function normalizeContext(input: unknown): ChannelContext {
  const ctx = (input ?? {}) as Partial<ChannelContext>;
  const channel: ChannelId = ctx.channel && ctx.channel in CHANNELS ? ctx.channel : DEFAULT_CONTEXT.channel;

  const validSteps: JourneyStep[] = ['browsing', 'comparing', 'cart', 'checkout'];
  const journeyStep: JourneyStep =
    ctx.journeyStep && validSteps.includes(ctx.journeyStep)
      ? ctx.journeyStep
      : DEFAULT_CONTEXT.journeyStep;

  const u: Partial<UserState> = ctx.userState ?? {};
  const userState: UserState = {
    authenticated: typeof u.authenticated === 'boolean' ? u.authenticated : DEFAULT_CONTEXT.userState.authenticated,
    role: u.role === 'rep' ? 'rep' : 'customer',
    name: typeof u.name === 'string' ? u.name : DEFAULT_CONTEXT.userState.name,
  };

  // formFactor is the authoritative device class for layout — explicit, NOT
  // derived from `channel` (channel is a demo/analytics concept). Default desktop
  // (the widest/canonical layout) so a client that omits it is never collapsed.
  const validFactors: FormFactor[] = ['mobile', 'tablet', 'desktop'];
  const formFactor: FormFactor =
    ctx.formFactor && validFactors.includes(ctx.formFactor)
      ? ctx.formFactor
      : DEFAULT_CONTEXT.formFactor;

  const validPlatforms: Platform[] = ['web', 'ios', 'android', 'rn', 'flutter'];
  const platform: Platform =
    ctx.platform && validPlatforms.includes(ctx.platform) ? ctx.platform : DEFAULT_CONTEXT.platform;

  const viewport: Viewport | undefined =
    ctx.viewport && typeof ctx.viewport.width === 'number'
      ? { width: ctx.viewport.width, height: typeof ctx.viewport.height === 'number' ? ctx.viewport.height : undefined }
      : undefined;

  return {
    channel,
    journeyStep,
    userState,
    formFactor,
    platform,
    viewport,
    agentTaskState: typeof ctx.agentTaskState === 'string' ? ctx.agentTaskState : undefined,
  };
}

/**
 * Render the context as a compact block for the agent system prompt — this is
 * how "Contextual Awareness" reaches the reasoning layer. Downstream phases act
 * on context in code; here we simply make the agent aware of it.
 */
export function describeContextForPrompt(ctx: ChannelContext): string {
  const who = ctx.userState.role === 'rep' ? 'a store associate assisting a customer' : 'a customer';
  const auth = ctx.userState.authenticated ? 'authenticated' : 'not signed in';
  return [
    `Platform: ${ctx.platform}`,
    `Form factor: ${ctx.formFactor} (column counts are adapted downstream — do NOT change layout for this)`,
    `User: ${who}, ${auth}${ctx.userState.name ? ` (${ctx.userState.name})` : ''}`,
    `Journey step: ${ctx.journeyStep}`,
    ctx.agentTaskState ? `Agent task: ${ctx.agentTaskState}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
