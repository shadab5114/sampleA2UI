// Data-binding resolution: turn `{ path }` bindings + literals into concrete
// values against the current data scope. At the top level the scope is the full
// data model; inside a List the scope is the current item.

import { isBinding } from './types';

export function getByPath(scope: unknown, path: string): unknown {
  if (!path || path === '/') return scope;
  const parts = path.split('/').filter(Boolean);
  let cur: unknown = scope;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function resolveValue(value: unknown, scope: unknown): unknown {
  if (isBinding(value)) return getByPath(scope, value.path);
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, scope));
  return value;
}

export function resolveContext(
  ctx: Record<string, unknown> | undefined,
  scope: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!ctx) return out;
  for (const key of Object.keys(ctx)) out[key] = resolveValue(ctx[key], scope);
  return out;
}
