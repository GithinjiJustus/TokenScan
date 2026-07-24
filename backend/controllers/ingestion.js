/**
 * backend/controllers/ingestion.js
 *
 * Stage 2 — Backend Controller & Contextualization
 *
 * Handles POST /api/ingestion:
 *  1. Parses the multipart file payload using busboy
 *  2. Attaches server-side tracking context (timestamp, session, grid baseline)
 *  3. Calls the Gemma 4 pipeline (Stage 3)
 *  4. Commits result to database engine (Stage 4)
 *  5. Triggers SSE broadcast to connected clients (Stage 5)
 *  6. Returns structured HTTP response to the caller
 */

import busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';
import { runGemmaPipeline, VisualParserError } from '../services/gemma.js';
import { commitReading } from '../database/models/ledger.js';

// ─── Nairobi Grid Metadata Baseline ──────────────────────────────────────────

const NAIROBI_GRID_BASELINE = {
  region: 'Nairobi',
  county: 'Nairobi County',
  country: 'KE',
  utility: 'Kenya Power and Lighting Company (KPLC)',
  grid_frequency_hz: 50,
  nominal_voltage_v: 240,
  supply_type: 'Single-Phase AC',
  currency: 'KES',
  timezone: 'Africa/Nairobi',
};

// ─── Allowed MIME Types ───────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── SSE Broadcaster Reference ────────────────────────────────────────────────

// Will be injected by server.js at startup so the controller can push events
let _sseBroadcast = null;

export function injectSSEBroadcaster(broadcastFn) {
  _sseBroadcast = broadcastFn;
}

// ─── Main Ingestion Handler ───────────────────────────────────────────────────

/**
 * POST /api/ingestion
 *
 * Expects: multipart/form-data with:
 *   - file  : image file (meter LCD photo or M-Pesa screenshot)
 *   - session_id (optional): client session identifier
 *   - meter_id_hint (optional): known meter serial for verification
 */
