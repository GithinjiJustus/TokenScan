/**
 * backend/database/models/ledger.js
 *
 * In-memory mock database engine for TokenScan.
 *
 * Responsibilities:
 *  - Hold the live household energy ledger (balance, transactions, chart data)
 *  - Validate incoming meter readings against realistic physical parameters
 *  - Compute consumption deltas + spike anomaly detection
 *  - Handle KPLC 3-token firmware upgrade sequence segmentation
 *  - Emit structured DB commit payloads consumable by the SSE broadcaster
 */

// ─── Physical Parameter Constraints ─────────────────────────────────────────

const CONSTRAINTS = {
  MIN_UNITS_KWH: 0,
  MAX_UNITS_KWH: 999.9,      // Standard KPLC prepay meter cap
  MIN_LOAD_KW: 0,
  MAX_LOAD_KW: 15,            // Max residential single-phase load in Kenya
  SPIKE_THRESHOLD_RATIO: 2.5, // >2.5x average = anomaly
  TOKEN_LENGTH: 20,           // KPLC standard token digit count
  FIRMWARE_TOKEN_COUNT: 3,    // Firmware upgrades require 3 consecutive tokens
};

// ─── KPLC Nairobi Grid Metadata Baseline ─────────────────────────────────────

const GRID_BASELINE = {
  region: 'Nairobi',
  country: 'KE',
  utility: 'KPLC',
  grid_frequency_hz: 50,
  nominal_voltage: 240,
  supply_type: 'Single-Phase',
};

// ─── In-Memory State ─────────────────────────────────────────────────────────

const state = {
  meter_serial: 'KEN-NBI-04-XXXX',
  current_balance_kwh: 42.5,
  current_load_kw: 0.34,
  last_reading_at: new Date().toISOString(),

  // 7-day rolling daily consumption buckets (most recent = index 6)
  daily_consumption_kwh: [7.2, 9.8, 6.1, 8.4, 11.3, 5.7, 8.9],

  // Running ledger — newest first
  transactions: [
    {
      id: 'TXN-SEED-001',
      date: _isoDate(-2),
      source: 'M-Pesa',
      units_added_kwh: 50.0,
      balance_after_kwh: 92.5,
      status: 'Confirmed',
      is_firmware: false,
      token_strings: null,
      error_code: null,
    },
    {
      id: 'TXN-SEED-002',
      date: _isoDate(-4),
      source: 'Meter Scan',
      units_added_kwh: 30.0,
      balance_after_kwh: 42.5,
      status: 'Verified',
      is_firmware: false,
      token_strings: null,
      error_code: null,
    },
    {
      id: 'TXN-SEED-003',
      date: _isoDate(-6),
      source: 'M-Pesa',
      units_added_kwh: 100.0,
      balance_after_kwh: 142.5,
      status: 'Confirmed',
      is_firmware: true,
      token_strings: [
        '15839204851740293648',
        '29047361850293847162',
        '84920173650294738190',
      ],
      error_code: null,
    },
  ],
};

// Helper — ISO date string N days from now
function _isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

// ─── Constraint Validator ────────────────────────────────────────────────────

/**
 * Validates parsed AI output metrics against physical grid parameters.
 * Returns { valid: boolean, violations: string[] }
 */
function validateConstraints(parsed) {
  const violations = [];

  const units = parsed.remaining_units_kwh;
  if (typeof units !== 'number' || units < CONSTRAINTS.MIN_UNITS_KWH || units > CONSTRAINTS.MAX_UNITS_KWH) {
    violations.push(`remaining_units_kwh (${units}) out of bounds [${CONSTRAINTS.MIN_UNITS_KWH}, ${CONSTRAINTS.MAX_UNITS_KWH}]`);
  }

  const load = parsed.load_kilowatts;
  if (typeof load !== 'number' || load < CONSTRAINTS.MIN_LOAD_KW || load > CONSTRAINTS.MAX_LOAD_KW) {
    violations.push(`load_kilowatts (${load}) out of bounds [${CONSTRAINTS.MIN_LOAD_KW}, ${CONSTRAINTS.MAX_LOAD_KW}]`);
  }

  if (!['PHYSICAL_LCD', 'MPESA_SCREENSHOT'].includes(parsed.data_source_type)) {
    violations.push(`data_source_type "${parsed.data_source_type}" is not a recognised value`);
  }

  return { valid: violations.length === 0, violations };
}

// ─── Token Segmentation ──────────────────────────────────────────────────────

/**
 * KPLC firmware upgrades come as either:
 *  a) A single 60-digit string (three tokens concatenated)
 *  b) An array of 3 × 20-digit strings
 *
 * Returns a normalised array of exactly three 20-digit token strings,
 * or null if the token list is not a firmware sequence.
 */
function segmentFirmwareTokens(token_strings) {
  if (!Array.isArray(token_strings) || token_strings.length === 0) return null;

  // Case A — single concatenated 60-digit string
  if (token_strings.length === 1 && /^\d{60}$/.test(token_strings[0])) {
    const s = token_strings[0];
    return [s.slice(0, 20), s.slice(20, 40), s.slice(40, 60)];
  }

  // Case B — already three 20-digit strings
  if (
    token_strings.length === CONSTRAINTS.FIRMWARE_TOKEN_COUNT &&
    token_strings.every((t) => /^\d{20}$/.test(t))
  ) {
    return token_strings;
  }

  return null; // Normal single-token topup
}

// ─── Consumption Analytics ───────────────────────────────────────────────────

/**
 * Computes analytics relative to historical state.
 * Returns { delta_kwh, anomaly_detected, anomaly_reason, average_daily_kwh }
 */
