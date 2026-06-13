# PhoneHub Agent API — Client Integration Guide

This is the contract for **any client** (web, iOS, Android, React Native, Flutter) that wants
to render server-driven UI from the PhoneHub agent. You send a message + who/where you are; the
server returns a **render-ready A2UI surface** (a JSON UI tree) that your renderer turns into native
widgets.

> **Mental model:** the backend owns *all* the logic — intent, data, composition, and layout. Your
> app **sends a request and renders the response**. It does not decide what to show or how many
> columns to use.

- TypeScript contract types: [`lib/api/contract.ts`](lib/api/contract.ts)
- Component catalog (what you must build renderers for): [`lib/catalog/mui.catalog.json`](lib/catalog/mui.catalog.json)
- Protocol/render details: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## 1. Endpoint

```
POST /api/agent
Content-Type: application/json
```

> In production the same headless service (`lib/api/agentService.ts`) can be mounted standalone
> (e.g. `https://api.yourorg.com/agent`). The request/response shapes are identical regardless of host.

---

## 2. Request

```jsonc
{
  "message": "show me phones under 500",   // required — the user's prompt
  "context": {
    "platform": "ios",          // web | ios | android | rn | flutter   (default: web)
    "formFactor": "mobile",     // mobile | tablet | desktop            (default: desktop)
    "viewport": { "width": 390 },        // optional, reserved for finer adaptation
    "journeyStep": "browsing",           // browsing | comparing | cart | checkout
    "userState": { "authenticated": true, "role": "customer", "name": "Sam" }
  },
  "cart": [ /* CartItem[] — only on a cart action, see §6 */ ],
  "capabilities": {                       // optional, forward-looking (see §8)
    "catalogVersion": "1.0",
    "components": ["Container","Stack","Card","CardContent","List","Typography","Button","Rating","CardMedia","Alert","Divider"]
  }
}
```

| Field | Required | Notes |
|---|---|---|
| `message` | ✅ | The user's text. |
| `context.platform` | — | Your platform. Default `web`. |
| `context.formFactor` | **strongly recommended** | **Drives layout.** Omitting it defaults to `desktop` (widest). Native clients should always send their device class. |
| `context.viewport` | — | Exact pixels. Reserved for future width-based adaptation. |
| `context.journeyStep` | — | Where the user is. Helps the agent. |
| `context.userState` | — | Identity; influences the agent's tone/structure. |
| `cart` | on cart actions | See §6 (cart round-trip). |
| `capabilities` | — | Reserved; see §8. |

> **`formFactor` is the one field that matters for layout.** The device knows what it is — declare
> it. The server adapts column counts so you render verbatim.

---

## 3. Response

```jsonc
{
  "protocolVersion": "0.9",
  "decision": {                 // what the agent DECIDED (use for app chrome / nav / analytics)
    "intent": "search",         // browse | search | detail | compare | cart_confirm | empty
    "headline": "Cheapest Phones Available",
    "products": [ { "id": "moto-g54", "name": "Moto G54", ... } ],
    "journeyStep": "browsing"
  },
  "messages": [ /* the A2UI surface — render-ready, already adapted to formFactor */ ]
}
```

- **`decision`** is metadata you *may* use (e.g. drive native navigation off `intent`, log analytics).
  You do **not** need it to render.
- **`messages`** is the surface to render. See §4.

### Real example — `formFactor: "mobile"`

Note `Container.maxWidth` is `"xs"` and the grid `List.columns` is `1` — already adapted. The same
request with `formFactor: "desktop"` returns `columns: 3` and `maxWidth: "md"`. **You render whatever
you receive.**

