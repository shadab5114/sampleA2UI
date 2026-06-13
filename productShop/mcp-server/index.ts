// ─────────────────────────────────────────────────────────────────────────────
// PhoneHub Catalog MCP Server (standalone)
//
// A real MCP service — the "MCP Tooling" block of the architecture — exposing the
// MUI component catalog over Streamable HTTP. The Next.js app connects to it as
// an MCP *client* (lib/catalog/mcpClient.ts) so the catalog is fetched live at
// runtime instead of bundled. Single source of truth stays lib/catalog/mui.catalog.json.
//
// Run:  bun run mcp-server   (listens on :3100 by default)
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import catalog from '../lib/catalog/mui.catalog.json';

type Catalog = Record<string, unknown>;
const CATALOG = catalog as Catalog;

/** Build a fresh MCP server exposing the catalog tools. */
function buildServer(): McpServer {
  const server = new McpServer({ name: 'phonehub-catalog', version: '1.0.0' });

  server.registerTool(
    'list_components',
    { description: 'List all MUI catalog component names available to the UI agent.' },
    async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(Object.keys(CATALOG)) }],
    }),
  );

  server.registerTool(
    'get_component_spec',
    {
      description: 'Get the structured prop spec for a single catalog component.',
      inputSchema: { name: z.string().describe('Component name, e.g. "Button"') },
    },
    async ({ name }) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(CATALOG[name] ?? null) }],
    }),
  );

  server.registerTool(
    'get_catalog',
    { description: 'Get the full structured component catalog as JSON.' },
    async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(CATALOG) }],
    }),
  );

  return server;
}

const app = express();
app.use(express.json());

// Stateless Streamable HTTP: a fresh server + transport per request keeps
// concurrent requests isolated (recommended for read-only services like this).
app.post('/mcp', async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'internal MCP error' });
  }
});

// GET (SSE stream) / DELETE (session teardown) are unused in stateless mode.
app.get('/mcp', (_req, res) => res.status(405).json({ error: 'Method Not Allowed' }));
app.delete('/mcp', (_req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

const PORT = Number(process.env.MCP_PORT ?? 3100);
app.listen(PORT, () => {
  console.log(`[mcp] PhoneHub catalog server → http://localhost:${PORT}/mcp`);
  console.log(`[mcp] tools: list_components, get_component_spec, get_catalog`);
});
