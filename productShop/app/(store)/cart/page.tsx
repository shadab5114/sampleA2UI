'use client';

import * as React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import StoreSurface from '@/components/a2ui/StoreSurface';
import cartSurface from '@/surfaces/cart.a2ui.json';
import { useCart } from '@/lib/cart/CartContext';
import { A2uiMessage } from '@/lib/a2ui/types';

export default function CartPage() {
  const { items, total } = useCart();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Your Cart is Empty
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Browse our phones and add some to your cart.
        </Typography>
        <Button variant="contained" onClick={() => router.push('/')}>
          Shop Now
        </Button>
      </Box>
    );
  }

  const cartItems = items.map((item) => ({
    ...item,
    qtyLabel: `Qty: ${item.qty}`,
    lineTotal: `£${(item.price * item.qty).toFixed(2)}`,
  }));

  const messages: A2uiMessage[] = [
    { updateDataModel: { surfaceId: 'cart', path: '/items', value: cartItems } },
    { updateDataModel: { surfaceId: 'cart', path: '/total', value: `£${total.toFixed(2)}` } },
    ...(cartSurface as A2uiMessage[]),
  ];

  return <StoreSurface messages={messages} />;
}