```jsonc
{
  "protocolVersion": "0.9",
  "decision": { "intent": "search", "headline": "Cheapest Phones Available", "journeyStep": "browsing" },
  "messages": [
    {
      "updateDataModel": {
        "surfaceId": "chat",
        "path": "/products",
        "value": [
          { "id": "moto-g54", "name": "Moto G54", "priceLabel": "£199", "rating": 4,   "image": "/phone.svg" },
          { "id": "pixel-8a", "name": "Pixel 8a", "priceLabel": "£499", "rating": 4.5, "image": "/phone.svg" }
        ]
      }
    },
    {
      "updateComponents": {
        "surfaceId": "chat",
        "components": [
          { "id": "root",    "component": "Container", "maxWidth": "xs", "children": ["heading", "grid"] },
          { "id": "heading", "component": "Typography", "variant": "h6", "fontWeight": 600, "text": "Cheapest Phones Available" },
          { "id": "grid",    "component": "List", "itemsPath": "/products", "itemTemplate": "card", "columns": 1, "spacing": 8 },
          { "id": "card",    "component": "Card",
            "onPress": { "event": { "name": "view_product", "context": { "id": { "path": "/id" } } } },
            "children": ["cmedia", "ccontent"] },
          { "id": "cmedia",  "component": "CardMedia", "image": { "path": "/image" }, "height": 100 },
          { "id": "ccontent","component": "CardContent", "children": ["cname", "cprice", "crating", "caddBtn"] },
          { "id": "cname",   "component": "Typography", "variant": "subtitle2", "fontWeight": 600, "text": { "path": "/name" } },
          { "id": "cprice",  "component": "Typography", "variant": "body2", "text": { "path": "/priceLabel" } },
          { "id": "crating", "component": "Rating", "value": { "path": "/rating" }, "readOnly": true, "precision": 0.1 },
          { "id": "caddBtn", "component": "Button", "label": "Add to Cart", "size": "small", "variant": "contained",
            "onPress": { "event": { "name": "add_to_cart", "context": { "id": { "path": "/id" } } } } }
        ]
      }
    },
    { "createSurface": { "surfaceId": "chat", "root": "root", "catalogId": "mui" } }
  ]
}
```

---

## 4. The A2UI surface format (what your renderer consumes)

`messages` is an ordered list of three message kinds. Fold them into one surface state, then render.

| Message | Meaning |
|---|---|
| `updateDataModel { path, value }` | Seed data at a JSON-pointer path (e.g. `/products`). Your bindings resolve against this. |
| `updateComponents { components[] }` | The component nodes (a flat list; nesting is by id reference). |
| `createSurface { root }` | The id of the root node to start rendering from. |

**Component node** = `{ "id", "component", ...props }`.
- `component` is a **catalog name** (e.g. `Card`, `Typography`) → map it to your native widget.
- `children: ["id1","id2"]` references other nodes by id (resolve and render in order).

**Prop values** are either:
- a **literal** — `"variant": "h6"`, `"columns": 1`
- a **binding** — `"text": { "path": "/name" }` → resolve the JSON-pointer path against the current
  data scope and substitute the value.

