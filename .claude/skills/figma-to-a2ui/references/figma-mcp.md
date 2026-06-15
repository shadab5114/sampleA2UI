# Ingest via a Figma MCP server (instead of an export file)

A Figma MCP server is a **drop-in replacement for step 1 only**. Instead of the
user handing you an exported JSON file, you call an MCP tool to fetch the node
tree live, then normalize it into the exact same Design IR
(`references/figma-ir.md`). Everything after that — IR → map → **validate gate** →
repair → emit `surfaces/<flow>.a2ui.json` — is unchanged, and
`scripts/validate-surface.mjs` is untouched. The catalog is still the contract.

```
Figma export file ─┐
                   ├─► Design IR ─► map ─► validate-surface.mjs ─► <flow>.a2ui.json
Figma MCP server  ─┘   (same IR, same gate, same output)
```

## Which MCP server

Two common options; both expose tools the skill can call. Pick based on whether
you want live selection (official) or headless file-key access (Framelink).

| | Official **Figma Dev Mode MCP** | **Framelink** (`figma-developer-mcp`) |
|---|---|---|
| Runs | Locally in the Figma **desktop app** | `npx`, headless via Figma REST API |
| Selects by | **Current selection** in Figma (or a node-id) | `fileKey` + optional `nodeId` |
| Needs | Figma desktop + Dev Mode | A Figma API token |
| Best tool for us | **`get_metadata`** — sparse XML of layer ids/names/types/positions/sizes | **`get_figma_data`** — simplified layout + styling tree |
| Other tools | `get_code`, `get_variable_defs`, `get_screenshot`, `get_code_connect_map` | `download_figma_images` |

Notes:
- Prefer the tool that returns the **node tree/metadata**, not generated code.
  Framelink's `get_figma_data` and the official `get_metadata` both map cleanly to
  the Design IR. The official `get_code` returns React/Tailwind — ignore it for
  mapping (at most a weak hint); we map to the *catalog*, not to framework code.
- `get_variable_defs` (official) returns design tokens — optional, useful if your
  catalog props reference token names.

## Configure the MCP server (Claude Code)

MCP servers are configured at the harness level, not inside this skill. Add one to
the project's `.mcp.json` (or via `claude mcp add`). Examples:

**Official Dev Mode MCP** (local HTTP server started by the Figma desktop app):
```jsonc
// .mcp.json
{
  "mcpServers": {
    "figma-devmode": { "type": "http", "url": "http://127.0.0.1:3845/mcp" }
  }
}
```

**Framelink** (stdio, headless, needs a token):
```jsonc
// .mcp.json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=${FIGMA_API_KEY}", "--stdio"]
    }
  }
}
```
Keep the token in the environment (e.g. `.env.local`), never hardcode it.

Once configured, the server's tools appear to Claude as `mcp__<server>__<tool>`
(e.g. `mcp__figma__get_figma_data`). If they're surfaced as deferred tools, load
the schema first (`ToolSearch` → `select:<tool>`), then call it.

## How the skill uses it (the only change to step 1)

1. **Resolve the target.**
   - Framelink: ask the user for the Figma `fileKey` (and `nodeId` for the
     specific frame), or accept a Figma URL and parse them out
     (`/design/<fileKey>/...?node-id=<nodeId>`).
   - Official Dev Mode: ask the user to **select the frame in Figma desktop**, or
     pass its node-id.
2. **Call the tool** to fetch the node tree
   (`get_figma_data` / `get_metadata`). Request a sensible depth so you get the
   frame's full subtree without the entire file.
3. **Normalize to the Design IR** exactly as in `references/figma-ir.md` §2. The
   field names differ slightly per server (Framelink pre-simplifies to
   layout/`children`; official `get_metadata` is sparse XML with
   names/types/positions) — map whatever you get into the IR's
   `{ ref, kind, layout, text, componentName, variants, image, children }`.
4. **Continue from step 3 of `SKILL.md` unchanged.**

## What does NOT change
- The Design IR, the IR→catalog mapping rules, and the per-design-system hints file.
- `scripts/validate-surface.mjs` — the catalog gate is source-agnostic.
- The output contract: a validated `surfaces/<flow>.a2ui.json`.

So MCP vs export is purely a sourcing choice; conformance to your catalog is
guaranteed the same way in both.
