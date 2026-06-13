'use client';

// The shared rendering engine. Folds A2UI messages into surface state, then walks
// the component tree from the root, resolving bindings against the data scope and
// wiring actions to the injected dispatcher. Used by BOTH flows.

import * as React from 'react';
import { Box } from '@mui/material';
import { componentMap } from './componentMap';
import { applyMessages, emptySurface } from './useSurface';
import { A2uiMessage, A2uiEvent, SurfaceState } from '@/lib/a2ui/types';

function RenderNode({
  state,
  nodeId,
  scope,
  dispatch,
}: {
  state: SurfaceState;
  nodeId: string;
  scope: unknown;
  dispatch: (e: A2uiEvent) => void;
}): React.ReactNode {
  const node = state.components[nodeId];
  if (!node) return null;
  const renderer = componentMap[node.component];
  if (!renderer) {
    return (
      <Box sx={{ p: 1, border: '1px dashed', borderColor: 'error.main', color: 'error.main', fontSize: 12 }}>
        Unknown component: {node.component}
      </Box>
    );
  }
  const renderChild = (id: string, childScope?: unknown) => (
    <RenderNode key={id} state={state} nodeId={id} scope={childScope ?? scope} dispatch={dispatch} />
  );
  return <>{renderer({ node, scope, renderChild, dispatch })}</>;
}

export function A2uiRenderer({
  messages,
  dispatch,
}: {
  messages: A2uiMessage[];
  dispatch?: (event: A2uiEvent) => void;
}) {
  const state = React.useMemo(() => applyMessages(emptySurface(), messages), [messages]);
  const handle = dispatch ?? (() => {});
  if (!state.rootId) {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <Box sx={{ p: 1, border: '1px dashed', borderColor: 'warning.main', color: 'warning.main', fontSize: 12 }}>
          A2UI: no root — missing or invalid createSurface message
        </Box>
      );
    }
    return null;
  }
  return <RenderNode state={state} nodeId={state.rootId} scope={state.dataModel} dispatch={handle} />;
}
