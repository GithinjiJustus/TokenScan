import { Wifi, WifiOff, RefreshCw, Zap } from 'lucide-react';

export function Header({ networkStatus }) {
  const isConnected = networkStatus === 'connected';
  const isSyncing = networkStatus === 'syncing';

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50" />
      
      <div className="relative flex items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Zap className="w-4.5 h-4.5 text-slate-950" fill="currentColor" size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight gradient-text-emerald leading-none">
              TokenScan
            </h1>
            <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
              KPLC Utility Dashboard
            </p>
          </div>
        </div>

        {/* Network Status Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all duration-500 ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : isSyncing
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {isSyncing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : isConnected ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span>{isSyncing ? 'Syncing' : isConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