export async function handleIngestion(req, res) {
  // ── 1. Build Server-Side Tracking Context ──────────────────────────────────

  const context = {
    session_id: req.headers['x-session-id'] || req.body?.session_id || uuidv4(),
    captured_at: new Date().toISOString(),           // High-resolution system timestamp
    received_at_ms: Date.now(),                       // Epoch for latency tracking
    meter_id_hint: req.headers['x-meter-id'] || null,
    client_ip: req.ip,
    user_agent: req.headers['user-agent'] || 'unknown',
    grid_baseline: NAIROBI_GRID_BASELINE,
    request_id: uuidv4(),
  };

  // ── 2. Parse Multipart Payload via busboy ──────────────────────────────────

  let imageBuffer = null;
  let imageMimeType = null;
  let imageFilename = null;
  let parseError = null;

  try {
    ({ imageBuffer, imageMimeType, imageFilename } = await parseMultipart(req));
  } catch (err) {
    parseError = err;
  }

  if (parseError || !imageBuffer) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_PAYLOAD',
      message: parseError?.message || 'No image file found in request.',
      request_id: context.request_id,
    });
  }

  // File size guard
  if (imageBuffer.length > MAX_FILE_SIZE_BYTES) {
    return res.status(413).json({
      ok: false,
      error: 'FILE_TOO_LARGE',
      message: `Image exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit.`,
      request_id: context.request_id,
    });
  }

  // MIME type guard
  if (!ALLOWED_MIME_TYPES.has(imageMimeType)) {
    return res.status(415).json({
      ok: false,
      error: 'UNSUPPORTED_MEDIA_TYPE',
      message: `${imageMimeType} is not an accepted image format.`,
      accepted: [...ALLOWED_MIME_TYPES],
      request_id: context.request_id,
    });
  }

  // ── 3. Stage 3: Gemma 4 Vision Pipeline ───────────────────────────────────

  let parsed;
  let visualParserFailed = false;
  let parserErrorState = null;

  try {
    parsed = await runGemmaPipeline(imageBuffer, imageMimeType, context);
  } catch (err) {
    if (err instanceof VisualParserError) {
      // Graceful visual failure — cracked/blank/unreadable screen
      visualParserFailed = true;
      parserErrorState = err.errorState;

      // Broadcast a user-actionable error event to connected SSE clients
      _sseBroadcast?.({
        type: 'error_event',
        payload: {
          message: err.reason,
          error_code: parserErrorState.active_error_code,
          session_id: context.session_id,
          captured_at: context.captured_at,
        },
      });

      return res.status(422).json({
        ok: false,
        error: 'VISUAL_PARSE_FAILED',
        message: err.reason,
        hint: 'Is the power out or is your meter display damaged?',
        error_state: parserErrorState,
        request_id: context.request_id,
      });
    }

    // Unexpected server error
    console.error('[ingestion] Unexpected Gemma pipeline error:', err);
    return res.status(500).json({
      ok: false,
      error: 'PIPELINE_ERROR',
      message: 'Internal AI inference error. Please retry.',
      request_id: context.request_id,
    });
  }

  // ── 4. Stage 4: Database Commit & Analytics ────────────────────────────────

  const dbResult = commitReading(parsed, context);

  if (!dbResult.ok) {
    // Constraint violation — parsed data failed physical parameter checks
    return res.status(422).json({
      ok: false,
      error: dbResult.error,
      message: 'Parsed meter data failed physical constraint validation.',
      violations: dbResult.violations,
      parsed,
      request_id: context.request_id,
    });
  }

  // ── 5. Stage 5: SSE Broadcast ──────────────────────────────────────────────

  _sseBroadcast?.({
    type: 'reading_committed',
    payload: dbResult.broadcast_payload,
  });

  // Optionally broadcast anomaly alert as a separate event
  if (dbResult.analytics.anomaly_detected) {
    _sseBroadcast?.({
      type: 'anomaly_alert',
      payload: {
        message: dbResult.analytics.anomaly_reason,
        transaction_id: dbResult.transaction.id,
        captured_at: context.captured_at,
      },
    });
  }

  // ── 6. HTTP Response ──────────────────────────────────────────────────────

  const latency_ms = Date.now() - context.received_at_ms;

  return res.status(200).json({
    ok: true,
    request_id: context.request_id,
    session_id: context.session_id,
    captured_at: context.captured_at,
    latency_ms,
    parsed,
    transaction: dbResult.transaction,
    analytics: dbResult.analytics,
    state_snapshot: dbResult.state_snapshot,
    _meta: {
      image_filename: imageFilename,
      image_mime: imageMimeType,
      image_bytes: imageBuffer.length,
      grid: NAIROBI_GRID_BASELINE,
    },
  });
}

// ─── Multipart Parser ─────────────────────────────────────────────────────────

/**
 * Streams the incoming multipart request and collects the first image file.
 * Returns { imageBuffer, imageMimeType, imageFilename }.
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_FILE_SIZE_BYTES },
    });

    const chunks = [];
    let mimeType = null;
    let filename = null;
    let fileFound = false;

    bb.on('file', (_fieldname, fileStream, info) => {
      fileFound = true;
      mimeType = info.mimeType || 'application/octet-stream';
      filename = info.filename || 'upload';

      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('limit', () => {
        reject(new Error('Uploaded file exceeds the 10 MB size limit.'));
      });
      fileStream.on('end', () => {
        // File stream consumed — wait for busboy finish
      });
      fileStream.on('error', reject);
    });

    bb.on('error', reject);

    bb.on('close', () => {
      if (!fileFound) {
        reject(new Error('No file field found in the multipart payload.'));
        return;
      }
      resolve({
        imageBuffer: Buffer.concat(chunks),
        imageMimeType: mimeType,
        imageFilename: filename,
      });
    });

    req.pipe(bb);
  });
}