function computeAnalytics(new_units_kwh) {
  const prev = state.current_balance_kwh;
  const delta = parseFloat((new_units_kwh - prev).toFixed(2));

  const avg = state.daily_consumption_kwh.reduce((a, b) => a + b, 0) / state.daily_consumption_kwh.length;
  const avgDaily = parseFloat(avg.toFixed(2));

  // Today's implicit consumption since last reading
  const todayConsumption = delta < 0 ? Math.abs(delta) : 0;

  let anomaly_detected = false;
  let anomaly_reason = null;

  if (todayConsumption > avgDaily * CONSTRAINTS.SPIKE_THRESHOLD_RATIO) {
    anomaly_detected = true;
    anomaly_reason = `Consumption spike: ${todayConsumption.toFixed(1)} kWh vs avg ${avgDaily.toFixed(1)} kWh/day`;
  }

  // Error 30 / grid dropout detection
  if (new_units_kwh === 0 && prev > 1) {
    anomaly_detected = true;
    anomaly_reason = 'Grid dropout or Error 30 — balance dropped to zero unexpectedly';
  }

  return { delta_kwh: delta, anomaly_detected, anomaly_reason, average_daily_kwh: avgDaily };
}

// ─── DB Commit ───────────────────────────────────────────────────────────────

/**
 * Main entry-point called by the ingestion controller after Gemma inference.
 *
 * @param {object} parsed  — Structured JSON from gemma.js
 * @param {object} context — Request context (session_id, captured_at, etc.)
 * @returns {object}       — Full commit result: { ok, transaction, analytics, state_snapshot, violations }
 */
function commitReading(parsed, context) {
  // 1. Constraint validation
  const { valid, violations } = validateConstraints(parsed);

  if (!valid) {
    return {
      ok: false,
      error: 'CONSTRAINT_VIOLATION',
      violations,
      parsed,
    };
  }

  // 2. Firmware token segmentation
  const firmwareTokens = segmentFirmwareTokens(parsed.token_strings);
  const isFirmware = firmwareTokens !== null;

  // 3. Analytics
  const analytics = computeAnalytics(parsed.remaining_units_kwh);

  // 4. Update rolling daily consumption (shift window)
  const dayConsumption = analytics.delta_kwh < 0 ? Math.abs(analytics.delta_kwh) : 0;
  state.daily_consumption_kwh = [...state.daily_consumption_kwh.slice(1), dayConsumption];

  // 5. Determine units added (if reading shows more than current balance, a topup happened)
  const units_added = analytics.delta_kwh > 0 ? analytics.delta_kwh : 0;

  // 6. Update state
  const prev_balance = state.current_balance_kwh;
  state.current_balance_kwh = parseFloat(parsed.remaining_units_kwh.toFixed(1));
  state.current_load_kw = parsed.load_kilowatts;
  state.last_reading_at = context.captured_at;
  if (parsed.meter_serial_number) {
    state.meter_serial = parsed.meter_serial_number;
  }

  // 7. Build transaction record
  const txn = {
    id: `TXN-${Date.now()}`,
    date: context.captured_at,
    source: parsed.data_source_type === 'MPESA_SCREENSHOT' ? 'M-Pesa' : 'Meter Scan',
    units_added_kwh: parseFloat(units_added.toFixed(1)),
    balance_before_kwh: parseFloat(prev_balance.toFixed(1)),
    balance_after_kwh: state.current_balance_kwh,
    status: 'Verified',
    is_firmware: isFirmware,
    token_strings: isFirmware ? firmwareTokens : (parsed.token_strings ?? null),
    error_code: parsed.active_error_code ?? null,
    analytics,
    session_id: context.session_id,
    grid: GRID_BASELINE,
  };

  state.transactions.unshift(txn);
  if (state.transactions.length > 200) state.transactions.pop(); // Evict oldest

  // 8. Build SSE broadcast payload
  const broadcast_payload = {
    event: 'reading_committed',
    transaction: txn,
    gauge: {
      balance_kwh: state.current_balance_kwh,
      load_kw: state.current_load_kw,
      days_left: computeDaysLeft(state.current_balance_kwh),
    },
    chart: {
      daily_kwh: [...state.daily_consumption_kwh],
      anomaly_flags: state.daily_consumption_kwh.map(
        (v) => v > (analytics.average_daily_kwh * CONSTRAINTS.SPIKE_THRESHOLD_RATIO)
      ),
    },
    alert: analytics.anomaly_detected
      ? { type: 'ANOMALY', message: analytics.anomaly_reason }
      : null,
  };

  return {
    ok: true,
    transaction: txn,
    analytics,
    broadcast_payload,
    state_snapshot: getStateSnapshot(),
  };
}

// ─── State Helpers ───────────────────────────────────────────────────────────

function computeDaysLeft(balance_kwh) {
  const avg = state.daily_consumption_kwh.reduce((a, b) => a + b, 0) / state.daily_consumption_kwh.length;
  return avg > 0 ? Math.round(balance_kwh / avg) : 0;
}

/**
 * Returns a safe serialisable snapshot of current state (for initial SSE handshake).
 */
function getStateSnapshot() {
  return {
    meter_serial: state.meter_serial,
    current_balance_kwh: state.current_balance_kwh,
    current_load_kw: state.current_load_kw,
    days_left: computeDaysLeft(state.current_balance_kwh),
    daily_consumption_kwh: [...state.daily_consumption_kwh],
    last_reading_at: state.last_reading_at,
    recent_transactions: state.transactions.slice(0, 20),
    grid: GRID_BASELINE,
  };
}

export { commitReading, getStateSnapshot, validateConstraints, segmentFirmwareTokens, GRID_BASELINE };
