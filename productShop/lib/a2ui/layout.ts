// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Layout — the "Layout" block of the architecture.
//
// A pure post-process that rewrites layout props on a finished A2UI message set
// based on the channel's form factor. The agent and surface authors stay layout-
// agnostic; the SAME surface reflows per channel. Applied client-side in
// StoreSurface, so flipping the channel reflows an already-rendered surface with
// no new agent turn.
// ─────────────────────────────────────────────────────────────────────────────

import { A2uiMessage, ComponentNode } from './types';
import { FormFactor } from '@/lib/context/channelContext';

interface LayoutProfile {
  /** Columns for a multi-column grid (single-column lists are left untouched). */
  gridColumns: number;
  /** Grid gap / list spacing in px. */
  gap: number;
  /** Upper bound for Container maxWidth (never widens beyond the authored value). */
  maxWidthCap: MaxWidth;
}

type MaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const WIDTH_ORDER: MaxWidth[] = ['xs', 'sm', 'md', 'lg', 'xl'];

const PROFILES: Record<FormFactor, LayoutProfile> = {
  mobile: { gridColumns: 1, gap: 8, maxWidthCap: 'xs' },
  tablet: { gridColumns: 2, gap: 12, maxWidthCap: 'sm' },
  desktop: { gridColumns: 3, gap: 16, maxWidthCap: 'xl' },
};

/** Smaller of two maxWidth tokens (so we narrow on small channels, never widen). */
function capWidth(authored: unknown, cap: MaxWidth): MaxWidth {
  const a = typeof authored === 'string' ? (authored as MaxWidth) : 'sm';
  const ai = WIDTH_ORDER.indexOf(a);
  const ci = WIDTH_ORDER.indexOf(cap);
  if (ai < 0) return cap;
  return WIDTH_ORDER[Math.min(ai, ci)];
}

function adaptNode(node: ComponentNode, p: LayoutProfile): ComponentNode {
  if (node.component === 'List') {
    const authored = typeof node.columns === 'number' ? node.columns : 2;
    // Respect intentional single-column lists (e.g. the cart) on every channel;
    // only multi-column grids follow the channel profile.
    const columns = authored <= 1 ? 1 : p.gridColumns;
    return { ...node, columns, spacing: p.gap };
  }
  if (node.component === 'Container') {
    return { ...node, maxWidth: capWidth(node.maxWidth, p.maxWidthCap) };
  }
  return node;
}

/** Rewrite layout props for the given form factor. Pure — returns new messages. */
export function adaptLayout(messages: A2uiMessage[], formFactor: FormFactor): A2uiMessage[] {
  const p = PROFILES[formFactor];
  return messages.map((m) => {
    if (!('updateComponents' in m)) return m;
    return {
      updateComponents: {
        ...m.updateComponents,
        components: m.updateComponents.components.map((node) => adaptNode(node, p)),
      },
    };
  });
}
