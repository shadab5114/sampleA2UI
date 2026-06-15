---
name: figma-to-a2ui
description: Build an A2UI surface JSON for one flow from an exported Figma design, constrained to a component catalog. Use when the user wants to turn a Figma frame/export into a renderable surfaces/<flow>.a2ui.json, generate A2UI for a new design flow, or convert a design into catalog-conformant A2UI. Design-system agnostic — driven by the active catalog, not MUI.
---

# Figma → A2UI surface

Turn one exported Figma design into one **catalog-conformant** A2UI surface file.
You handle the semantic mapping (Figma → components); a deterministic script
guarantees the result obeys the catalog. The skill is generic — the catalog is
the contract, so it works for any design system, not just MUI.

## Inputs to confirm before starting

1. **Figma source** — either:
   - a path to the exported Figma JSON for this flow (a node/file dump), **or**
   - a **Figma MCP server** to fetch the node tree live. See
     `references/figma-mcp.md` — it replaces step 1 only; everything else is
     identical. If the user hasn't provided either, ask which they want.
2. **Flow name** — e.g. `checkout`; output goes to `surfaces/<flow>.a2ui.json`.
3. **Catalog(s)** — which catalog this surface targets. Default to
   `productShop/lib/catalog/mui.catalog.json`. The `catalogId` in `createSurface`
   must match (e.g. `mui`). Multiple catalogs (core + pack) are allowed.

## Procedure

### 1. Get the Figma node tree and normalize to a Design IR
Obtain the Figma node tree, then convert it into the small Design IR described in
`references/figma-ir.md` (frames→stacks via `layoutMode`, TEXT→text,
INSTANCE→component+variants, image fills→media, repeated siblings→a repeater).
Do not skip the IR step — it keeps the mapping legible.

- **From an export file:** read the provided JSON directly.
- **From a Figma MCP server:** follow `references/figma-mcp.md` — call the node-tree
  tool (e.g. `mcp__figma__get_figma_data`, or the official `get_metadata`),
  resolving the target by `fileKey`/`nodeId` or current Figma selection, then
  normalize its output into the **same** IR.

Either way, also read the active catalog. The rest of the procedure is identical.

### 2. Load design-system hints (if present)
If a `<catalogId>.figma-hints.md` exists next to the catalog, read it. It maps the
team's Figma naming conventions to catalog components/props. If absent, infer from
layer names + the catalog. This is the only design-system-specific input.

### 3. Map IR → A2UI messages
Following the rules in `references/figma-ir.md` §3, produce the three messages in
order: `updateDataModel` (seed arrays for any repeater), `updateComponents` (the
component tree), `createSurface` (`{ surfaceId, root, catalogId }`).
**Emit only components and props that exist in the catalog.** Mirror the existing
surfaces in `productShop/surfaces/*.a2ui.json` for shape and conventions (unique
ids, `children` id arrays, bindings as whole prop values, `List` + `itemTemplate`
for repeats). Write the result to `surfaces/<flow>.a2ui.json`.

### 4. Validate against the catalog — the deterministic gate (REQUIRED)
This is what guarantees catalog adherence. Run:

```bash
bun .claude/skills/figma-to-a2ui/scripts/validate-surface.mjs \
  productShop/surfaces/<flow>.a2ui.json \
  productShop/lib/catalog/mui.catalog.json
```

(Pass multiple catalog paths if the surface federates core + pack catalogs.)

- Exit 0 / `OK` → the surface conforms. Done.
- Exit 1 → a JSON `issues` list (unknown component, unknown prop, bad enum value,
  duplicate id, dangling child/root reference). **Do not hand off a failing file.**

### 5. Repair loop
For each issue, fix the offending node in the surface file — swap an unknown
component for the nearest catalog one, drop or correct an unknown prop, fix an
enum value, dedupe ids, repair child references. Re-run step 4. Repeat until it
exits 0. If an element genuinely has no catalog equivalent, map it to the closest
container and list it under "Needs catalog support" in your summary rather than
inventing a component.

### 6. Hand off
Report: the output path, a one-line tree summary, and any elements that needed a
catalog fallback (so the user can extend the catalog if wanted). Optionally suggest
rendering it through the existing `A2uiRenderer` to eyeball it.

## Guarantees & boundaries
- **Adherence is enforced by the script, not the prose.** Even if the mapping
  drifts, step 4 catches it before the file is considered done.
- **Generic:** never hardcode MUI. Everything component-specific comes from the
  catalog file(s) and the optional hints file.
- **One flow per run.** For multiple flows, run the skill once per flow; each
  produces its own `surfaces/<flow>.a2ui.json`.
- The skill does not call the Figma API — it consumes an export the user provides.
