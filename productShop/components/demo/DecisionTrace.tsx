'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DecisionTrace — makes "AGUI decides, A2UI materializes" visible.
//
// Shows the AguiDecision the reasoning layer produced for a chat turn. Paired
// with StoreSurface's existing "Show A2UI JSON" toggle, the two halves of the
// architecture's Foundation row are both inspectable: this is the "decides"
// side, that is the "materializes" side.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from 'react';
import { Box, Chip, Collapse, Stack, Typography, Button } from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { AguiDecision } from '@/lib/agui/types';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} sx={{ fontSize: 12 }}>
      <Typography variant="caption" sx={{ minWidth: 76, color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ fontSize: 12 }}>{value}</Box>
    </Stack>
  );
}

export default function DecisionTrace({ decision }: { decision: AguiDecision }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
      <Button
        size="small"
        startIcon={<PsychologyIcon fontSize="small" />}
        endIcon={
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
          />
        }
        onClick={() => setOpen((v) => !v)}
        sx={{ textTransform: 'none', color: 'text.secondary', px: 2, py: 0.5 }}
      >
        AGUI decided: <strong style={{ marginLeft: 4 }}>{decision.intent}</strong>
      </Button>

      <Collapse in={open}>
        <Stack spacing={0.75} sx={{ px: 2, pb: 1.5 }}>
          <Field label="Intent" value={<Chip size="small" label={decision.intent} color="primary" />} />
          <Field label="Headline" value={decision.headline} />
          {decision.note && <Field label="Note" value={decision.note} />}
          <Field label="Journey" value={decision.journeyStep} />
          <Field label="Channel" value={decision.context.channel.toUpperCase()} />
          {decision.products.length > 0 && (
            <Field
              label="Products"
              value={
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {decision.products.map((p) => (
                    <Chip key={p.id} size="small" variant="outlined" label={p.name} />
                  ))}
                </Stack>
              }
            />
          )}
          {decision.cart && (
            <Field label="Cart" value={`${decision.cart.items.length} item(s) · ${decision.cart.total}`} />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
            ↓ A2UI then materialized this into the surface below (toggle “Show A2UI JSON” to see it).
          </Typography>
        </Stack>
      </Collapse>
    </Box>
  );
}
