#!/usr/bin/env node
// rasengan-registry MCP server: stdio by default, streamable HTTP with --http (or MCP_TRANSPORT=http).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { caLicenseLookup, caLapseEvents, caExpiring, fmcsaNewCarriers, LAPSE_TYPES } from './tools.js';
import { NotPublished } from './data.js';

const VERSION = '0.1.0';
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

function wrap(fn) {
  return async (args) => {
    try {
      const out = await fn(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] };
    } catch (e) {
      const msg = e instanceof NotPublished ? `${e.message}; try again after the next twice-weekly refresh.` : `Error: ${e.message}`;
      return { isError: true, content: [{ type: 'text', text: msg }] };
    }
  };
}

export function buildServer() {
  const server = new McpServer({ name: 'rasengan-registry', version: VERSION });

  server.registerTool('ca_license_lookup', {
    title: 'California contractor licence lookup (CSLB)',
    description: 'Look up one California contractor licence from the CSLB License Master file: business, trades, status, '
      + 'expiration date, contractor bond (surety, number, amount, cancellation date) and workers\' comp policy on file, '
      + 'plus any bond, workers\' comp or status change events in the last 90 days.',
    inputSchema: { licence: z.string().describe('CSLB licence number, e.g. "1162758"') },
    annotations: READ_ONLY,
  }, wrap(caLicenseLookup));

  server.registerTool('ca_lapse_events', {
    title: 'California contractor bond / workers\' comp lapse events',
    description: 'California contractors whose contractor bond or workers\' comp was just cancelled or expired, or whose '
      + 'licence was suspended, expired or reinstated, newest first. Pending = the cancellation date is still in the future '
      + '(the contractor can still replace the bond or policy). daysLeft counts down a 90-day reinstatement planning clock.',
    inputSchema: {
      days: z.number().int().min(1).max(90).default(14).describe('Events from the last N days (max 90)'),
      county: z.string().optional().describe('California county name, e.g. "Los Angeles". Omit for statewide.'),
      types: z.array(z.enum(LAPSE_TYPES)).optional().describe('Event types; default: bond_cancelled, wc_cancelled, wc_expired, suspended, expired'),
      pendingOnly: z.boolean().default(false).describe('Only events whose effective date is still in the future'),
      limit: z.number().int().min(1).max(500).default(50).describe('Maximum rows to return'),
    },
    annotations: READ_ONLY,
  }, wrap(caLapseEvents));

  server.registerTool('ca_expiring', {
    title: 'California contractor licences expiring soon',
    description: 'California contractor licences, or insured contractors\' workers\' comp policies, that expire in the next '
      + 'N days (up to 120), soonest first, with status, bond surety and WC insurer. Renewal lists for sureties and insurance agents.',
    inputSchema: {
      days: z.number().int().min(1).max(120).default(30).describe('Expiring between today and today + N days'),
      what: z.enum(['license', 'workersComp', 'either']).default('license').describe('Which expiration date to use'),
      county: z.string().optional().describe('California county name. Omit for statewide.'),
      classes: z.array(z.string()).optional().describe('Classification codes, e.g. ["B", "C10"]'),
      limit: z.number().int().min(1).max(500).default(50).describe('Maximum rows to return'),
    },
    annotations: READ_ONLY,
  }, wrap(caExpiring));

  server.registerTool('fmcsa_new_carriers', {
    title: 'New FMCSA carriers (USDOT) with authority and insurance status',
    description: 'Motor carriers newly added to the FMCSA census in the last N days, newest first, with phone, email, '
      + 'officer, fleet size, and each operating authority (MC docket) with its status and insurance required vs on file.',
    inputSchema: {
      days: z.number().int().min(1).max(90).default(7).describe('Carriers added in the last N days'),
      state: z.string().optional().describe('Two-letter state of the physical address, e.g. "TX". Omit for all states.'),
      limit: z.number().int().min(1).max(500).default(50).describe('Maximum rows to return'),
    },
    annotations: READ_ONLY,
  }, wrap(fmcsaNewCarriers));

  return server;
}

async function startHttp() {
  const { createMcpExpressApp } = await import('@modelcontextprotocol/sdk/server/express.js');
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  const allowed = (process.env.ALLOWED_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const app = createMcpExpressApp(allowed.length ? { host, allowedHosts: allowed } : { host });
  app.get('/health', (_req, res) => res.json({ ok: true, name: 'rasengan-registry', version: VERSION }));
  // Stateless: a fresh server + transport per request, so any number of clients can call it.
  app.post('/mcp', async (req, res) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  });
  const notAllowed = (_req, res) => res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
  app.listen(port, host, () => console.error(`rasengan-registry MCP (streamable HTTP) on http://${host}:${port}/mcp`));
}

const http = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http';
if (http) {
  await startHttp();
} else {
  await buildServer().connect(new StdioServerTransport());
  console.error('rasengan-registry MCP running on stdio');
}
