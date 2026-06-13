'use client';

import * as React from 'react';
import {
  ChannelContext as ChannelCtx,
  ChannelId,
  JourneyStep,
  DEFAULT_CONTEXT,
} from '@/lib/context/channelContext';

// ─────────────────────────────────────────────────────────────────────────────
// Client-side holder for the active ChannelContext.
//
// The pure type + helpers live in lib/context/channelContext.ts (server-safe).
// This React provider just keeps the *current* context in state so the UI (and
// the chat page's agent calls) can read and mutate channel / journey step.
// ─────────────────────────────────────────────────────────────────────────────

interface ChannelContextValue {
  context: ChannelCtx;
  setChannel: (channel: ChannelId) => void;
  setJourneyStep: (step: JourneyStep) => void;
  setContext: (patch: Partial<ChannelCtx>) => void;
}

const Ctx = React.createContext<ChannelContextValue | null>(null);

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const [context, setCtx] = React.useState<ChannelCtx>(DEFAULT_CONTEXT);

  const setChannel = React.useCallback((channel: ChannelId) => {
    setCtx((prev) => ({ ...prev, channel }));
  }, []);

  const setJourneyStep = React.useCallback((journeyStep: JourneyStep) => {
    setCtx((prev) => ({ ...prev, journeyStep }));
  }, []);

  const setContext = React.useCallback((patch: Partial<ChannelCtx>) => {
    setCtx((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = React.useMemo(
    () => ({ context, setChannel, setJourneyStep, setContext }),
    [context, setChannel, setJourneyStep, setContext],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChannel(): ChannelContextValue {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useChannel must be used within a ChannelProvider');
  return v;
}
