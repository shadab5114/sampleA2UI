'use client';

// Client wrapper for the home page. Holds brand-filter state and intercepts
// filter_brand events so the product grid re-renders without a page reload.
// This demonstrates A2UI data-model reactivity: swap /products in the data
// model → the List repeater re-renders automatically, no A2UI surface change.

import * as React from 'react';
import StoreSurface from '@/components/a2ui/StoreSurface';
import homeSurface from '@/surfaces/home.a2ui.json';
import { A2uiMessage, A2uiEvent } from '@/lib/a2ui/types';

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  priceLabel: string;
  rating: number;
  camera: string;
  storage: string;
  image: string;
}

interface HomeClientProps {
  products: Product[];
}

export default function HomeClient({ products }: HomeClientProps) {
  const [activeBrand, setActiveBrand] = React.useState<string>('All');

  const filtered = React.useMemo(
    () => (activeBrand === 'All' ? products : products.filter((p) => p.brand === activeBrand)),
    [activeBrand, products],
  );

  const messages: A2uiMessage[] = React.useMemo(
    () => [
      { updateDataModel: { surfaceId: 'home', path: '/products', value: filtered } },
      ...(homeSurface as A2uiMessage[]),
    ],
    [filtered],
  );

  const onEvent = React.useCallback((event: A2uiEvent): boolean | void => {
    if (event.name === 'filter_brand') {
      setActiveBrand((event.context?.brand as string) ?? 'All');
      return true;
    }
  }, []);

  return <StoreSurface messages={messages} onEvent={onEvent} />;
}
