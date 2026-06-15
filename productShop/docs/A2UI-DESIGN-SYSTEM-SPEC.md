# Making `@ds/core` A2UI-Compatible — Library Spec

> **Audience:** the `@ds/core` design-system team.
> **Goal:** add a small, mostly-additive layer of metadata to our component schemas and catalog so that
> **any A2UI runtime can drive our components with zero per-component glue.**
>
> _(Replace `@ds/core` with the real package name throughout.)_
>
> **Multiple packages?** This spec covers a *single* package. For a core library **plus expansion packs**
> (federation, name collisions, precedence, adopter setup), see
> [`A2UI-MULTI-PACKAGE-GUIDE.md`](A2UI-MULTI-PACKAGE-GUIDE.md).

---

## 1. Background — what A2UI needs from a design system

A2UI is a protocol where a backend describes UI as **JSON** — a tree of component nodes, a data model,
and actions — which a client renders into real components. A single A2UI **node** looks like:

```jsonc
{
  "id": "faq",
  "component": "Accordion",        // ← a component NAME from our catalog
  "behavior": "singleOpen",        // ← a literal prop value
  "items": { "path": "/faqs" },    // ← a DATA BINDING into the data model
  "children": ["item1", "item2"]   // ← STRUCTURAL slot: ids of child nodes
}
```

For a runtime to generate and render this against our library, it needs three things from us:

1. **A catalog** — the list of components and their props (we already generate `catalog.json` from our zod schemas).
2. **Per-component validation** — our zod schemas, used to validate generated output.
3. **Classification metadata** — *the missing piece*: for each prop, **which of four A2UI "kinds" it is**, plus
   each component's composition rules.

This spec defines #3 and the small changes to #1/#2 that make the whole thing mechanical for adopters.

> Because A2UI is JSON, **not every prop maps across directly.** Functions and ReactNodes can't be
> serialized; data arrays and composition need explicit typing. The classification below tells adopters
> exactly how to handle each prop without guessing.

---

## 2. The core concept — the 4 A2UI prop kinds

Every prop of every component is exactly one of these from A2UI's point of view:

| `kind` | What it is | Examples | How A2UI carries it | Adopter handling |
|---|---|---|---|---|
| `prop` | a serializable scalar | `surface`, `behavior`, `padding`, `disabled` | literal, or `{ "path": "/x" }` binding | resolve & pass through; validate against the prop schema |
| `data` | a serializable structured array/object | `items` (array of item configs) | bound array `{ "path": "/faqs" }`, or inline array | resolve & pass through; validate each element against `itemComponent`'s schema |
| `event` | a handler / function | `trigger`, click handlers | an A2UI event `{ "event": { "name", "context" } }` | convert the event to a function when instantiating the component; **skip in prop validation** |
| `slot` | ReactNode composition | `children` (composed components) | the structural `children: [ids]` slot | render the child nodes, pass as React `children`; **skip in prop validation** |

This single classification is what lets an adopter write **one generic renderer and one generic validator**
for **all** components instead of special-casing each one.

---

## 3. What to change (3 changes — mostly additive, non-breaking)

### Change 1 — tag every prop with its A2UI kind
Add `a2ui` metadata to each prop (mechanism in §5). Existing React prop types are unchanged.

### Change 2 — tag every component with its role + composition
Mark each component `main` or `child`, and declare what it `accepts` / what it is a `childOf`.

### Change 3 — type data props precisely _(the one semantic change)_
Replace `z.array(z.any())` with `z.array(ChildSchema)` (e.g. `z.array(AccordionItemSchema)`).
This gives consumers **free nested validation** and an explicit machine link to the child schema — and it's
more correct typing for our React consumers too.

> Changes 1 & 2 are pure additive metadata (zero behavioral impact). Change 3 is stricter typing that
> only *adds* safety. **No breaking changes to the React API.**

---

## 4. The `x-a2ui` metadata reference (the spec)

