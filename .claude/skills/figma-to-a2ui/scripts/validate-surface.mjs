#!/usr/bin/env bun
// Deterministic catalog-conformance gate for A2UI surface files.
//
// This is the load-bearing guarantee that a generated surface adheres to its
// catalog. It does NOT use an LLM — it is a pure checker. The figma-to-a2ui
// skill runs this after generation and feeds any issues back for repair.
//
// Design-system agnostic: it accepts EITHER catalog shape used in this repo
//   1. flat "mui" shape:   { Name: { props: { p: { type, values } }, acceptsChildren } }
//   2. A2UI x-a2ui schema:  { components: { Name: { properties: { p: { type, enum, x-a2ui } } } } }
//
// Usage:
//   bun validate-surface.mjs <surface.a2ui.json> <catalog.json> [moreCatalogs...]
//   -> exit 0 and "OK" when clean; exit 1 and a JSON issue list otherwise.

import { readFileSync } from 'node:fs';

// Structural keys that are never catalog props.
const RESERVED = new Set([
  'id',
  'component',
  'children',
  'itemsPath',
  'itemTemplate',
  'onPress',
  'sx',
]);

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`Cannot read/parse ${path}: ${e.message}`);
  }
}

function isBinding(v) {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v.path === 'string' &&
    Object.keys(v).length === 1
  );
}

// ── Normalize any supported catalog shape into a common component map ────────
// Map<componentName, { props: Map<name,{enum?:string[]}>, acceptsChildren: bool }>
function normalizeCatalog(raw, into) {
  const components = raw.components ?? raw; // x-a2ui nests under .components
  for (const [name, def] of Object.entries(components)) {
    if (!def || typeof def !== 'object') continue;
    const props = new Map();
    let acceptsChildren = !!def.acceptsChildren;

    // flat "mui" shape
    if (def.props && typeof def.props === 'object') {
      for (const [p, pdef] of Object.entries(def.props)) {
        const values = pdef?.type === 'enum' ? pdef.values : undefined;
        props.set(p, { enum: values });
      }
    }

    // A2UI x-a2ui JSON-schema shape
    if (def.properties && typeof def.properties === 'object') {
      for (const [p, pdef] of Object.entries(def.properties)) {
        const kind = pdef?.['x-a2ui']?.kind;
        // slot/data props are child containers, not scalar props
        if (kind === 'slot' || kind === 'data') {
          acceptsChildren = true;
          continue;
        }
        props.set(p, { enum: Array.isArray(pdef?.enum) ? pdef.enum : undefined });
      }
      if (def['x-a2ui']?.accepts) acceptsChildren = true;
    }

    // Last catalog wins on override (federation semantics).
    into.set(name, { props, acceptsChildren });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const [, , surfacePath, ...catalogPaths] = process.argv;
if (!surfacePath || catalogPaths.length === 0) {
  fail('Usage: bun validate-surface.mjs <surface.a2ui.json> <catalog.json> [more...]');
}

const catalog = new Map();
for (const cp of catalogPaths) normalizeCatalog(readJson(cp), catalog);

const surface = readJson(surfacePath);
const issues = [];
const push = (nodeId, message) => issues.push({ nodeId, message });

if (!Array.isArray(surface)) {
  fail('Surface file must be a JSON array of A2UI messages.');
}

const ids = new Set();
const childRefs = []; // { from, ref }
let rootRef = null;
let sawCreateSurface = false;

for (const m of surface) {
  if (m && typeof m === 'object' && 'updateComponents' in m) {
    const comps = m.updateComponents?.components;
    if (!Array.isArray(comps)) {
      push(undefined, 'updateComponents.components must be an array');
      continue;
    }
    for (const node of comps) {
      if (!node?.id || !node?.component) {
        push(node?.id, 'Node missing "id" or "component"');
        continue;
      }
      if (ids.has(node.id)) push(node.id, `Duplicate component id "${node.id}"`);
      ids.add(node.id);

      const spec = catalog.get(node.component);
      if (!spec) {
        push(node.id, `Unknown component "${node.component}" (not in catalog)`);
        continue;
      }

      if (Array.isArray(node.children)) {
        if (!spec.acceptsChildren) {
          push(node.id, `"${node.component}" does not accept children`);
        }
        for (const ref of node.children) childRefs.push({ from: node.id, ref });
      }

      for (const key of Object.keys(node)) {
        if (RESERVED.has(key)) continue;
        const def = spec.props.get(key);
        if (!def) {
          push(node.id, `Unknown prop "${key}" on ${node.component}`);
          continue;
        }
        const value = node[key];
        if (
          def.enum &&
          typeof value === 'string' &&
          !isBinding(value) &&
          !def.enum.includes(value)
        ) {
          push(
            node.id,
            `Invalid value "${value}" for ${node.component}.${key} (expected ${def.enum.join('|')})`,
          );
        }
      }
    }
  } else if (m && typeof m === 'object' && 'createSurface' in m) {
    sawCreateSurface = true;
    rootRef = m.createSurface?.root ?? null;
  } else if (m && typeof m === 'object' && 'updateDataModel' in m) {
    // shape only; data values are free-form
    if (typeof m.updateDataModel?.path !== 'string') {
      push(undefined, 'updateDataModel.path must be a string');
    }
  } else {
    push(undefined, 'Message is not createSurface/updateComponents/updateDataModel');
  }
}

if (!sawCreateSurface) push(undefined, 'Missing createSurface message');
if (rootRef && !ids.has(rootRef)) push(undefined, `Root "${rootRef}" is not a defined component id`);
for (const { from, ref } of childRefs) {
  if (!ids.has(ref)) push(from, `children references unknown id "${ref}"`);
}

if (issues.length === 0) {
  console.log('OK — surface conforms to catalog.');
  process.exit(0);
}
console.log(JSON.stringify({ ok: false, issues }, null, 2));
process.exit(1);
