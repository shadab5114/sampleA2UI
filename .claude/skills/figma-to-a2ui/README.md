# Adapting `figma-to-a2ui` to your own design system

This skill is design-system agnostic **by design** — the catalog is the contract.
In the common case you point it at your own catalog and change nothing else. This
README lists exactly what varies, what stays, and the few spots in
`scripts/validate-surface.mjs` you might need to touch.

---

## TL;DR

| If your design system…                                              | You change… |
|---------------------------------------------------------------------|-------------|
| has a catalog in the flat-`props` **or** `x-a2ui` schema shape       | just the catalog **path/id** (no code) |
| uses a different A2UI structural vocabulary (`slots`, `onTap`, …)    | the `RESERVED` set in `validate-surface.mjs` |
| uses a different binding shape (not `{ "path": "..." }`)             | `isBinding()` in `validate-surface.mjs` |
| stores the catalog in a third format                                | `normalizeCatalog()` in `validate-surface.mjs` |

---

## What to change

### 1. Your catalog file (always)
Provide your own `*.catalog.json` and point the skill at it. The validator already
understands **two** shapes out of the box:

- **Flat shape** (like `lib/catalog/mui.catalog.json`):
  ```jsonc
  { "Button": { "acceptsChildren": false,
      "props": { "use": { "type": "enum", "values": ["primary","secondary"] } } } }
  ```
- **A2UI `x-a2ui` schema shape** (like `docs/examples/vds-core.catalog.json`):
  ```jsonc
  { "components": { "Button": {
      "properties": { "use": { "enum": ["primary","secondary"], "x-a2ui": { "kind": "prop" } } } } } }
  ```

If your catalog is in either shape, **no code change is needed** — only the path.

### 2. The `catalogId` (always)
The `createSurface.catalogId` the skill emits must match your catalog (e.g. `mui`,
`vds-core`). Update the defaults in [`SKILL.md`](./SKILL.md) §"Inputs to confirm"
and §4 so the skill defaults to your catalog path and id instead of MUI's.

### 3. Design-system hints file (recommended, optional)
Copy [`references/catalog-hints-template.md`](./references/catalog-hints-template.md)
to `<your-catalog-dir>/<catalogId>.figma-hints.md` and fill in **your** Figma
naming conventions → component/prop mappings and your typography scale. This is
the **only** place your design-system-specific knowledge should live — keep it out
of the skill and the validator.

---

## What stays the same (do NOT fork these)

- **The pipeline** in `SKILL.md`: export → Design IR → map → validate → repair → emit.
- **The Design IR** in `references/figma-ir.md` — it's catalog-neutral.
- **The validation-gate guarantee** — always run the script after generation; the
  prose mapping can drift, the script can't.
- **`validate-surface.mjs` core logic** — unless one of the cases below applies.

---

## Changes required in `scripts/validate-surface.mjs`

Open the file and check these four spots against your A2UI dialect. For a catalog
in either supported shape with the standard A2UI message format, **all four are
already correct and you change nothing.**

### A. `RESERVED` — structural keys that are not catalog props
```js
const RESERVED = new Set([
  'id', 'component', 'children',
  'itemsPath', 'itemTemplate',   // List repeater keys
  'onPress', 'sx',
]);
```
These are keys the validator must *not* treat as catalog props. **Edit only if your
A2UI dialect uses different structural keys** — e.g. if your slot key is `slots`
instead of `children`, your action key is `onTap` instead of `onPress`, or your
repeater uses `data`/`template` instead of `itemsPath`/`itemTemplate`. Add/rename
to match. If a key is a *real* catalog prop in your system, do **not** put it here —
declare it in the catalog instead and remove it from `RESERVED`.

### B. `isBinding()` — how a data binding is recognized
```js
function isBinding(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
    && typeof v.path === 'string' && Object.keys(v).length === 1;
}
```
This matches the repo's `{ "path": "/x" }` binding. **Edit only if your bindings
use a different shape** (e.g. `{ "$bind": "/x" }` or `{ "expr": "…" }`). Bindings
are skipped during enum checks, so getting this right avoids false "invalid enum"
errors on bound props.

### C. `normalizeCatalog()` — read your catalog into the common shape
It already handles `def.props` (flat) and `def.properties` (`x-a2ui`), maps
enum values (`type:"enum"+values`, or `enum:[…]`), and treats `x-a2ui.kind` of
`slot`/`data` (and a top-level `x-a2ui.accepts`) as "accepts children". **Edit only
if your catalog is a third format** — add a branch that fills the same per-component
map: `{ props: Map<name,{enum?:string[]}>, acceptsChildren: boolean }`. Everything
downstream depends only on that normalized map, so this is the single integration
point for a new catalog format.

### D. Enum encoding (inside `normalizeCatalog`)
The two supported encodings are `{"type":"enum","values":[…]}` (flat) and
`{"enum":[…]}` (x-a2ui). **Edit only if your catalog encodes allowed values
differently** (e.g. `oneOf`, `options`) — map them into the `enum` array the
checker reads.

> Things you should **not** need to touch: the structural checks (unique ids,
> root/children reference resolution, message-shape validation) and the exit-code
> contract (`0` = clean, `1` = issues JSON, `2` = bad usage). Those are dialect-
> independent.

---

## Quick verification after adapting

Run the gate against one of your own known-good surfaces; expect `OK`:

```bash
bun .claude/skills/figma-to-a2ui/scripts/validate-surface.mjs \
  <your-surface>.a2ui.json <your-catalog>.json
```

If a known-good surface reports issues, that's usually a **real catalog gap**
(a prop the design uses but the catalog never declared) — fix the catalog, not the
validator. (That's exactly how this gate surfaced the missing `Avatar.variant`
prop in this repo's `cart.a2ui.json`.)