This is the contract. Emit it on every component and prop.

### Component-level
```jsonc
"x-a2ui": {
  "role": "main" | "child",      // main = top-level composable; child = only inside specific parents
  "accepts": ["AccordionItem"],  // (main/containers) child component names allowed in its slot
  "childOf": ["Accordion"],      // (children) parent component names it may appear in
  "category": "disclosure"       // optional — grouping for prompt organization
}
```

### Prop-level
```jsonc
"x-a2ui": {
  "kind": "prop" | "data" | "event" | "slot",   // REQUIRED
  "bindable": true,             // (prop/data) may take a {path} data-model binding
  "itemComponent": "AccordionItem",  // (data) the schema each array element conforms to
  "accepts": ["AccordionItem"]       // (slot) child component names allowed
}
```

### Authoring rule (decide a prop's kind)
- Scalar enum / boolean / string / number, presentational → **`prop`**
- Array / object of structured config → **`data`** (type it `z.array(ChildSchema)`, set `itemComponent`)
- Function / handler → **`event`**
- ReactNode / children / composition → **`slot`** (set `accepts`)

---

## 5. How to attach the metadata

### Preferred — zod 4 (`.meta()` + `z.toJSONSchema()`)
zod 4 carries `.meta()` straight into the generated JSON Schema, so `catalog.json` gets `x-a2ui` for free.

```js
import { z } from 'zod';

behavior: z.enum(['multiOpen', 'singleOpen'])
  .describe('Controls accordion behavior.')
  .meta({ a2ui: { kind: 'prop' } }),
```

> If we're on **zod 3** (no `.meta()`), ship a **sidecar metadata map** per component and merge it in the
> catalog generator:
> ```js
> // Accordion.meta.js
> export const AccordionMeta = {
>   _component: { role: 'main', accepts: ['AccordionItem'] },
>   behavior:   { kind: 'prop' },
>   items:      { kind: 'data', bindable: true, itemComponent: 'AccordionItem' },
>   trigger:    { kind: 'event' },
>   children:   { kind: 'slot', accepts: ['AccordionItem'] },
> };
> ```
> Same end result in `catalog.json`. Consider a zod 4 bump to avoid the sidecar.

---

## 6. Worked example — `Accordion` / `AccordionItem`

Files stay **one component per file** (unchanged). The only new line is the cross-file import that
`items: z.array(AccordionItemSchema)` requires.

```js
// schemas/AccordionItem.js  — references no siblings
import { z } from 'zod';

export const AccordionItemSchema = z.object({
  header:           z.enum(['h1','h2','h3','h4','h5','h6','div']).describe('Heading level for the item header.').meta({ a2ui: { kind: 'prop' } }),
  triggerElement:   z.enum(['icon','link']).describe('Trigger element type.').meta({ a2ui: { kind: 'prop' } }),
  triggerAlignment: z.enum(['top','middle']).describe('Vertical alignment of the trigger.').meta({ a2ui: { kind: 'prop' } }),
  trigger:          z.function().describe('Trigger button config + click handler.').optional().meta({ a2ui: { kind: 'event' } }),
  children:         z.any().describe('Expanded content of the item.').meta({ a2ui: { kind: 'slot' } }),
  alwaysOpen:       z.boolean().optional().meta({ a2ui: { kind: 'prop' } }),
  opened:           z.boolean().optional().meta({ a2ui: { kind: 'prop', bindable: true } }),
  viewport:         z.enum(['desktop','tablet','mobile']).optional().meta({ a2ui: { kind: 'prop' } }),
  disabled:         z.boolean().optional().meta({ a2ui: { kind: 'prop', bindable: true } }),
}).meta({ a2ui: { role: 'child', childOf: ['Accordion'] } });
```

