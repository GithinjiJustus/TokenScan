import { CheckCircle2, Clock, AlertCircle, Smartphone, ScanLine, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const STATUS_CONFIG = {
  Confirmed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  Verified: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: CheckCircle2 },
  Pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock },
  Failed: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertCircle },
};

const SOURCE_CONFIG = {
  'M-Pesa': { color: 'text-emerald-400', icon: Smartphone },
  'Meter Scan': { color: 'text-blue-400', icon: ScanLine },
  'Upload': { color: 'text-blue-400', icon: ScanLine },
};

function TokenChip({ token }) {
  return (
    <div className="token-chip text-[10px] leading-relaxed break-all">
      {token.match(/.{1,5}/g)?.join(' ') ?? token}
    </div>
  );
}

function FirmwareRow({ entry }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="border border-blue-500/20 rounded-xl bg-blue-500/5 overflow-hidden animate-slide-up">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-blue-500/10 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-300">Firmware Upgrade</span>
            <span className="text-[9px] font-medium text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
              3-Token
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{entry.date} · {entry.source}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-blue-300">{entry.units} kWh</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>

      {/* Token checklist */}
      {expanded && entry.tokens && (
        <div className="px-3 pb-3 border-t border-blue-500/10">
          <div className="flex items-center justify-between mt-2 mb-2">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
              Enter 3-Step Firmware Update Tokens In Sequence ↓
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {entry.tokens.map((tok, i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-slate-900/80 border border-blue-500/20 hover:border-blue-400/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">Step {i + 1}</span>
                  </div>
                  <span className="text-[9px] text-blue-400/80 font-mono">20-digit</span>
                </div>
                <TokenChip token={tok} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerRow({ entry }) {
  const status = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.Pending;
  const source = SOURCE_CONFIG[entry.source] ?? SOURCE_CONFIG['M-Pesa'];
  const StatusIcon = status.icon;
  const SourceIcon = source.icon;

  return (
    <div className="flex items-center gap-3 py-2.5 px-1 border-b border-slate-800/40 last:border-0 animate-fade-in">
      {/* Source Icon */}
      <div className="w-7 h-7 rounded-lg bg-slate-800/80 flex items-center justify-center flex-shrink-0">
        <SourceIcon className={`w-3.5 h-3.5 ${source.color}`} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-slate-200 truncate">{entry.source}</p>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">{entry.date}</p>
      </div>

      {/* Units */}
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-bold text-emerald-400">+{entry.units} kWh</p>
        <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-medium ${status.color} ${status.bg} ${status.border}`}>
          <StatusIcon className="w-2.5 h-2.5" />
          {entry.status}
        </div>
      </div>
    </div>
  );
}

export function BillingTable({ entries }) {
  const [showAll, setShowAll] = useState(false);
  const displayEntries = showAll ? entries : entries.slice(0, 6);

  return (
    <section className="px-4 pb-6">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-300">Token Ledger</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">{entries.length} transactions</p>
          </div>
          <div className="text-xs font-medium text-emerald-400">
            {entries.reduce((acc, e) => acc + e.units, 0).toFixed(1)} kWh total
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 mb-1 px-1">
          <div className="w-7 flex-shrink-0" />
          <p className="flex-1 text-[9px] font-medium uppercase tracking-wider text-slate-600">Source · Date</p>
          <p className="text-[9px] font-medium uppercase tracking-wider text-slate-600 text-right flex-shrink-0">Units · Status</p>
        </div>

        {/* Rows */}
        <div>
          {displayEntries.map((entry) =>
            entry.isFirmware && entry.tokens ? (
              <div key={entry.id} className="mb-2">
                <FirmwareRow entry={entry} />
              </div>
            ) : (
              <LedgerRow key={entry.id} entry={entry} />
            )
          )}
        </div>

        {/* Show more / less */}
        {entries.length > 6 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full mt-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-300
              border border-slate-800/60 rounded-xl transition-colors active:bg-slate-800/30"
          >
            {showAll ? 'Show less ↑' : `Show all ${entries.length} entries ↓`}
          </button>
        )}
      </div>
    </section>
  );
}
