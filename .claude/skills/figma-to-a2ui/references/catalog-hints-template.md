# Figma → catalog hints: <design-system-id>

Optional, per-design-system. Copy this to `lib/catalog/<catalogId>.figma-hints.md`
(or wherever the catalog lives) and fill it in. The skill loads it during the
IR→catalog mapping step. This is the ONLY place design-system-specific knowledge
belongs — the skill and the validator stay generic.

## Layer-name → component map

How this team names Figma layers/components, and which catalog component each maps to.

| Figma name pattern        | Catalog component | Notes                              |
|---------------------------|-------------------|------------------------------------|
| `Button/Primary`          | `Button`          | variant `Use=primary` → `use`      |
| `Button/Secondary`        | `Button`          | `Use=secondary`                    |
| `Card/*`                  | `Card`            | wrap content in `CardContent`      |
| `Heading/*`, `Title`      | `Typography`      | map size → `variant` (h4/h5/h6)    |
| `Body/*`, `Caption`       | `Typography`      | `variant` body1/body2/caption      |
| `Chip/*`, `Tag/*`         | `Chip`            |                                    |
| `Image`, `Thumbnail`      | `CardMedia`       |                                    |

## Variant → prop map

| Figma componentProperty | Catalog prop | Value mapping                  |
|-------------------------|--------------|--------------------------------|
| `Use`                   | `use`        | primary→primary, etc.          |
| `Size`                  | `size`       | small→small, large→large       |
| `State=disabled`        | `disabled`   | true                           |

## Typography scale → variant

| Figma font size | Catalog `variant` |
|-----------------|-------------------|
| ≥ 28            | h4                |
| 20–27           | h5                |
| 16–19           | subtitle1 / h6    |
| 14–15           | body2             |
| ≤ 12            | caption           |

## Things to ignore

- Pure decoration layers (shadows, dividers with no semantic role) unless the
  catalog has a matching component.
- Absolute-positioned frames — flatten into the nearest auto-layout parent.