```js
// schemas/Accordion.js  — imports the child schema for `items`
import { z } from 'zod';
import { AccordionItemSchema } from './AccordionItem';   // ← the one new line

export const AccordionSchema = z.object({
  surface:   z.enum(['lightPrimary','lightSecondary','darkPrimary','darkSecondary']).describe('Surface token.').meta({ a2ui: { kind: 'prop' } }),
  padding:   z.enum(['standard','compact']).describe('Item padding.').meta({ a2ui: { kind: 'prop' } }),
  behavior:  z.enum(['multiOpen','singleOpen']).describe('Open behavior.').meta({ a2ui: { kind: 'prop' } }),
  viewport:  z.enum(['desktop','tablet','mobile']).optional().describe('Force viewport.').meta({ a2ui: { kind: 'prop' } }),
  width:     z.union([z.string(), z.number()]).optional().describe('Container width.').meta({ a2ui: { kind: 'prop' } }),
  id:        z.string().optional().describe('Custom wrapper id.').meta({ a2ui: { kind: 'prop' } }),

  // CHANGE 3 — precise typing → free nested validation + composition link
  items:     z.array(AccordionItemSchema).optional()
               .describe('Data-driven accordion items.')
               .meta({ a2ui: { kind: 'data', bindable: true, itemComponent: 'AccordionItem' } }),

  // slot — composed AccordionItem components
  children:  z.any().describe('Composed AccordionItem components.')
               .meta({ a2ui: { kind: 'slot', accepts: ['AccordionItem'] } }),
}).meta({ a2ui: { role: 'main', accepts: ['AccordionItem'] } });
```

> **Dual pattern preserved.** `items` = the **data-driven** API (array of item configs, bindable);
> `children` = the **composable** API (child `AccordionItem` components). A2UI supports both —
> `items` via a data binding, `children` via the structural slot.
>
> **No circular dependency:** `Accordion → AccordionItem` is one-directional. `AccordionItem`'s
> `childOf: ['Accordion']` is a *string in metadata*, not a schema import. (If a genuine mutual schema
> reference is ever needed, break the cycle with `z.lazy(() => …)`.)

---

## 7. Package structure & exports

```
@ds/core/
  schemas/
    Accordion.js        # one component per file (unchanged)
    AccordionItem.js
    …                   # ~80 components
    index.js            # re-exports + the `schemas` registry map
  catalog.json          # generated from the schemas (now includes x-a2ui)
```

```js
// schemas/index.js
export { AccordionSchema }     from './Accordion';
export { AccordionItemSchema } from './AccordionItem';
// … the rest

import { AccordionSchema }     from './Accordion';
import { AccordionItemSchema } from './AccordionItem';

/** name → schema. Consumers iterate this for validation; the generator iterates it for catalog.json. */
export const schemas = {
  Accordion: AccordionSchema,
  AccordionItem: AccordionItemSchema,
  // …
};
```

The package must export, at minimum:
- **`catalog.json`** — with `x-a2ui` on components and props (the agent/prompt source).
- **`schemas` registry** (`name → zod schema`) — the validation source.
- **TypeScript types** for the `x-a2ui` metadata (below), so tooling is typed.

```ts
// types
export type A2uiKind = 'prop' | 'data' | 'event' | 'slot';
export interface A2uiPropMeta { kind: A2uiKind; bindable?: boolean; itemComponent?: string; accepts?: string[]; }
export interface A2uiComponentMeta { role: 'main' | 'child'; accepts?: string[]; childOf?: string[]; category?: string; }
```

---

## 8. Generated `catalog.json` (target shape)

```jsonc
"Accordion": {
  "type": "object",
  "description": "Expandable/collapsible content sections …",
  "x-a2ui": { "role": "main", "accepts": ["AccordionItem"] },
  "properties": {
    "behavior": { "type": "string", "enum": ["multiOpen","singleOpen"], "description": "…", "x-a2ui": { "kind": "prop" } },
    "items":    { "type": "array", "description": "…", "x-a2ui": { "kind": "data", "bindable": true, "itemComponent": "AccordionItem" } },
    "trigger":  { "description": "…", "x-a2ui": { "kind": "event" } },
    "children": { "description": "…", "x-a2ui": { "kind": "slot", "accepts": ["AccordionItem"] } }
  }
}
```

