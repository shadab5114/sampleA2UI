// Minimal A2UI message processor: folds createSurface / updateComponents /
// updateDataModel into a SurfaceState. Our own lightweight stand-in for the
// reference repo's MessageProcessor (we render MUI, so we own the renderer).

import { A2uiMessage, SurfaceState } from '@/lib/a2ui/types';

export function emptySurface(): SurfaceState {
  return { surfaceId: null, rootId: null, components: {}, dataModel: {} };
}

function setByPath(
  model: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return value as Record<string, unknown>;
  const next = { ...model };
  let cur = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    cur[key] = { ...((cur[key] as Record<string, unknown>) ?? {}) };
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}

export function applyMessage(state: SurfaceState, msg: A2uiMessage): SurfaceState {
  if ('updateComponents' in msg) {
    const { surfaceId, components } = msg.updateComponents;
    const map = { ...state.components };
    for (const c of components) map[c.id] = c;
    return { ...state, surfaceId: state.surfaceId ?? surfaceId, components: map };
  }
  if ('updateDataModel' in msg) {
    const { path, value } = msg.updateDataModel;
    const dataModel =
      path === '/' || path === ''
        ? (value as Record<string, unknown>)
        : setByPath(state.dataModel, path, value);
    return { ...state, dataModel };
  }
  if ('createSurface' in msg) {
    const { surfaceId, root } = msg.createSurface;
    return { ...state, surfaceId, rootId: root };
  }
  return state;
}

export function applyMessages(state: SurfaceState, messages: A2uiMessage[]): SurfaceState {
  return messages.reduce(applyMessage, state);
}
