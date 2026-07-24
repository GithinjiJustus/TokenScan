import { useEffect, useRef, useCallback } from 'react';

/**
 * useSSE - Simulates Server-Sent Events with a mock event loop.
 * Every 8 seconds it picks a random event type and calls the provided callback.
 *
 * Event types:
 *  - 'balance_update'  → { balance, daysLeft, currentLoad }
 *  - 'ledger_entry'    → { id, date, source, units, status }
 *  - 'chart_update'    → { dayIndex, value }
 *  - 'error_event'     → { message }
 *  - 'status_change'   → { status: 'connected' | 'syncing' }
 */
export function useSSE(onEvent, interval = 8000) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const generateLedgerEntry = useCallback(() => {
    const sources = ['M-Pesa', 'Meter Scan'];
    const statuses = ['Confirmed', 'Pending', 'Verified'];
    const now = new Date();
    const units = (Math.random() * 50 + 5).toFixed(1);
    return {
      id: `TXN-${Date.now()}`,
      date: now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }),
      source: sources[Math.floor(Math.random() * sources.length)],
      units: parseFloat(units),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      isFirmware: Math.random() < 0.15,
      tokens: Math.random() < 0.15 ? [
        Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join(''),
        Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join(''),
        Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join(''),
      ] : null,
    };
  }, []);

  useEffect(() => {
    // Immediately signal connected after mount
    setTimeout(() => {
      callbackRef.current({ type: 'status_change', payload: { status: 'connected' } });
    }, 1200);

    const eventTypes = ['balance_update', 'ledger_entry', 'chart_update', 'status_change'];
    let tick = 0;

    const timer = setInterval(() => {
      tick++;
      // Every 3rd tick simulate a brief "syncing" blip
      if (tick % 3 === 0) {
        callbackRef.current({ type: 'status_change', payload: { status: 'syncing' } });
        setTimeout(() => {
          callbackRef.current({ type: 'status_change', payload: { status: 'connected' } });
        }, 1800);
        return;
      }

      const roll = Math.random();
      if (roll < 0.35) {
        // Balance fluctuation — slight decrease (consumption)
        callbackRef.current({
          type: 'balance_update',
          payload: {
            deltaBalance: -(Math.random() * 2.5 + 0.1),
            currentLoad: parseFloat((Math.random() * 1.2 + 0.1).toFixed(2)),
          },
        });
      } else if (roll < 0.65) {
        callbackRef.current({
          type: 'ledger_entry',
          payload: generateLedgerEntry(),
        });
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
