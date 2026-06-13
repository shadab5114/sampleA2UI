// Core A2UI v0.9 message + node model (catalog-agnostic).
// Mirrors the SampleA2UI reference repo's normalized v0.9 shape, but the
// component catalog is MUI (see lib/catalog/mui.catalog.json).

export type Binding = { path: string };

export type PropValue =
  | string
  | number
  | boolean
  | null
  | Binding
  | PropValue[]
  | { [key: string]: PropValue };

export interface A2uiEvent {
  name: string;
  context?: Record<string, PropValue>;
}

export interface ActionProp {
  event: A2uiEvent;
}

// A component node. `id` and `component` are reserved; everything else is a prop
// (a literal, a Binding `{ path }`, a child-id array, or an action `{ event }`).
export interface ComponentNode {
  id: string;
  component: string;
  [prop: string]: unknown;
}

export interface CreateSurface {
  surfaceId: string;
  root: string;
  catalogId?: string;
}

export interface UpdateComponents {
  surfaceId: string;
  components: ComponentNode[];
}

export interface UpdateDataModel {
  surfaceId: string;
  path: string;
  value: unknown;
}

export type A2uiMessage =
  | { createSurface: CreateSurface }
  | { updateComponents: UpdateComponents }
  | { updateDataModel: UpdateDataModel };

export interface SurfaceState {
  surfaceId: string | null;
  rootId: string | null;
  components: Record<string, ComponentNode>;
  dataModel: Record<string, unknown>;
}

export function isBinding(v: unknown): v is Binding {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof (v as Binding).path === 'string' &&
    Object.keys(v as object).length === 1
  );
}
