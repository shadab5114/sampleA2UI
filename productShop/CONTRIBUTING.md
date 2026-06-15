# Contributing & Scaling Guide

How to **change, extend, and scale** PhoneHub without breaking its core architecture — written for
both humans and AI agents.

Read alongside:
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how it works (flows, lifecycle, file map).
- [`API.md`](API.md) — the client/API contract (for web + native).
- [`docs/A2UI-DESIGN-SYSTEM-SPEC.md`](docs/A2UI-DESIGN-SYSTEM-SPEC.md) — how a design-system library makes itself A2UI-compatible (the `x-a2ui` metadata the consumer side below reads).
- [`docs/A2UI-MULTI-PACKAGE-GUIDE.md`](docs/A2UI-MULTI-PACKAGE-GUIDE.md) — core + expansion packs: catalog federation, collision resolution, and how adopters wire multiple packages into one app.

> **The golden rule:** this codebase is built so that **almost every change is additive and lands in
> exactly one place.** If your change requires editing the shared engine, the protocol, or the API
> contract — stop and re-read §1 and §4 first. You are probably about to touch something that ripples.

---

## Table of contents
1. [Core invariants — DO NOT BREAK](#1-core-invariants--do-not-break)
2. [Where changes live — decision matrix](#2-where-changes-live--decision-matrix)
3. [Recipes — "if you implement X, do Y"](#3-recipes)
4. [Danger zones — think before you change](#4-danger-zones--think-before-you-change)
5. [Verification & QA checklist](#5-verification--qa-checklist)
6. [Scaling roadmap (org-wide)](#6-scaling-roadmap-org-wide)
7. [Notes for AI agents](#7-notes-for-ai-agents)

---

## 1. Core invariants — DO NOT BREAK

These are the load-bearing walls. Each says **the rule**, **why**, and **what breaks if you violate it**.

| # | Invariant | Why / what breaks |
|---|---|---|
| 1 | **One renderer, two flows.** `components/a2ui/StoreSurface.tsx` is the *single* convergence point. Never add a parallel renderer for one flow. | Both the website and chat render through the same path. A second renderer = two code paths that drift; "change once, both flows change" is lost. |
| 2 | **The protocol is a versioned contract.** `lib/a2ui/types.ts` + `schema.ts` define `A2uiMessage` / bindings. Changing their shape is a breaking change. | Every client (web + native) parses this. A casual change breaks shipped mobile apps. Bump `PROTOCOL_VERSION` and update `API.md` if you must change it. |
| 3 | **Catalog = single source of truth, with parity.** Every component the agent can emit must exist in `lib/catalog/mui.catalog.json` **and** have a renderer in `componentMap.tsx`. | If they disagree, the agent emits components that can't render (blank UI) or the catalog advertises things that don't exist. `assertCatalogParity` warns in dev. |
| 4 | **AGUI decides, A2UI materializes.** `lib/agui/reasoner.ts` returns an `AguiDecision` and **no UI**. `lib/a2ui/materializer.ts` returns UI and does **no reasoning/tool calls**. | This split lets you reuse reasoning across channels and swap materialization per platform. Fusing them back makes every channel a rewrite. |
| 5 | **Layout adaptation is deterministic — not the LLM's job.** The agent emits a *canonical* surface; `lib/a2ui/layout.ts` adapts columns/width. | LLM-driven responsive math is inconsistent, costly, and unvalidatable. The agent must never branch on column counts. |
| 6 | **The agent is provider-agnostic.** OpenAI/Anthropic SDKs appear **only** in `lib/agent/llm/`. | The rest of the agent talks to the `LLMProvider` interface. Importing an SDK elsewhere locks you to one vendor. |
| 7 | **Catalog access is async + swappable.** Always go through `catalogProvider` (`lib/catalog/provider.ts`). | This is what lets you point at a remote MCP server (`mcp.designsystem.com`) with zero code change. Reading the JSON directly bypasses it. |
| 8 | **The API core is framework-agnostic.** `lib/api/agentService.ts`, `lib/agui/*`, `lib/a2ui/*`, `lib/agent/*`, `lib/catalog/*`, `lib/context/*` must have **no Next.js / React imports**. | This is what makes the backend consumable by native / standalone deploys. A `next/*` import here re-couples you to the web app. |
| 9 | **Bindings are the WHOLE value of a prop.** `"text": { "path": "/total" }` — never `"text": "Total: {path:'/total'}"`. | Embedded bindings render literally (the cart-total bug). Label + value = two components. |
| 10 | **`formFactor` is client-declared; the server adapts.** Default `desktop`. The agent emits canonical (widest). | Native clients declare their device and render verbatim. If the agent pre-collapses, clients can't reflow. |

---

## 2. Where changes live — decision matrix

90% of changes map to one row. Find the *nature* of your change; go to the **start file**; heed **careful**.

| Nature of change | Start in | Careful |
|---|---|---|
| How a component **looks** (card, button, spacing) | `components/a2ui/componentMap.tsx` | Affects **both** flows (invariant 1). |
| **Add a component** to the system | `lib/catalog/mui.catalog.json` **+** `componentMap.tsx` | Keep parity (invariant 3). |
| **What the agent decides** (intent, which products) | `lib/agui/reasonerPrompt.ts` | Don't make it emit UI (invariant 4). |
| **How the agent builds** a surface | `lib/a2ui/materializerPrompt.ts` | Bindings rule (invariant 9); no layout math (invariant 5). |
| A **static page** | `surfaces/*.a2ui.json` + its `app/(store)/.../page.tsx` | Use catalog components only. |
| **New agent capability/tool** (e.g. orders) | `lib/agent/tools.ts` (+ data source) | Tool returns data, not UI. |
| **Layout reflow rules** per device | `lib/a2ui/layout.ts` (`PROFILES`) | Single-column lists must stay 1 (see `adaptNode`). |
| **Add/rename a channel or form factor** | `lib/context/channelContext.ts` | `FormFactor` change ripples to `layout.ts` + `API.md`. |
| **Inventory / data** | `lib/data/products.json` | Shape feeds both flows + `search_products`. |
| **A new event/action** | `StoreSurface.tsx` `dispatch`, or a page's `onEvent` | Document it in `API.md` §5 so native implements it. |
| **The API request/response shape** | `lib/api/contract.ts` (+ `agentService.ts`) | Breaking change → version it; update `API.md` (invariant 2/8). |
| **Swap the design system** | new `componentMap` + catalog source | See Recipe F — the one genuinely cross-cutting change. |
| **LLM provider** | `.env.local` `LLM_PROVIDER` (code in `lib/agent/llm/`) | Only active provider's key needed. |
| **Catalog source** (bundled ↔ MCP) | `.env.local` `CATALOG_PROVIDER` / `MCP_URL` | `mcp` needs the server running. |

---

## 3. Recipes

Each recipe: **Goal → Steps → Verify → Don't touch.**

### A. Add a new component (e.g. `Tooltip`)
1. Add its entry (props, types, enums, `bindable`) to `lib/catalog/mui.catalog.json`.
2. Add a renderer in `components/a2ui/componentMap.tsx` mapping the name → the MUI (or DS) component.
3. (Optional) Mention it in `materializerPrompt.ts` if the agent should use it.
- **Verify:** dev console shows no `assertCatalogParity` warning; render a test surface using it; the MCP server serves the new spec automatically.
- **Don't touch:** the protocol, the renderer core (`A2uiRenderer`, `useSurface`).

### B. Add a deterministic page / flow
1. Author `surfaces/<name>.a2ui.json` using catalog components (copy `surfaces/product.a2ui.json` as a template).
2. Add `app/(store)/<name>/page.tsx` that seeds the data model and renders `<StoreSurface messages={...} />`.
3. (Optional) Add nav entry in `app/(store)/layout.tsx`.
- **Verify:** the page renders; toggle **"Show A2UI JSON"** to confirm the surface; layout adapts on channel switch.
- **Don't touch:** the agent, the renderer core.

### C. Add a conversational capability (new domain intent, e.g. "track my order")
1. Add a tool in `lib/agent/tools.ts` (definition + executor over a data source).
2. Teach the reasoner the new intent in `lib/agui/reasonerPrompt.ts` (+ add it to `AguiIntent` in `lib/agui/types.ts` and the validator in `reasoner.ts`).
3. Teach the materializer how to render that intent in `lib/a2ui/materializerPrompt.ts` (ideally point it at a template — see Recipe E).
- **Verify:** `curl` the API with a sample prompt; check the **AGUI decided** trace shows the new intent; confirm the surface renders.
- **Don't touch:** the API contract (unless adding new request fields → then version it).

### D. Add an agent tool only (data, no new intent)
1. Define `ToolDef` + executor in `lib/agent/tools.ts`.
2. Pass it into the reasoner's tool list in `lib/agui/reasoner.ts`.
- **Verify:** the reasoner calls it (log/inspect); products/data resolve correctly.
- **Don't touch:** the materializer (tools belong to the reasoner only — invariant 4).

### E. Add a reusable surface template (recommended as flows grow)
1. Define the fragment once (a card, a form, a list row) in a shared place (a `surfaces/templates/` or a TS builder).
2. Reference it from deterministic surfaces and from `materializerPrompt.ts` (have the agent *assemble templates* rather than free-author).
- **Verify:** both a static page and a chat surface using the template render identically.
- **Why it matters:** templates make flows additive AND cut cost — known intents can skip the second LLM call. See §6.

### F. Swap the design system (MUI → your DS)  ⚠️ the one cross-cutting change
1. Point the catalog at your DS: `.env.local` → `CATALOG_PROVIDER=mcp`, `MCP_URL=https://mcp.designsystem.com/mcp` (or `import catalog from "@ds/core/catalog.json"` in a `DsCatalogProvider`).
2. Write the **`componentMap`** mapping catalog names → your DS components.
3. Map your theme/design tokens.
4. Wire **validation** to the DS's zod schemas (`schemas[node.component]`) instead of the hand-rolled `validate.ts`.
- **Verify:** every existing surface still renders.
- **Don't touch:** the protocol, the agent, the flows, the API — none of them know about MUI. If you find yourself editing them, you've coupled something that shouldn't be.

**If the DS ships `x-a2ui` metadata** (see [`docs/A2UI-DESIGN-SYSTEM-SPEC.md`](docs/A2UI-DESIGN-SYSTEM-SPEC.md)), this gets dramatically cheaper — the per-component work collapses into **two generic helpers**:
- **Generic renderer:** for each node prop, switch on `x-a2ui.kind` — `prop`/`data` → resolve binding & pass through; `event` → `() => dispatch(value.event)`; `slot` → render `children` ids. One function renders all components; you only supply the `name → React component` map.
- **Generic validator:** for each non-reserved, non-bound prop, `schema.shape[key].safeParse(value)`, skipping `event`/`slot` kinds and recursing `data` arrays via `itemComponent`. Composition (which child is valid in which parent) comes from `role`/`accepts`/`childOf`.

  Without `x-a2ui`, you hand-write a renderer per component that has function/slot/data props. **Ask your DS team to add `x-a2ui` — it's the difference between a generic adapter and 80 bespoke renderers.**
- **Note on prop kinds:** your DS catalog props are not all plain values — functions map to A2UI **events**, ReactNode children to the **`children` slot**, and data arrays to **bound `{path}` props**. The renderer projects an A2UI node → real React props; never expect a function or ReactNode literal in the JSON.
- **See:** §6 Phase A (a `RendererAdapter` interface makes this a one-package swap).

### G. Point the catalog at a remote MCP server
1. `.env.local` → `CATALOG_PROVIDER=mcp`, `MCP_URL=<your-url>`.
2. Restart `bun run dev`.
- **Verify:** a chat turn succeeds (proves the materializer fetched the catalog over MCP). If the server is down you'll get a clear "Catalog MCP server unreachable" error — that's intended (fail loud).
- **Don't touch:** `provider.ts` interface — just the env.

### H. Add / rename a channel or form factor
1. Channel: edit `ChannelId` + `CHANNELS` in `lib/context/channelContext.ts`. The ChannelBar, prompt, and adaptLayout read from there.
2. Form factor: edit `FormFactor` + the `PROFILES` in `lib/a2ui/layout.ts` + the validator in `normalizeContext`.
- **Verify:** the ChannelBar shows the new channel; `curl` with the new `formFactor` returns the expected columns; update `API.md`.
- **Careful:** `FormFactor` is part of the public contract — adding is safe, renaming is breaking.

### I. Tune layout adaptation
1. Edit `PROFILES` in `lib/a2ui/layout.ts` (columns / gap / maxWidth per form factor).
- **Verify:** unit-test the pure function (mobile/tablet/desktop) and confirm single-column lists stay 1.
- **Don't touch:** the agent (it emits canonical; adaptation is here only — invariant 5).

### J. Onboard a new client platform (e.g. mobile)
1. The native team builds a **renderer + componentMap** against the shared catalog names (see `API.md` §10 checklist).
2. They call `POST /api/agent` with `context.formFactor` set to the device class, and render `messages` verbatim.
3. They implement the **action vocabulary** (`API.md` §5), including the `add_to_cart` round-trip.
- **Verify:** same query from `formFactor: mobile` vs `desktop` returns different `columns` (already true).
- **Don't touch:** the server logic — that's the point. Native sends a request and renders.

### K. Evolve the API contract
1. **Additive** (new optional field): add to `lib/api/contract.ts` + `agentService.ts`, document in `API.md`. Safe.
2. **Breaking** (rename/remove/retype): bump `PROTOCOL_VERSION`, support both versions during migration (native apps lag), document.
- **Verify:** `curl` old and new shapes; web chat still works; `API.md` updated.
- **Careful:** invariant 8 — keep `agentService.ts` free of Next/React.

### L. Add or change inventory / data source
1. Edit `lib/data/products.json` (keep the shape) — or swap it for a real backend behind `executeSearchProducts` in `lib/agent/tools.ts`.
- **Verify:** both the static grid and `search_products` reflect the change.

### M. Switch or add an LLM provider
1. Switch: `.env.local` `LLM_PROVIDER=openai|anthropic` (+ that key).
2. Add a provider: implement the `LLMProvider` interface in `lib/agent/llm/<provider>.ts` and wire it in `index.ts`.
- **Verify:** a chat turn succeeds; tool-calling works.
- **Don't touch:** anything outside `lib/agent/llm/` (invariant 6).

---

## 4. Danger zones — think before you change

If your change touches one of these, slow down — it ripples beyond one file.

| Area | The risk | Before you change |
|---|---|---|
| `lib/a2ui/types.ts`, `schema.ts` | **The protocol.** Every client parses it. | Treat as a public API. Version it. Update `API.md`. Ask: can this be additive instead? |
| `components/a2ui/A2uiRenderer.tsx`, `useSurface.ts` | The shared render engine — **both flows**. | A bug here breaks the entire app. Keep it generic; push specifics into `componentMap`. |
| `components/a2ui/StoreSurface.tsx` | The convergence point + event dispatch + client-side adaptLayout. | Don't fork it per flow. Don't remove client-side adaptation without moving the web to server-only adaptation. |
| `mui.catalog.json` ↔ `componentMap.tsx` | Parity. | Change both together. Run the app and check the parity warning. |
| `lib/api/contract.ts` | The native contract. | Breaking changes break shipped apps. Version. |
| `lib/agui/types.ts` (`AguiDecision`) | The seam between AGUI and A2UI. | Both layers depend on it. Additive only, ideally. |
| `lib/agui/reasonerPrompt.ts`, `lib/a2ui/materializerPrompt.ts` | LLM behavior — silent drift, no compiler to catch it. | Change one rule at a time; verify with the debug toggles; keep the bindings/layout rules intact. |
| `lib/a2ui/layout.ts` | Adaptation must stay idempotent-safe and preserve single-column intent. | Keep the `authored <= 1 ? 1 : profile` logic. Unit-test all three form factors. |
| `lib/context/channelContext.ts` | `normalizeContext` is the trust boundary for untrusted API input. | Keep validation + defaults. `formFactor` defaults `desktop` for a reason. |
| Anything under `lib/` importing `next/*` or `react` | Re-couples the headless core to the web app. | Don't. Keep rendering concerns in `components/`. |

---

## 5. Verification & QA checklist

There is no automated test suite yet (it's a roadmap item — see §6). Until then, the **definition of done**:

- [ ] **Typecheck passes:** `bunx tsc --noEmit` (no errors).
- [ ] **Catalog parity:** dev console shows no `[a2ui] catalog components without a renderer` warning.
- [ ] **Both flows render:** the home grid (deterministic) and a chat turn (conversational) both work.
- [ ] **Debug toggles agree:** **"Show A2UI JSON"** matches what's on screen; **"AGUI decided"** shows the right intent.
- [ ] **API still honors the contract:** `curl` a request — confirm `{ protocolVersion, decision, messages }`, and that `formFactor: mobile` vs `desktop` changes `columns`.
- [ ] **Error envelope intact:** a bad request returns `{ protocolVersion, error: { code, message } }`.
- [ ] **Contract changes are documented/versioned** in `API.md`; behavior changes noted in `ARCHITECTURE.md`.
- [ ] **No invariant from §1 violated.**

Quick API probe:
```bash
curl -s -X POST http://localhost:3000/api/agent -H "Content-Type: application/json" \
  -d '{"message":"phones under 500","context":{"platform":"ios","formFactor":"mobile"}}'
```

---

## 6. Scaling roadmap (org-wide)

Forward guidance for turning this into a reusable platform. **You don't need these to add a flow** —
they're for when the app becomes many apps. Detail was worked out in design discussion; the order:

| Phase | What | Do it when… |
|---|---|---|
| **A. Neutralize the contract** | DS-agnostic catalog schema + a `RendererAdapter` interface (MUI becomes one adapter package). | You're about to support a second design system. Makes Recipe F a one-package swap. |
| **B. Headless extraction** | Lift `lib/{agui,a2ui,agent,catalog,context,api}` into `@org/a2ui-server`; the Next route stays a thin adapter (already is). | You want the API to deploy/scale independently of the web app, or serve native from a separate host. |
| **C. Registries** | Declarative **Template**, **Tool**, and **Flow** registries so flows are additive, not hand-wired. | You pass ~5 flows and the materializer prompt / page wiring gets unwieldy. **Also the biggest cost lever** (templates → fewer LLM calls). |
| **D. Capability negotiation + versioning** | Client declares `{ platform, catalogVersion, components }`; server constrains + validates output against the target client. | You have clients on different catalog versions (native lags). Makes DS-swap and mobile safe. |
| **E. Cross-cutting** | Packaging (`@org/a2ui-*`), design tokens, observability (cost/latency/traces), caching + model routing, conformance/golden tests. | Production hardening at org scale. |

**The two highest-leverage decisions** (decide early — they cascade):
1. **Generative vs template-driven materialization** (recommend hybrid: templates for known intents, generative fallback). Drives cost, validation, and the Template registry.
2. **Mobile stack** (RN/Flutter reuse the renderer-core; native iOS/Android = two more renderers). Changes Phase B/D scope.

---

## 7. Notes for AI agents

If you are an AI agent modifying this repo:

- **Use `bun`** (`bun install` / `bun add`) — never npm.
- **Do not start a background `next dev`** — the human runs it. Competing dev servers corrupt `.next` (EPERM). To verify, `curl` their running server on `:3000`, or just `bunx tsc --noEmit`.
- **Respect §1 invariants.** Prefer **additive** changes in **one** layer. If a task seems to require editing the protocol, the renderer core, or the API contract, surface that to the human first — it's a ripple, not a one-liner.
- **Find the right file via §2** before writing code. Most changes are one file.
- **Keep `lib/` free of `next/*` and `react`** outside `components/` (invariant 8).
- **After changes:** run the §5 checklist. Use the **"Show A2UI JSON"** and **"AGUI decided"** toggles to debug: wrong *decision* → reasoner; right decision but wrong *UI* → materializer.
- **When changing prompts**, change one rule at a time and keep the bindings-are-whole-values and layout-is-downstream rules intact.
- **Update the docs** you invalidate (`ARCHITECTURE.md`, `API.md`, this file).
