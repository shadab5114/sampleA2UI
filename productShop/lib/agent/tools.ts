import type { ToolDef } from './llm/types';
import products from '@/lib/data/products.json';

export interface SearchParams {
  brand?: string;
  maxPrice?: number;
  minPrice?: number;
  minRating?: number;
  query?: string;
}

// Provider-agnostic tool definition — each adapter wraps this into its own format.
export const searchProductsTool: ToolDef = {
  name: 'search_products',
  description:
    'Search the PhoneHub inventory. Call this before generating any UI so you ground on real data. Returns matching products.',
  parameters: {
    type: 'object',
    properties: {
      brand: {
        type: 'string',
        description: 'Exact brand name to filter by (e.g. "Apple", "Google", "Samsung")',
      },
      maxPrice: {
        type: 'number',
        description: 'Maximum price in GBP (inclusive)',
      },
      minPrice: {
        type: 'number',
        description: 'Minimum price in GBP (inclusive)',
      },
      minRating: {
        type: 'number',
        description: 'Minimum star rating, 0–5 (inclusive)',
      },
      query: {
        type: 'string',
        description: 'Free-text search on product name or brand',
      },
    },
  },
};

export function executeSearchProducts(params: SearchParams) {
  let results = [...products];

  if (params.brand) {
    results = results.filter(
      (p) => p.brand.toLowerCase() === params.brand!.toLowerCase(),
    );
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
    );
  }
  if (params.maxPrice !== undefined) {
    results = results.filter((p) => p.price <= params.maxPrice!);
  }
  if (params.minPrice !== undefined) {
    results = results.filter((p) => p.price >= params.minPrice!);
  }
  if (params.minRating !== undefined) {
    results = results.filter((p) => p.rating >= params.minRating!);
  }

  return results;
}