---

## 9. How consumers use this (so we know our contract is right)

Adopters need only two generic helpers once `x-a2ui` exists. We **should ship these in a companion
package** (`@ds/a2ui`) so adopters get them for free.

**Generic renderer** — one function, all components:
```tsx
const RESERVED = new Set(['id', 'component', 'children']);
const isBinding = (v) => v && typeof v === 'object' && 'path' in v;

function renderNode(node, scope, ctx) {
  const spec = catalog.components[node.component];
  const props = {};
  for (const [key, value] of Object.entries(node)) {
    if (RESERVED.has(key)) continue;
    const kind = spec.properties[key]?.['x-a2ui']?.kind;
    if (kind === 'prop' || kind === 'data') props[key] = resolveBinding(value, scope); // literal or {path}
    else if (kind === 'event')              props[key] = () => ctx.dispatch(value.event); // event → fn
    // 'slot' handled by children-ids below
  }
  props.children = (node.children ?? []).map((id) => renderNode(ctx.byId[id], scope, ctx));
  const Comp = ctx.componentMap[node.component];   // name → our React component
  return <Comp {...props} />;
}
```

**Generic validator** — per-prop, A2UI-aware:
```ts
import { schemas } from '@ds/core/schemas';

function validateNode(node) {
  const schema = schemas[node.component];
  const errs = [];
  if (!schema) return [`unknown component "${node.component}"`];
  for (const [key, value] of Object.entries(node)) {
    if (RESERVED.has(key)) continue;
    if (isBinding(value)) continue;                       // resolved at runtime
    const propSchema = schema.shape[key];
    if (!propSchema) { errs.push(`unknown prop "${key}" on ${node.component}`); continue; }
    const kind = catalog.components[node.component].properties[key]?.['x-a2ui']?.kind;
    if (kind === 'event' || kind === 'slot') continue;    // not literal props
    const r = propSchema.safeParse(value);
    if (!r.success) errs.push(`invalid "${key}" on ${node.component}: ${r.error.issues[0]?.message}`);
    // For kind === 'data', recurse each element against schemas[itemComponent].
  }
  return errs;
}
```

Composition correctness (`AccordionItem` only inside `Accordion`) is enforced from `role` / `accepts` /
`childOf` — no per-component code.

---

## 10. Authoring checklist (for every new/updated component)

- [ ] Component-level `x-a2ui` set: `role`, and `accepts` (main) or `childOf` (child).
- [ ] **Every** prop has `x-a2ui.kind`.
- [ ] Data props are typed `z.array(ChildSchema)` (not `z.any()`), with `itemComponent` set.
- [ ] Function/handler props marked `kind: 'event'`.
- [ ] ReactNode/children props marked `kind: 'slot'` with `accepts`.
- [ ] Bindable scalar/data props marked `bindable: true`.
- [ ] Every prop has a concise `.describe()` (it feeds the generation prompt; keep it one line).
- [ ] Component exported from `schemas/index.js` and added to the `schemas` registry.
- [ ] `catalog.json` regenerated and includes the `x-a2ui` fields.

---

## 11. Rollout

1. **Additive metadata first** (Changes 1 & 2) across all ~80 components — no behavior change, ship anytime.
2. **Tighten data props** (Change 3) — schedule with a minor version bump (stricter typing).
3. **Publish the companion** `@ds/a2ui` (generic renderer + validator + `x-a2ui` types).
4. Adopting an A2UI app then becomes: `install @ds/core @ds/a2ui` → write the `name → React component`
   map → done.

### Definition of done (a component is "A2UI-compatible")
Its catalog entry carries complete `x-a2ui` (component role + a `kind` on every prop), its data props are
typed to child schemas, and the generic validator accepts a hand-written sample A2UI node for it.
