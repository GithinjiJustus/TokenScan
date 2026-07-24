/**
 * backend/server.js
 *
 * Stage 4 & 5 — Express Server + SSE Broadcaster
 *
 * Responsibilities:
 *  - Mount all API routes
 *  - Manage persistent SSE client connections (GET /api/events)
 *  - Expose a broadcast function injected into the ingestion controller
 *  - Serve an initial state snapshot on SSE handshake
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { handleIngestion, injectSSEBroadcaster } from './controllers/ingestion.js';
import { getStateSnapshot, commitReading } from './database/models/ledger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate req.ip behind reverse proxies
app.set('trust proxy', 1);

// ─── SSE Client Registry ──────────────────────────────────────────────────────

/**
 * Set of active SSE response objects.
 * Each entry is { res, session_id, connected_at }.
 */
const sseClients = new Set();

/**
 * Write a structured SSE event frame to a response stream.
 * @param {Response} res
 * @param {string}   eventName
 * @param {object}   data
 */
function writeSSEEvent(res, eventName, data) {
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected before write completed — handled by 'close' event
  }
}

/**
 * Broadcast a structured event payload to ALL connected SSE clients.
 * Called by the ingestion controller after a successful DB commit.
 *
 * @param {{ type: string, payload: object }} event
 */
function broadcastToAll(event) {
  const dead = [];

  for (const client of sseClients) {
    try {
      writeSSEEvent(client.res, event.type, {
        ...event.payload,
        _broadcast_at: new Date().toISOString(),
        _connected_clients: sseClients.size,
      });
    } catch {
      dead.push(client);
    }
  }

  // Prune dead connections
  for (const d of dead) sseClients.delete(d);
}

// Inject broadcaster into ingestion controller
injectSSEBroadcaster(broadcastToAll);

// ─── Routes ───────────────────────────────────────────────────────────────────

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'TokenScan Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sse_clients: sseClients.size,
    env: {
      port: PORT,
      node_version: process.version,
      gemini_key_set: !!process.env.GEMINI_API_KEY,
    },
  });
});

// ── Stage 2: Ingestion Endpoint ─────────────────────────────────────────────

app.post('/api/ingestion', handleIngestion);

// ── Mock Ingestion (no API key / no image required — for testing) ─────────────
// Accepts a pre-parsed JSON body matching the Gemma RESPONSE_SCHEMA and feeds it
// directly into the database + SSE pipeline, bypassing the AI vision step.
//
// POST /api/ingestion/mock
// Body (JSON): { meter_serial_number, data_source_type, remaining_units_kwh,
//               load_kilowatts, token_strings[], active_error_code }

app.post('/api/ingestion/mock', async (req, res) => {
  const parsed = { ...req.body };

  // Basic shape check
  const required = ['data_source_type', 'remaining_units_kwh', 'load_kilowatts'];
  const missing = required.filter((k) => parsed[k] === undefined);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: 'MISSING_FIELDS', missing });
  }

  // Coerce and sanitise
  parsed.remaining_units_kwh = parseFloat(parsed.remaining_units_kwh);
  parsed.load_kilowatts      = parseFloat(parsed.load_kilowatts ?? 0);
  parsed.token_strings       = Array.isArray(parsed.token_strings) ? parsed.token_strings : [];
  parsed.active_error_code   = parsed.active_error_code ?? null;
  parsed.meter_serial_number = parsed.meter_serial_number ?? 'MOCK-UNKNOWN';

  const context = {
    session_id  : req.headers['x-session-id'] || `mock-${Date.now()}`,
    captured_at : new Date().toISOString(),
    received_at_ms: Date.now(),
    meter_id_hint : parsed.meter_serial_number,
    client_ip   : req.ip,
    user_agent  : 'mock-test-client',
  };

  const dbResult = commitReading(parsed, context);

  if (!dbResult.ok) {
    return res.status(422).json({
      ok: false,
      error: dbResult.error,
      violations: dbResult.violations,
    });
  }

  // Broadcast to all connected SSE clients
  broadcastToAll({ type: 'reading_committed', payload: dbResult.broadcast_payload });
  if (dbResult.analytics.anomaly_detected) {
    broadcastToAll({
      type: 'anomaly_alert',
      payload: {
        message       : dbResult.analytics.anomaly_reason,
        transaction_id: dbResult.transaction.id,
        captured_at   : context.captured_at,
      },
    });
  }

  return res.status(200).json({
    ok    : true,
    _note : 'Mock ingestion — Gemma AI pipeline bypassed',
    parsed,
    transaction    : dbResult.transaction,
    analytics      : dbResult.analytics,
    state_snapshot : dbResult.state_snapshot,
  });
});

// ── Stage 5: SSE Event Stream ────────────────────────────────────────────────

/**
 * GET /api/events
 *
 * Establishes a persistent Server-Sent Events stream.
 *
 * The frontend subscribes once on mount and receives:
 *  - 'state_snapshot'    — Full current state on connection (immediate)
 *  - 'reading_committed' — New transaction + gauge + chart update
 *  - 'error_event'       — Visual parser failure alert
 *  - 'anomaly_alert'     — Consumption spike / grid dropout alert
 *  - 'heartbeat'         — Keep-alive ping every 25s
 */
app.get('/api/events', (req, res) => {
  // ── SSE Headers ─────────────────────────────────────────────────────────────
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',   // Disable nginx buffering for SSE
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:5173',
  });
  res.flushHeaders(); // Flush headers immediately so the browser opens the stream

  const session_id = req.headers['x-session-id'] || `anon-${Date.now()}`;
  const connected_at = new Date().toISOString();

  const client = { res, session_id, connected_at };
  sseClients.add(client);

  console.log(`[SSE] Client connected — session=${session_id}, total=${sseClients.size}`);

  // ── Initial State Snapshot ──────────────────────────────────────────────────
  // Immediately sends the current ledger state so the UI can hydrate without
  // waiting for the next reading_committed event.
  writeSSEEvent(res, 'state_snapshot', {
    session_id,
    connected_at,
    snapshot: getStateSnapshot(),
    _broadcast_at: connected_at,
  });

  // ── Heartbeat to prevent proxy/load-balancer timeouts ──────────────────────
  const heartbeat = setInterval(() => {
    try {
      // SSE comment line (":") acts as keep-alive without triggering onmessage
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  // ── Cleanup on Client Disconnect ────────────────────────────────────────────
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
    console.log(`[SSE] Client disconnected — session=${session_id}, total=${sseClients.size}`);
  });
});

// ── State Snapshot (REST fallback for non-SSE clients) ───────────────────────

app.get('/api/state', (_req, res) => {
  res.json({
    ok: true,
    snapshot: getStateSnapshot(),
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Catch-all ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'NOT_FOUND' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         TokenScan Backend — API Server Running           ║
╠══════════════════════════════════════════════════════════╣
║  Port       : ${String(PORT).padEnd(42)}║
║  Env        : ${(process.env.NODE_ENV || 'development').padEnd(42)}║
║  Gemini Key : ${(process.env.GEMINI_API_KEY ? '✓ Set' : '✗ NOT SET — set GEMINI_API_KEY in .env').padEnd(42)}║
║  Node       : ${process.version.padEnd(42)}║
╠══════════════════════════════════════════════════════════╣
║  POST /api/ingestion  — Multipart image upload + AI      ║
║  GET  /api/events     — SSE real-time event stream       ║
║  GET  /api/state      — Current ledger state snapshot    ║
║  GET  /health         — Service health check             ║
╚══════════════════════════════════════════════════════════╝
  `.trim());
});

export default app;
