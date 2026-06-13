// ─────────────────────────────────────────────────────────────────────────────
// AGUI ↔ A2UI contract.
//
// "AGUI decides, A2UI materializes." The reasoner (lib/agui/reasoner.ts) decides
// WHAT to surface and produces an AguiDecision. The materializer
// (lib/a2ui/materializer.ts) consumes that decision and produces A2UI messages.
//
// This file is the seam between the two layers — neither imports the other,
// they only agree on these types.
// ─────────────────────────────────────────────────────────────────────────────

import { ChannelContext, JourneyStep } from '@/lib/context/channelContext';

/** What the user is trying to do — classified by the reasoning layer. */
export type AguiIntent =
  | 'browse'
  | 'search'
  | 'detail'
  | 'compare'
  | 'cart_confirm'
  | 'empty';

/** A product as stored in the catalog / returned by search_products. */
export interface Product {
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

/** Structured cart snapshot passed from the chat UI on action events. */
export interface CartItemData {
  id: string;
  name: string;
  qty: number;
  price: number;
  priceLabel: string;
  qtyLabel: string; // "Qty: 2"
  lineTotal: string; // "£1,598.00"
}

/**
 * The decision the AGUI reasoner emits. It contains everything the materializer
 * needs to build a surface — already grounded on real data — but ZERO UI.
 */
export interface AguiDecision {
  intent: AguiIntent;
  /** Short headline the surface should lead with, e.g. "Phones under £500". */
  headline: string;
  /** Optional one-line assistant note. */
  note?: string;
  /** Products to surface (resolved from search_products results). */
  products: Product[];
  /** Cart snapshot — present when intent is 'cart_confirm'. */
  cart?: { items: CartItemData[]; total: string };
  /** Journey step this decision corresponds to. */
  journeyStep: JourneyStep;
  /** Echoes the channel context so the materializer can adapt. */
  context: ChannelContext;
}

/**
 * The compact JSON the reasoner LLM is asked to emit. Products are referenced by
 * id (resolved against real search results in code) so the model never has to
 * transcribe product data — it only reasons about WHICH items and WHY.
 */
export interface RawDecision {
  intent: AguiIntent;
  headline: string;
  note?: string;
  /** Ids to surface; omit to include all search results. */
  productIds?: string[];
  journeyStep?: JourneyStep;
}
