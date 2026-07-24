#!/usr/bin/env node
/**
 * backend/test-receipt.js
 *
 * Test script: feeds the M-Pesa firmware upgrade receipt
 * directly into the /api/ingestion/mock endpoint.
 *
 * Run:  node test-receipt.js
 * (server must be running on PORT 3001)
 */

// ── Receipt Data ──────────────────────────────────────────────────────────────
// Source: MPESA RECEIPT RKB792XJ9K  |  Date: 24/07/2026 14:32 PM
// Strip dashes from token display: "4829-1049-5729-3019-4820" → 20 digits

const RECEIPT = {
  meter_serial_number : '37194820491',
  data_source_type    : 'MPESA_SCREENSHOT',
  remaining_units_kwh : 84.6,
  load_kilowatts      : 0.0,           // Not shown on receipt — default 0
  active_error_code   : null,

  // Three 20-digit firmware upgrade tokens (dashes stripped)
  token_strings: [
    '48291049572930194820',   // Token 1 — Reset
    '91024829401958202940',   // Token 2 — Update
    '04821958204958103948',   // Token 3 — Utility
  ],
};

// ── Send to backend ───────────────────────────────────────────────────────────

const BASE = process.env.API_BASE || 'http://localhost:3001';

async function run() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   TokenScan  —  M-Pesa Receipt Test Ingestion        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log('📤 Sending to:', `${BASE}/api/ingestion/mock`);
  console.log('📋 Payload:\n', JSON.stringify(RECEIPT, null, 2), '\n');

  let res, json;
  try {
    res  = await fetch(`${BASE}/api/ingestion/mock`, {
      method  : 'POST',
      headers : {
        'Content-Type' : 'application/json',
        'X-Session-Id' : 'receipt-test-rKB792XJ9K',
      },
      body: JSON.stringify(RECEIPT),
    });
    json = await res.json();
  } catch (err) {
    console.error('❌ Network error — is the backend running on', BASE, '?');
    console.error(err.message);
    process.exit(1);
  }

  if (!json.ok) {
    console.error('❌ Backend rejected the payload:');
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  // ── Print results ─────────────────────────────────────────────────────────

  const txn = json.transaction;
  const ana = json.analytics;
  const snap = json.state_snapshot;

  console.log('✅  Ingestion successful!\n');

  console.log('─── Transaction ────────────────────────────────────────');
  console.log(`  ID           : ${txn.id}`);
  console.log(`  Source       : ${txn.source}`);
  console.log(`  Units Added  : ${txn.units_added_kwh} kWh`);
  console.log(`  Balance After: ${txn.balance_after_kwh} kWh`);
  console.log(`  Status       : ${txn.status}`);
  console.log(`  Firmware     : ${txn.is_firmware ? '✓ YES — 3-token sequence detected' : 'No'}`);

  if (txn.is_firmware && txn.token_strings) {
    console.log('\n─── Firmware Tokens (segmented) ────────────────────────');
    txn.token_strings.forEach((t, i) =>
      console.log(`  Step ${i + 1}: ${t.replace(/(.{4})/g, '$1-').slice(0, -1)}`)
    );
  }

  console.log('\n─── Analytics ──────────────────────────────────────────');
  console.log(`  Delta kWh    : ${ana.delta_kwh > 0 ? '+' : ''}${ana.delta_kwh}`);
  console.log(`  Avg Daily    : ${ana.average_daily_kwh} kWh/day`);
  console.log(`  Anomaly      : ${ana.anomaly_detected ? `⚠️  ${ana.anomaly_reason}` : 'None'}`);

  console.log('\n─── Live State Snapshot ────────────────────────────────');
  console.log(`  Meter Serial : ${snap.meter_serial}`);
  console.log(`  Balance      : ${snap.current_balance_kwh} kWh`);
  console.log(`  Load         : ${snap.current_load_kw} kW`);
  console.log(`  Days Left    : ${snap.days_left}`);
  console.log(`  Transactions : ${snap.recent_transactions.length} in ledger`);

  console.log('\n🔊  SSE broadcast dispatched to all connected frontend clients.');
  console.log('────────────────────────────────────────────────────────\n');
}

run();
