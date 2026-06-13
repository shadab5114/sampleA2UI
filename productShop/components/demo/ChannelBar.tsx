'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ChannelBar — the visible face of the architecture's left + right columns.
//
//   • Channel Sources   → the switcher chips (Mobile / Web / Associate / POS)
//   • Contextual Awareness → the live readout (channel · journey · user state)
//
// Flipping a chip updates the global ChannelContext, which flows into every
// agent call (P0) and, later, drives adaptive layout (P3) and policy (P4).
// ─────────────────────────────────────────────────────────────────────────────

import * as React from 'react';
import { Box, Chip, Stack, Typography, Tooltip, Divider } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import BadgeIcon from '@mui/icons-material/Badge';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useChannel } from '@/components/store/ChannelProvider';
import { CHANNEL_LIST } from '@/lib/context/channelContext';

export default function ChannelBar() {
  const { context, setChannel, setContext } = useChannel();
  const { channel, journeyStep, userState } = context;

  const toggleAuth = () =>
    setContext({ userState: { ...userState, authenticated: !userState.authenticated } });

  const toggleRole = () =>
    setContext({
      userState: { ...userState, role: userState.role === 'rep' ? 'customer' : 'rep' },
    });

  return (
    <Box
      sx={{
        position: 'sticky',
        top: { xs: 56, sm: 64 }, // matches MUI Toolbar height so it sits under the AppBar
        zIndex: 1090,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        px: 2,
        py: 1,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ overflowX: 'auto', '&::-webkit-scrollbar': { height: 6 } }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 600 }}>
          Channel
        </Typography>
        {CHANNEL_LIST.map((c) => (
          <Tooltip key={c.id} title={`${c.description} · ${c.formFactor}`} arrow>
            <Chip
              label={c.code}
              size="small"
              color={channel === c.id ? 'primary' : 'default'}
              variant={channel === c.id ? 'filled' : 'outlined'}
              onClick={() => setChannel(c.id)}
              sx={{ flexShrink: 0 }}
            />
          </Tooltip>
        ))}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Contextual Awareness readout */}
        <Tooltip title="Current journey step — updated by the agent's decisions" arrow>
          <Chip
            label={`Journey: ${journeyStep}`}
            size="small"
            variant="outlined"
            color="secondary"
            sx={{ flexShrink: 0 }}
          />
        </Tooltip>

        <Tooltip title="Toggle role (customer ↔ rep) — drives policy in P4" arrow>
          <Chip
            icon={userState.role === 'rep' ? <BadgeIcon /> : <PersonIcon />}
            label={userState.role}
            size="small"
            variant="outlined"
            onClick={toggleRole}
            sx={{ flexShrink: 0, textTransform: 'capitalize' }}
          />
        </Tooltip>

        <Tooltip title="Toggle auth (signed in ↔ guest) — drives policy in P4" arrow>
          <Chip
            icon={userState.authenticated ? <LockOpenIcon /> : <LockIcon />}
            label={userState.authenticated ? 'signed in' : 'guest'}
            size="small"
            variant="outlined"
            color={userState.authenticated ? 'success' : 'default'}
            onClick={toggleAuth}
            sx={{ flexShrink: 0 }}
          />
        </Tooltip>
      </Stack>
    </Box>
  );
}
