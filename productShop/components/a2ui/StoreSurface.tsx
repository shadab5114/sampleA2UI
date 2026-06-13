'use client';

// Deterministic-flow wrapper: feeds static A2UI messages into the shared renderer
// with a navigation-based action dispatcher, plus a "Show A2UI JSON" teaching toggle.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Snackbar } from '@mui/material';
import { A2uiRenderer } from './A2uiRenderer';
import { A2uiMessage, A2uiEvent } from '@/lib/a2ui/types';
import { useCart } from '@/lib/cart/CartContext';
import { useChannel } from '@/components/store/ChannelProvider';
import { channelMeta } from '@/lib/context/channelContext';
import { adaptLayout } from '@/lib/a2ui/layout';
import allProducts from '@/lib/data/products.json';

interface StoreSurfaceProps {
  messages: A2uiMessage[];
  /** Called before the default dispatch. Return true to stop default handling. */
  onEvent?: (event: A2uiEvent) => boolean | void;
}

export default function StoreSurface({ messages, onEvent }: StoreSurfaceProps) {
  const router = useRouter();
  const cart = useCart();
  const { context } = useChannel();
  const [snack, setSnack] = React.useState<string | null>(null);
  const [showJson, setShowJson] = React.useState(false);

  // Adaptive Layout: reflow the surface for the active channel's form factor.
  // Recomputes when the channel changes, so the SAME surface reflows live.
  const formFactor = channelMeta(context.channel).formFactor;
  const adapted = React.useMemo(
    () => adaptLayout(messages, formFactor),
    [messages, formFactor],
  );

  const dispatch = (event: A2uiEvent) => {
    if (onEvent?.(event)) return;

    switch (event.name) {
      case 'view_product':
        router.push(`/product/${event.context?.id}`);
        break;

      case 'add_to_cart': {
        const id = event.context?.id as string;
        const p = allProducts.find((x) => x.id === id);
        if (p) {
          cart.addItem({ id: p.id, name: p.name, price: p.price, priceLabel: p.priceLabel, image: p.image });
          setSnack(`${p.name} added to cart`);
        }
        break;
      }

      case 'remove_from_cart': {
        const id = event.context?.id as string;
        cart.removeItem(id);
        const p = allProducts.find((x) => x.id === id);
        setSnack(p ? `${p.name} removed` : 'Item removed');
        break;
      }

      case 'add_to_wishlist':
        setSnack('Saved to wishlist');
        break;

      case 'go_back':
        router.back();
        break;

      case 'checkout':
        setSnack('Checkout coming soon!');
        break;

      default:
        // eslint-disable-next-line no-console
        console.log('[store] unhandled event', event);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pt: 1 }}>
        <Button size="small" variant="text" color="inherit" onClick={() => setShowJson((v) => !v)}>
          {showJson ? 'Show UI' : 'Show A2UI JSON'}
        </Button>
      </Box>
      {showJson ? (
        <Box
          component="pre"
          sx={{ mx: 2, p: 2, fontSize: 11, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}
        >
          {JSON.stringify(adapted, null, 2)}
        </Box>
      ) : (
        <A2uiRenderer messages={adapted} dispatch={dispatch} />
      )}
      <Snackbar
        open={!!snack}
        autoHideDuration={2000}
        onClose={() => setSnack(null)}
        message={snack ?? ''}
      />
    </Box>
  );
}
