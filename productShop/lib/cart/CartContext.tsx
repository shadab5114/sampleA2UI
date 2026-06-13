'use client';

import * as React from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  image: string;
  qty: number;
}

interface CartCtx {
  items: CartItem[];
  addItem: (product: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string) => void;
  total: number;
  count: number;
}

const CartContext = React.createContext<CartCtx>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  total: 0,
  count: 0,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);

  const addItem = React.useCallback((product: Omit<CartItem, 'qty'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartCtx {
  return React.useContext(CartContext);
}
