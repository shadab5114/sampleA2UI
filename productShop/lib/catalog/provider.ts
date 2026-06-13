// CatalogProvider is the seam between the agent and "what components exist".
//   - StaticCatalogProvider reads the bundled mui.catalog.json (default).
//   - McpCatalogProvider queries the standalone catalog MCP server at runtime,
//     so the catalog is a live service ("MCP Tooling") rather than a frozen file.
//
// Selected by the CATALOG_PROVIDER env var ('static' | 'mcp'). The interface is
// async so an MCP-backed provider is a true drop-in — no caller knows the source.

import catalog from './mui.catalog.json';
import { mcpGetCatalog, mcpGetComponentSpec, mcpListComponents } from './mcpClient';

export interface PropSpec {
  type: string;
  values?: string[];
  default?: unknown;
  bindable?: boolean;
  description?: string;
}

export interface ComponentSpec {
  muiComponent: string;
  category?: string;
  acceptsChildren?: boolean;
  props: Record<string, PropSpec>;
}

export type Catalog = Record<string, ComponentSpec>;

export interface CatalogProvider {
  listComponents(): Promise<string[]>;
  getComponentSpec(name: string): Promise<ComponentSpec | undefined>;
  /** Compact, prompt-friendly description of the full catalog. */
  getCatalogForPrompt(): Promise<string>;
}

/** Shared formatter so both providers render the catalog identically. */
export function formatCatalogForPrompt(c: Catalog): string {
  return Object.entries(c)
    .map(([name, spec]) => {
      const props = Object.entries(spec.props || {})
        .map(([prop, def]) => {
          const t =
            def.type === 'enum' ? `enum(${(def.values || []).join('|')})` : def.type;
          return `${prop}:${t}${def.bindable ? '[bindable]' : ''}`;
        })
        .join(', ');
      const childMark = spec.acceptsChildren ? ' children:string[]' : '';
      return `- ${name}${childMark} { ${props} }`;
    })
    .join('\n');
}

export class StaticCatalogProvider implements CatalogProvider {
  private catalog: Catalog;

  constructor(c: Catalog = catalog as Catalog) {
    this.catalog = c;
  }

  async listComponents(): Promise<string[]> {
    return Object.keys(this.catalog);
  }

  async getComponentSpec(name: string): Promise<ComponentSpec | undefined> {
    return this.catalog[name];
  }

  async getCatalogForPrompt(): Promise<string> {
    return formatCatalogForPrompt(this.catalog);
  }
}

/**
 * Sources the catalog from the standalone MCP server over Streamable HTTP.
 * The full catalog is fetched once per process and memoised — the catalog is
 * stable during a run, and the prompt needs all of it anyway. Per-spec lookups
 * still hit the dedicated MCP tool.
 */
export class McpCatalogProvider implements CatalogProvider {
  private cached?: Promise<Catalog>;

  private load(): Promise<Catalog> {
    if (!this.cached) {
      this.cached = mcpGetCatalog().catch((err) => {
        this.cached = undefined; // allow retry on next call
        throw new Error(
          `Catalog MCP server unreachable (${
            process.env.MCP_URL ?? 'http://localhost:3100/mcp'
          }). Start it with "bun run mcp-server", or set CATALOG_PROVIDER=static. Cause: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }
    return this.cached;
  }

  async listComponents(): Promise<string[]> {
    return mcpListComponents();
  }

  async getComponentSpec(name: string): Promise<ComponentSpec | undefined> {
    return mcpGetComponentSpec(name);
  }

  async getCatalogForPrompt(): Promise<string> {
    return formatCatalogForPrompt(await this.load());
  }
}

function createCatalogProvider(): CatalogProvider {
  const kind = (process.env.CATALOG_PROVIDER ?? 'static').toLowerCase();
  return kind === 'mcp' ? new McpCatalogProvider() : new StaticCatalogProvider();
}

export const catalogProvider: CatalogProvider = createCatalogProvider();
