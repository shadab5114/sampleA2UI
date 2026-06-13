// MCP client wrapper — the app side of the catalog MCP integration.
// Connects to the standalone catalog MCP server (Streamable HTTP) and calls its
// tools. Used by McpCatalogProvider so the catalog is sourced live at runtime.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Catalog, ComponentSpec } from './provider';

function mcpUrl(): URL {
  return new URL(process.env.MCP_URL ?? 'http://localhost:3100/mcp');
}

/** Open a short-lived MCP session, run fn, always close. */
async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StreamableHTTPClientTransport(mcpUrl());
  const client = new Client({ name: 'phonehub-app', version: '1.0.0' });
  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close();
  }
}

/** Pull the single text block out of an MCP tool result. */
function textContent(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> })?.content ?? [];
  const block = content.find((c) => c.type === 'text');
  if (!block?.text) throw new Error('MCP tool returned no text content');
  return block.text;
}

export async function mcpGetCatalog(): Promise<Catalog> {
  return withClient(async (client) => {
    const result = await client.callTool({ name: 'get_catalog', arguments: {} });
    return JSON.parse(textContent(result)) as Catalog;
  });
}

export async function mcpListComponents(): Promise<string[]> {
  return withClient(async (client) => {
    const result = await client.callTool({ name: 'list_components', arguments: {} });
    return JSON.parse(textContent(result)) as string[];
  });
}

export async function mcpGetComponentSpec(name: string): Promise<ComponentSpec | undefined> {
  return withClient(async (client) => {
    const result = await client.callTool({ name: 'get_component_spec', arguments: { name } });
    return (JSON.parse(textContent(result)) as ComponentSpec | null) ?? undefined;
  });
}
