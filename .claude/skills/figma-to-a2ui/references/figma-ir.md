# Figma JSON → Design IR → A2UI

This skill never maps raw Figma JSON straight to A2UI. It first normalizes the
export into a small **Design IR** (intermediate representation), then maps the IR
to catalog components. The IR step is what keeps the mapping legible and the skill
generic across design systems — only the IR→catalog step knows about a catalog,
and even that is data-driven (it reads the catalog, never hardcodes it).

## 1. What a Figma export looks like

A Figma node export (REST `GET /v1/files/:key/nodes` or a plugin dump) is a tree:

```jsonc
{
  "document": {
    "type": "FRAME", "name": "Product Card",
    "layoutMode": "VERTICAL",        // auto-layout → a stack
    "itemSpacing": 8, "paddingLeft": 16,
    "children": [
      { "type": "TEXT", "name": "Title", "characters": "Pixel 9",
        "style": { "fontWeight": 600, "fontSize": 16 } },
      { "type": "INSTANCE", "name": "Button/Primary",
        "componentProperties": { "Label": { "value": "Add" }, "Use": { "value": "primary" } } }
    ]
  }
}
```

Fields that matter: `type`, `name`, `layoutMode`, `itemSpacing`, padding, `characters`,
`style`, `componentProperties` (on INSTANCE nodes), `componentId`, and `children`.

## 2. Normalize to Design IR

Each Figma node becomes one IR node:

```jsonc
{
  "ref": "Product Card",          // from Figma name (used to derive a stable id)
  "kind": "frame|text|instance|image|vector|group",
  "layout": { "direction": "row|column", "gap": 8, "align": "...", "justify": "..." },
  "text": "Pixel 9",              // for TEXT nodes
  "componentName": "Button/Primary",   // INSTANCE: the master component name
  "variants": { "Use": "primary", "Size": "large" },  // from componentProperties
  "image": true,                  // has an image fill / is a media placeholder
  "children": [ ...IR nodes... ]
}
```

Normalization rules:

| Figma                                   | IR                                              |
|-----------------------------------------|-------------------------------------------------|
| `FRAME`/`GROUP` with `layoutMode`       | `frame` with `layout.direction` (VERTICAL→column, HORIZONTAL→row) |
| `FRAME` without auto-layout             | `frame`, `layout: null` (absolute — flag it)    |
| `TEXT`                                  | `text` node, carry `characters` + weight/size   |
| `INSTANCE`                              | `instance`, carry master `name` + `componentProperties` as `variants` |
| `RECTANGLE`/`FRAME` with image fill     | `image`                                          |
| `itemSpacing` / padding                 | `layout.gap` (used to pick a spacing prop)       |

Keep names verbatim — they are the strongest mapping signal.

## 3. Map IR → catalog components (the LLM step)

This is the only step that consults the catalog. Read the active catalog (the
flat `*.catalog.json` props map, or the `x-a2ui` schema form) and, for each IR
node, choose the catalog component whose **role/category and props best fit**:

- A frame with `layout.direction` → the catalog's stack/row layout component
  (e.g. `Stack` with `direction`), or a top-level container for the root frame.
- A `text` node → the catalog's text component (e.g. `Typography`); map font
  weight/size to whatever `variant`/`fontWeight` props the catalog actually exposes.
- An `instance` named like a catalog component (`Button/Primary` → `Button`) →
  that component. Map Figma `variants` to catalog enum props **only where the
  enum value exists** (e.g. `Use=primary` → `use: "primary"` if `use` has that enum).
- An `image` → the catalog's media component.
- Repeated sibling frames with identical structure → a single repeater
  (`List` + `itemTemplate`) plus an `updateDataModel` seeding the array. Never
  emit N near-identical hardcoded nodes.

**Hard rules for this step:**
1. Emit ONLY components and props that exist in the catalog. If a Figma element has
   no catalog equivalent, pick the closest container and add a `// TODO` note in
   your hand-off summary — do not invent a component or prop.
2. Every `id` unique across the surface; `children` are id arrays; bindings are the
   whole prop value (`{ "path": "/x" }`), never embedded in a string.
3. Output the standard three messages in order: `updateDataModel` (if any data),
   then `updateComponents`, then `createSurface` with the right `catalogId`.

## 4. Per-design-system hints

If a `*.figma-hints.md` exists next to the catalog (see `catalog-hints-template.md`),
load it. It maps that team's Figma naming conventions to catalog components and is
the only place design-system-specific knowledge lives.
