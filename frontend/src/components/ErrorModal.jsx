import { AlertTriangle, X, RefreshCw, PhoneCall } from 'lucide-react';
import { useEffect } from 'react';

export function ErrorModal({ isOpen, message, onClose, onRetry, onReportOutage }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Modal sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-6 animate-slide-up safe-bottom">
        <div className="glass-card border border-red-500/20 p-6 max-w-lg mx-auto">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Warning icon */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 animate-pulse" />
            </div>
          </div>

          {/* Copy */}
          <div className="text-center mb-6">
            <h3 className="text-base font-bold text-slate-100 mb-2">
              Meter Display Unreadable
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Is the power out or is your meter display damaged?
            </p>
            <p className="text-xs text-slate-600 mt-2 font-mono leading-relaxed">
              {message}
            </p>
          </div>

          {/* Pulse bar */}
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent rounded-full mb-5 animate-pulse" />

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onReportOutage}
              className="btn-danger flex-col gap-1.5 py-3.5"
            >
              <PhoneCall className="w-4.5 h-4.5" size={18} />
              <span className="text-xs">Report Outage</span>
            </button>
            <button
              onClick={onRetry}
              className="btn-primary flex-col gap-1.5 py-3.5"
            >
              <RefreshCw className="w-4.5 h-4.5" size={18} />
              <span className="text-xs">Retry Capture</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            Dismiss for now
          </button>
        </div>
      </div>
    </>
  );
}
