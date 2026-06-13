'use client';

import * as React from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Chip,
  Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import StoreSurface from '@/components/a2ui/StoreSurface';
import DecisionTrace from '@/components/demo/DecisionTrace';
import { A2uiMessage, A2uiEvent } from '@/lib/a2ui/types';
import { useCart } from '@/lib/cart/CartContext';
import { CartItemData } from '@/lib/agent/agent';
import { AguiDecision } from '@/lib/agui/types';
import { useChannel } from '@/components/store/ChannelProvider';
import allProducts from '@/lib/data/products.json';

type Turn =
  | { type: 'user'; text: string }
  | { type: 'action'; label: string }        // triggered by a surface action, not typed text
  | { type: 'assistant'; messages: A2uiMessage[]; decision?: AguiDecision }
  | { type: 'error'; text: string };

const SUGGESTIONS = [
  'Show phones under £500',
  'Best rated phones',
  'Apple phones',
  'Phones with a great camera',
  'Cheapest phone',
  'Compare Pixel 9 and iPhone 15',
];

export default function ChatPage() {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const loadingRef = React.useRef(false); // mutable ref so callbacks don't go stale
  const cart = useCart();
  const { context, setJourneyStep } = useChannel();

  // Keep refs in sync with state so callbacks can read the latest values
  // without being re-created (which would churn the stable useCallback deps).
  const contextRef = React.useRef(context);
  React.useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  React.useEffect(() => {
    contextRef.current = context;
  }, [context]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, loading]);

  // ── Core API call — shared by user text and surface action events ──────────
  const callAgent = React.useCallback(
    async (message: string, cartItems?: CartItemData[]) => {
      setLoading(true);
      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, cart: cartItems, context: contextRef.current }),
        });
        const data = await res.json();
        // Reflect the agent's decided journey step back into the global context
        // so the ChannelBar's "Journey" readout tracks the conversation.
        if (data.decision?.journeyStep) setJourneyStep(data.decision.journeyStep);
        const errText = data.error
          ? typeof data.error === 'string'
            ? data.error
            : data.error.message
          : null;
        setTurns((prev) => [
          ...prev,
          errText
            ? { type: 'error' as const, text: errText }
            : { type: 'assistant' as const, messages: data.messages, decision: data.decision },
        ]);
      } catch (err) {
        setTurns((prev) => [...prev, { type: 'error', text: String(err) }]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [setJourneyStep],
  );

  // ── User sends a text message ─────────────────────────────────────────────
  const send = React.useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || loading) return;
      setInput('');
      setTurns((prev) => [...prev, { type: 'user', text: msg }]);
      await callAgent(msg);
    },
    [loading, callAgent],
  );

  // ── Intercept events from agent-rendered surfaces ─────────────────────────
  const handleChatEvent = React.useCallback(
    (event: A2uiEvent): boolean | void => {
      if (event.name === 'add_to_cart') {
        const id = event.context?.id as string;
        const product = allProducts.find((p) => p.id === id);
        if (!product) return;

        // 1. Update the global cart (badge + cart page)
        cart.addItem({
          id: product.id,
          name: product.name,
          price: product.price,
          priceLabel: product.priceLabel,
          image: product.image,
        });

        // 2. Compute the new cart state ahead of React's async state flush
        const existing = cart.items.find((i) => i.id === id);
        const newItems: CartItemData[] = existing
          ? cart.items.map((i) => {
              const newQty = i.id === id ? i.qty + 1 : i.qty;
              return {
                id: i.id,
                name: i.name,
                qty: newQty,
                price: i.price,
                priceLabel: i.priceLabel,
                qtyLabel: `Qty: ${newQty}`,
                lineTotal: `£${(i.price * newQty).toFixed(2)}`,
              };
            })
          : [
              ...cart.items.map((i) => ({
                id: i.id,
                name: i.name,
                qty: i.qty,
                price: i.price,
                priceLabel: i.priceLabel,
                qtyLabel: `Qty: ${i.qty}`,
                lineTotal: `£${(i.price * i.qty).toFixed(2)}`,
              })),
              {
                id: product.id,
                name: product.name,
                qty: 1,
                price: product.price,
                priceLabel: product.priceLabel,
                qtyLabel: 'Qty: 1',
                lineTotal: product.priceLabel,
              },
            ];

        // 3. Show an action chip, then fire an agent turn with the cart data.
        //    Guard against concurrent calls: if an agent turn is already in flight,
        //    just record the chip — the item is still in the cart.
        const label = `Added ${product.name} to cart`;
        setTurns((prev) => [...prev, { type: 'action', label }]);

        if (!loadingRef.current) {
          const agentMessage = `The user clicked "Add to Cart" for "${product.name}" from a chat surface.`;
          callAgent(agentMessage, newItems);
        }
        return true; // prevent StoreSurface default (snackbar-only) handling
      }
    },
    [cart, callAgent],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px - 56px)',
        overflow: 'hidden',
      }}
    >
      {/* ── Scrollable conversation ─────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {turns.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Ask PhoneHub
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Describe what you&apos;re looking for. The agent searches inventory and builds a live
              UI — then actions on that UI feed right back into the conversation.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} variant="outlined" clickable onClick={() => send(s)} />
              ))}
            </Box>
          </Box>
        )}

        {turns.map((turn, i) => {
          // User text bubble
          if (turn.type === 'user') {
            return (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Paper
                  sx={{
                    px: 2,
                    py: 1,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: 2,
                    maxWidth: '80%',
                  }}
                >
                  <Typography variant="body2">{turn.text}</Typography>
                </Paper>
              </Box>
            );
          }

          // Action chip — surface event (e.g. add_to_cart click)
          if (turn.type === 'action') {
            return (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                <Chip
                  icon={<AddShoppingCartIcon fontSize="small" />}
                  label={turn.label}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              </Box>
            );
          }

          // Error
          if (turn.type === 'error') {
            return (
              <Alert key={i} severity="error" sx={{ mb: 1 }}>
                {turn.text}
              </Alert>
            );
          }

          // Assistant surface — rendered by the SAME engine as the deterministic site.
          // onEvent intercepts add_to_cart to trigger the round-trip.
          return (
            <Box key={i} sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {turn.decision && <DecisionTrace decision={turn.decision} />}
              <StoreSurface messages={turn.messages} onEvent={handleChatEvent} />
            </Box>
          );
        })}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="caption" color="text.secondary">
              Agent is thinking...
            </Typography>
          </Box>
        )}

        <div ref={bottomRef} />
      </Box>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={3}
        sx={{
          p: 1.5,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Ask about phones..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          disabled={loading}
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!input.trim() || loading}
          endIcon={<SendIcon />}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Send
        </Button>
      </Paper>
    </Box>
  );
}
