import { useEffect, useRef, useCallback } from 'react';

const SSE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace('/api', '')}/api/events`
  : null; // null → use mock simulation

/**
 * useSSE - Connects to the real backend SSE stream when VITE_API_URL is set,
 * or falls back to a mock simulation loop every `interval` ms.
 *
 * Event types dispatched:
 *  - 'status_change'     → { status: 'connected' | 'syncing' | 'offline' }
 *  - 'balance_update'    → { deltaBalance, currentLoad }
 *  - 'ledger_entry'      → { id, date, source, units, status, ... }
 *  - 'chart_update'      → { dayIndex, value, anomaly }
 *  - 'error_event'       → { message }
 *  - 'reading_committed' → full backend broadcast payload
 *  - 'state_snapshot'    → initial state on SSE connect
 */
export function useSSE(onEvent, interval = 8000) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  // ── Real SSE connection ────────────────────────────────────────────────────
  useEffect(() => {
    if (!SSE_URL) return; // Fall through to mock simulation

    let es;
    let reconnectTimer;

    function connect() {
      callbackRef.current({ type: 'status_change', payload: { status: 'syncing' } });

      es = new EventSource(SSE_URL, { withCredentials: false });

      es.addEventListener('state_snapshot', (e) => {
        const data = JSON.parse(e.data);
        callbackRef.current({ type: 'state_snapshot', payload: data });
        callbackRef.current({ type: 'status_change', payload: { status: 'connected' } });
      });

      es.addEventListener('reading_committed', (e) => {
        const data = JSON.parse(e.data);
        const p = data;

        // Map backend payload → frontend event shapes
        if (p.gauge) {
          callbackRef.current({
            type: 'balance_update',
            payload: {
              deltaBalance: p.gauge.balance_kwh - (p.transaction?.balance_before_kwh ?? p.gauge.balance_kwh),
              currentLoad: p.gauge.load_kw,
            },
          });
        }
        if (p.transaction) {
          callbackRef.current({ type: 'ledger_entry', payload: adaptTransaction(p.transaction) });
        }
        if (p.chart) {
          p.chart.daily_kwh.forEach((val, i) => {
            callbackRef.current({
              type: 'chart_update',
              payload: { dayIndex: i, value: val, anomaly: p.chart.anomaly_flags?.[i] ?? false },
            });
          });
        }
      });

      es.addEventListener('error_event', (e) => {
        const data = JSON.parse(e.data);
        callbackRef.current({ type: 'error_event', payload: { message: data.message } });
      });

      es.addEventListener('anomaly_alert', (e) => {
        const data = JSON.parse(e.data);
        callbackRef.current({ type: 'error_event', payload: { message: data.message } });
      });

      es.onerror = () => {
        callbackRef.current({ type: 'status_change', payload: { status: 'offline' } });
        es.close();
        // Reconnect after 5 seconds
        reconnectTimer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mock simulation (no backend) ──────────────────────────────────────────
  const generateLedgerEntry = useCallback(() => {
    const sources = ['M-Pesa', 'Meter Scan'];
    const statuses = ['Confirmed', 'Pending', 'Verified'];
    const now = new Date();
    const units = (Math.random() * 50 + 5).toFixed(1);
    const isFirmware = Math.random() < 0.15;
    return {
      id: `TXN-${Date.now()}`,
      date: now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }),
      source: sources[Math.floor(Math.random() * sources.length)],
      units: parseFloat(units),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      isFirmware,
      tokens: isFirmware ? [
        Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join(''),
        Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join(''),
        Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join(''),
      ] : null,
    };
  }, []);

  useEffect(() => {
    if (SSE_URL) return; // Real SSE is active — skip mock

    setTimeout(() => {
      callbackRef.current({ type: 'status_change', payload: { status: 'connected' } });
    }, 1200);

    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      if (tick % 3 === 0) {
        callbackRef.current({ type: 'status_change', payload: { status: 'syncing' } });
        setTimeout(() => {
          callbackRef.current({ type: 'status_change', payload: { status: 'connected' } });
        }, 1800);
        return;
      }

      const roll = Math.random();
      if (roll < 0.35) {
        callbackRef.current({
          type: 'balance_update',
          payload: {
            deltaBalance: -(Math.random() * 2.5 + 0.1),
            currentLoad: parseFloat((Math.random() * 1.2 + 0.1).toFixed(2)),
          },
        });
      } else if (roll < 0.65) {
        callbackRef.current({ type: 'ledger_entry', payload: generateLedgerEntry() });
      } else if (roll < 0.9) {
        callbackRef.current({
          type: 'chart_update',
          payload: {
            dayIndex: Math.floor(Math.random() * 7),
            value: parseFloat((Math.random() * 12 + 1).toFixed(1)),
            anomaly: Math.random() < 0.2,
          },
        });
      } else {
        callbackRef.current({
          type: 'error_event',
          payload: { message: 'Visual parsing failed — meter display unreadable.' },
        });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [interval, generateLedgerEntry]);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Adapts a backend transaction record to the frontend ledger entry shape.
 */
function adaptTransaction(txn) {
  return {
    id: txn.id,
    date: new Date(txn.date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }),
    source: txn.source,
    units: txn.units_added_kwh,
    status: txn.status,
    isFirmware: txn.is_firmware,
    tokens: txn.token_strings,
  };
}
