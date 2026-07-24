import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { OmniboxPortal } from './components/OmniboxPortal';
import { BalanceGauge } from './components/BalanceGauge';
import { TrendChart } from './components/TrendChart';
import { BillingTable } from './components/BillingTable';
import { ErrorModal } from './components/ErrorModal';
import { useSSE } from './hooks/useSSE';

// ─── Seed Data ──────────────────────────────────────────────────────────────

const INITIAL_BALANCE = 42.5;
const INITIAL_MAX = 100;

const SEED_CHART_DATA = [
  { value: 7.2, anomaly: false },
  { value: 9.8, anomaly: true },
  { value: 6.1, anomaly: false },
  { value: 8.4, anomaly: false },
  { value: 11.3, anomaly: true },
  { value: 5.7, anomaly: false },
  { value: 8.9, anomaly: false },
];

const SEED_LEDGER = [
  {
    id: 'TXN-001',
    date: '22 Jul 26',
    source: 'M-Pesa',
    units: 50.0,
    status: 'Confirmed',
    isFirmware: false,
    tokens: null,
  },
  {
    id: 'TXN-002',
    date: '20 Jul 26',
    source: 'Meter Scan',
    units: 30.0,
    status: 'Verified',
    isFirmware: false,
    tokens: null,
  },
  {
    id: 'TXN-003',
    date: '18 Jul 26',
    source: 'M-Pesa',
    units: 100.0,
    status: 'Confirmed',
    isFirmware: true,
    tokens: [
      '15839204851740293648',
      '29047361850293847162',
      '84920173650294738190',
    ],
  },
  {
    id: 'TXN-004',
    date: '15 Jul 26',
    source: 'M-Pesa',
    units: 20.0,
    status: 'Pending',
    isFirmware: false,
    tokens: null,
  },
];

// ─── Derived helpers ─────────────────────────────────────────────────────────

function computeDaysLeft(balance, chartData) {
  const avgDaily = chartData.reduce((s, d) => s + d.value, 0) / chartData.length;
  return avgDaily > 0 ? Math.round(balance / avgDaily) : 0;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [networkStatus, setNetworkStatus] = useState('syncing');
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [currentLoad, setCurrentLoad] = useState(0.34);
  const [chartData, setChartData] = useState(SEED_CHART_DATA);
  const [ledger, setLedger] = useState(SEED_LEDGER);
  const [errorModal, setErrorModal] = useState({ open: false, message: '' });

  const daysLeft = computeDaysLeft(balance, chartData);

  // SSE event dispatcher
  const handleSSEEvent = useCallback(({ type, payload }) => {
    switch (type) {
      case 'status_change':
        setNetworkStatus(payload.status);
        break;

      case 'balance_update':
        setBalance((prev) => Math.max(0, parseFloat((prev + payload.deltaBalance).toFixed(1))));
        setCurrentLoad(payload.currentLoad);
        break;

      case 'ledger_entry':
        setLedger((prev) => [payload, ...prev].slice(0, 50));
        break;

      case 'chart_update':
        setChartData((prev) => {
          const next = [...prev];
          next[payload.dayIndex] = { value: payload.value, anomaly: payload.anomaly };
          return next;
        });
        break;

      case 'error_event':
        setErrorModal({ open: true, message: payload.message });
        break;

      default:
        break;
    }
  }, []);

  useSSE(handleSSEEvent, 8000);

  // Omnibox capture handler — adds units to balance and logs a ledger entry
  const handleCapture = useCallback(({ source, units }) => {
    setBalance((prev) => parseFloat((prev + units).toFixed(1)));
    const now = new Date();
    setLedger((prev) => [
      {
        id: `TXN-CAP-${Date.now()}`,
        date: now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }),
        source,
        units,
        status: 'Verified',
        isFirmware: false,
        tokens: null,
      },
      ...prev,
    ].slice(0, 50));
  }, []);

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto">
      {/* ── Sticky Header ── */}
      <Header networkStatus={networkStatus} />

      {/* ── Main Scroll Area ── */}
      <main className="flex-1 flex flex-col gap-4 py-4 overflow-y-auto">
        {/* 1. Omnibox Portal */}
        <OmniboxPortal onCapture={handleCapture} />

        {/* 2. Radial Balance Gauge */}
        <BalanceGauge
          balance={balance}
          daysLeft={daysLeft}
          currentLoad={currentLoad}
        />

        {/* 3. Interactive Trend Chart */}
        <TrendChart data={chartData} />

        {/* 4. Token Ledger */}
        <BillingTable entries={ledger} />
      </main>

      {/* ── Error Modal ── */}
      <ErrorModal
        isOpen={errorModal.open}
        message={errorModal.message}
        onClose={() => setErrorModal({ open: false, message: '' })}
        onRetry={() => {
          setErrorModal({ open: false, message: '' });
          // Re-trigger a capture simulation
        }}
        onReportOutage={() => {
          setErrorModal({ open: false, message: '' });
          // Could open tel: link or external outage form
          window.open('https://kplc.co.ke/', '_blank');
        }}
      />
    </div>
  );
}