**`List` (repeater)** — `{ "component": "List", "itemsPath": "/products", "itemTemplate": "card", "columns": 1 }`
renders the `itemTemplate` node **once per item** in the array at `itemsPath`, with **that item as the
data scope** (so `{ "path": "/name" }` inside the template resolves to each item's `name`). `columns` is
already device-correct — lay out a grid with that many columns.

### Render algorithm (per platform)

1. Fold `messages` → `{ rootId, componentsById, dataModel }`.
2. Start at `rootId`. For each node: look up its `component` in your **componentMap** (catalog name →
   native widget).
3. Resolve each prop: if it's `{ "path": "..." }`, read from the current data scope; else use the literal.
4. For `children`, render each referenced node id.
5. For `List`, iterate `itemsPath`; render `itemTemplate` per item with the item as the data scope.
6. For interactive props (`onPress`), wire the native gesture to **dispatch the event** (see §5).

---

## 5. Action vocabulary (events your client handles)

Interactive props carry `{ "event": { "name", "context?" } }`. On tap, resolve any bindings in
`context`, then handle by `name`. Two categories:

| Event | Category | What the client does |
|---|---|---|
| `view_product` | **client navigation** | Navigate to the product detail screen for `context.id`. |
| `go_back` | **client navigation** | Pop the current screen. |
| `add_to_cart` | **server round-trip** | Add `context.id` to the local cart, then POST `/agent` again **with the `cart` array** to get a cart-confirmation surface (see §6). |
| `remove_from_cart` | client + state | Remove `context.id` from the cart. |
| `checkout` | client | Begin your checkout flow. |
| `add_to_wishlist` | client + state | Save `context.id`. |
| `filter_brand` | client/local | Re-filter the current list (web demo re-seeds the data model). |

> You own the handlers; the server owns the event *names*. Keep them identical across platforms so one
> surface behaves the same everywhere. Treat unknown event names as no-ops (forward-compatible).

---

## 6. Cart round-trip pattern

`add_to_cart` is the canonical "action feeds the agent" loop:

1. User taps **Add to Cart** → you get `{ name: "add_to_cart", context: { id: "pixel-9" } }`.
2. Add the item to your local cart.
3. POST `/agent` again with the **`cart`** snapshot (and the same context):

```jsonc
{
  "message": "added an item",
  "cart": [
    { "id": "pixel-9", "name": "Pixel 9", "qty": 1, "price": 799,
      "priceLabel": "£799", "qtyLabel": "Qty: 1", "lineTotal": "£799.00" }
  ],
  "context": { "platform": "android", "formFactor": "mobile" }
}
```

4. The response `decision.intent` is `cart_confirm` and `messages` render a cart-confirmation surface
   (success Alert + line items + a total row + checkout button). The cart path is **deterministic** on
   the server — no LLM reasoning — so it's fast.

> **Label + value rule:** bindings are always the *whole* value of a prop. A "Total: £799" row is **two
> nodes** — a literal `Typography "Total"` and a `Typography` bound to `{ "path": "/total" }` — never a
> single string with an embedded binding.

---

## 7. The component catalog

Your renderer must implement a widget for each catalog component you intend to support. The current
catalog (16 components) and their exact props/enums live in
[`lib/catalog/mui.catalog.json`](lib/catalog/mui.catalog.json):

```
Container, Stack, Box, Divider, Typography, Card, CardContent, CardMedia,
Button, Rating, Chip, TextField, Alert, Avatar, LinearProgress, List
```

Component + prop **names are shared across platforms** — your native widgets implement the same names.
You don't have to support all 16 on day one; declare what you support via `capabilities.components`
(§8) so the server can avoid emitting components you can't render (enforcement is on the roadmap).

> The catalog is also served live over MCP (`mcp-server/`, tools `list_components` /
> `get_component_spec` / `get_catalog`) if you prefer to fetch specs at build time.

---

## 8. Versioning & capabilities

- **`protocolVersion`** is returned on every response (currently `0.9`). Pin the major; tolerate minor
  additions. Treat unknown component names / event names as render-skipped / no-op rather than crashing.
- **`capabilities`** (request, optional, forward-looking): tell the server your `catalogVersion` and the
  `components` you can render. Today it's accepted and reserved; soon the server will constrain the
  agent's output to your set and validate against it. Start sending it now to be future-proof.

---

## 9. Error format

Every failure uses one envelope:

```jsonc
{ "protocolVersion": "0.9", "error": { "code": "invalid_request", "message": "message is required" } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Missing/blank `message`. |
| 503 | `provider_unconfigured` | The server's LLM provider key isn't set. |
| 500 | `internal_error` | Unexpected server error. |

---

## 10. Native renderer checklist

- [ ] A **componentMap**: catalog name → native widget (start with the components you need).
- [ ] A **fold**: `messages` → `{ rootId, componentsById, dataModel }`.
- [ ] A **binding resolver** for `{ "path": "/x/y" }` against the data scope (JSON-pointer).
- [ ] A **List repeater** that scopes each item as the data context.
- [ ] An **action dispatcher** mapping event names → handlers (§5), including the `add_to_cart` round-trip.
- [ ] Send `context.formFactor` (your device class) on **every** request.
- [ ] Tolerate unknown components/events (forward-compatibility).
