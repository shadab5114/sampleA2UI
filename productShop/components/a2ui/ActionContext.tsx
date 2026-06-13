'use client';

// The action dispatcher is the seam that lets one renderer serve both flows.
// Deterministic provider -> navigation / local data-model updates.
// Conversational provider -> POST the event to /api/agent and apply the reply.

import { createContext, useContext } from 'react';
import { A2uiEvent } from '@/lib/a2ui/types';

export type ActionDispatch = (event: A2uiEvent) => void;

const ActionContext = createContext<ActionDispatch>(() => {});

export const ActionProvider = ActionContext.Provider;

export function useAction(): ActionDispatch {
  return useContext(ActionContext);
}
