'use client';

// Maps catalog component names -> MUI components. Keys MUST match the keys in
// lib/catalog/mui.catalog.json (checked by assertCatalogParity below). Each entry
// is a render function so we can translate A2UI prop shapes into MUI props.

import * as React from 'react';
import {
  Stack,
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Divider,
  Button,
  Rating,
  Chip,
  TextField,
  Alert,
  Avatar,
  LinearProgress,
} from '@mui/material';
import { ComponentNode, A2uiEvent } from '@/lib/a2ui/types';
import { resolveValue, getByPath, resolveContext } from '@/lib/a2ui/resolve';

export interface RenderCtx {
  node: ComponentNode;
  scope: unknown;
  renderChild: (id: string, scope?: unknown) => React.ReactNode;
  dispatch: (event: A2uiEvent) => void;
}

function prop<T = unknown>(
  node: ComponentNode,
  name: string,
  scope: unknown,
  fallback?: T,
): T {
  const v = node[name];
  return (v === undefined ? fallback : resolveValue(v, scope)) as T;
}

function childrenOf(ctx: RenderCtx): React.ReactNode {
  const ids = (ctx.node.children as string[] | undefined) ?? [];
  return ids.map((id) => ctx.renderChild(id, ctx.scope));
}

function makeHandler(
  ctx: RenderCtx,
  name = 'onPress',
): (() => void) | undefined {
  const action = ctx.node[name] as { event?: A2uiEvent } | undefined;
  if (!action || !action.event) return undefined;
  return () =>
    ctx.dispatch({
      name: action.event!.name,
      context: resolveContext(action.event!.context, ctx.scope) as Record<string, import('@/lib/a2ui/types').PropValue>,
    });
}

export const componentMap: Record<string, (ctx: RenderCtx) => React.ReactNode> = {
  Container: (c) => (
    <Container
      maxWidth={prop(c.node, 'maxWidth', c.scope, 'sm') as never}
      sx={{ py: prop(c.node, 'py', c.scope, 2) as number }}
    >
      {childrenOf(c)}
    </Container>
  ),

  Stack: (c) => (
    <Stack
      direction={prop(c.node, 'direction', c.scope, 'column') as never}
      spacing={prop(c.node, 'spacing', c.scope, 1) as number}
      alignItems={prop<string | undefined>(c.node, 'alignItems', c.scope)}
      justifyContent={prop<string | undefined>(c.node, 'justifyContent', c.scope)}
      sx={prop(c.node, 'sx', c.scope) as object | undefined}
    >
      {childrenOf(c)}
    </Stack>
  ),

  Box: (c) => (
    <Box sx={prop(c.node, 'sx', c.scope) as object | undefined}>{childrenOf(c)}</Box>
  ),

  Typography: (c) => (
    <Typography
      variant={prop(c.node, 'variant', c.scope, 'body1') as never}
      color={prop<string | undefined>(c.node, 'color', c.scope)}
      fontWeight={prop<number | undefined>(c.node, 'fontWeight', c.scope)}
      sx={prop(c.node, 'sx', c.scope) as object | undefined}
    >
      {String(prop(c.node, 'text', c.scope, '') ?? '')}
    </Typography>
  ),

  Divider: (c) => <Divider sx={prop(c.node, 'sx', c.scope) as object | undefined} />,

  Card: (c) => {
    const onClick = makeHandler(c);
    return (
      <Card
        variant="outlined"
        onClick={onClick}
        sx={{ cursor: onClick ? 'pointer' : 'default', overflow: 'hidden', height: '100%' }}
      >
        {childrenOf(c)}
      </Card>
    );
  },

  CardContent: (c) => <CardContent>{childrenOf(c)}</CardContent>,

  CardMedia: (c) => (
    <CardMedia
      image={prop<string | undefined>(c.node, 'image', c.scope)}
      sx={{
        height: prop(c.node, 'height', c.scope, 120) as number,
        bgcolor: 'action.hover',
        backgroundSize: 'contain',
      }}
    />
  ),

  Button: (c) => {
    const handler = makeHandler(c);
    return (
      <Button
        variant={prop(c.node, 'variant', c.scope, 'contained') as never}
        color={prop(c.node, 'color', c.scope, 'primary') as never}
        size={prop(c.node, 'size', c.scope, 'medium') as never}
        fullWidth={prop(c.node, 'fullWidth', c.scope, false) as boolean}
        onClick={
          handler
            ? (e) => {
                e.stopPropagation();
                handler();
              }
            : undefined
        }
      >
        {String(prop(c.node, 'label', c.scope, '') ?? '')}
      </Button>
    );
  },

  Rating: (c) => (
    <Rating
      value={Number(prop(c.node, 'value', c.scope, 0))}
      precision={prop(c.node, 'precision', c.scope, 0.5) as number}
      readOnly={prop(c.node, 'readOnly', c.scope, true) as boolean}
      size="small"
    />
  ),

  Chip: (c) => {
    const handler = makeHandler(c);
    return (
      <Chip
        label={String(prop(c.node, 'label', c.scope, ''))}
        color={prop(c.node, 'color', c.scope, 'default') as never}
        variant={prop(c.node, 'variant', c.scope, 'filled') as never}
        size={prop(c.node, 'size', c.scope, 'medium') as never}
        onClick={handler}
        clickable={!!handler}
        sx={prop(c.node, 'sx', c.scope) as object | undefined}
      />
    );
  },

  TextField: (c) => (
    <TextField
      label={prop<string | undefined>(c.node, 'label', c.scope)}
      placeholder={prop<string | undefined>(c.node, 'placeholder', c.scope)}
      size="small"
      fullWidth
    />
  ),

  Alert: (c) => (
    <Alert severity={prop(c.node, 'severity', c.scope, 'info') as never}>
      {String(prop(c.node, 'message', c.scope, ''))}
    </Alert>
  ),

  Avatar: (c) => (
    <Avatar
      src={prop<string | undefined>(c.node, 'src', c.scope)}
      alt={prop<string | undefined>(c.node, 'alt', c.scope)}
      variant={prop(c.node, 'variant', c.scope, 'circular') as never}
      sx={prop(c.node, 'sx', c.scope) as object | undefined}
    />
  ),

  LinearProgress: (c) => (
    <LinearProgress variant="determinate" value={Number(prop(c.node, 'value', c.scope, 0))} />
  ),

  // Repeater: render the template once per item, with the item as the data scope.
  List: (c) => {
    const itemsPath = c.node.itemsPath as string;
    const items = (getByPath(c.scope, itemsPath) as unknown[]) ?? [];
    const columns = prop(c.node, 'columns', c.scope, 2) as number;
    const spacing = prop(c.node, 'spacing', c.scope, 12) as number;
    const template = c.node.itemTemplate as string;
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${spacing}px`,
        }}
      >
        {items.map((item, i) => (
          <React.Fragment key={(item as { id?: string })?.id ?? i}>
            {c.renderChild(template, item)}
          </React.Fragment>
        ))}
      </Box>
    );
  },
};

export function assertCatalogParity(catalogNames: string[]): void {
  if (process.env.NODE_ENV === 'production') return;
  const missing = catalogNames.filter((n) => !componentMap[n]);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(`[a2ui] catalog components without a renderer: ${missing.join(', ')}`);
  }
}
