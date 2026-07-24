import { useState, useRef } from 'react';
import { Camera, FileImage, Loader2, Sparkles, X, CheckCircle2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || null; // e.g. http://localhost:3001/api

const PROCESSING_STAGES = [
  'Gemma 4 compiling visual tokens...',
  'Preprocessing image channels...',
  'Running OCR on meter LCD...',
  'Extracting token sequence...',
  'Validating KPLC checksum...',
];

export function OmniboxPortal({ onCapture }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null); // 'success' | 'error' | null
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const stageTimerRef = useRef(null);

  // Advance processing stage labels while waiting for inference
  const startStageAnimation = () => {
    let s = 0;
    stageTimerRef.current = setInterval(() => {
      s = (s + 1) % PROCESSING_STAGES.length;
      setStage(s);
    }, 700);
  };

  const stopStageAnimation = () => {
    clearInterval(stageTimerRef.current);
  };

  // POST to real backend if API_BASE is configured, else mock
  const handleFile = async (file, source) => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setStage(0);
    setResult(null);
    setErrorMsg('');
    startStageAnimation();

    try {
      if (API_BASE) {
        // ── Real backend call ──────────────────────────────────────────────
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/ingestion`, {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        stopStageAnimation();
        setIsProcessing(false);

        if (json.ok) {
          setResult('success');
          onCapture?.({
            source: json.parsed?.data_source_type === 'MPESA_SCREENSHOT' ? 'M-Pesa' : 'Meter Scan',
            units: json.parsed?.remaining_units_kwh ?? 0,
          });
          setTimeout(() => setResult(null), 3000);
        } else {
          setResult('error');
          setErrorMsg(json.message || 'Visual parsing failed.');
          setTimeout(() => setResult(null), 4000);
        }
      } else {
        // ── Mock simulation (no backend) ────────────────────────────────────
        await new Promise((resolve) => setTimeout(resolve, PROCESSING_STAGES.length * 700));
        stopStageAnimation();
        setIsProcessing(false);
        setResult('success');
        onCapture?.({ source, units: parseFloat((Math.random() * 80 + 20).toFixed(1)) });
        setTimeout(() => setResult(null), 3000);
      }
    } catch (err) {
      stopStageAnimation();
      setIsProcessing(false);
      setResult('error');
      setErrorMsg(err.message || 'Network error — backend may be offline.');
      setTimeout(() => setResult(null), 4000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file, 'Upload');
  };

  return (
    <section className="px-4">
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden cursor-pointer
          ${isDragging ? 'border-emerald-400/70 bg-emerald-500/5' : 'border-slate-700/60 bg-slate-900/50'}
          ${isProcessing ? 'pointer-events-none' : ''}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* Background shimmer on drag */}
        {isDragging && (
          <div className="absolute inset-0 shimmer-bg pointer-events-none" />
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 animate-fade-in">
            {/* Pulsing ring */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 animate-ping absolute inset-0" />
              <div className="w-16 h-16 rounded-full border-2 border-emerald-400/50 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-emerald-400">{PROCESSING_STAGES[stage]}</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                {PROCESSING_STAGES.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i <= stage ? 'bg-emerald-400 w-5' : 'bg-slate-700 w-2'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Success flash */}
        {result === 'success' && (
          <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-300">Token captured successfully!</p>
          </div>
        )}

        {/* Error flash */}
        {result === 'error' && (
          <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2 animate-fade-in px-6">
            <X className="w-10 h-10 text-red-400" />
            <p className="text-sm font-semibold text-red-300 text-center leading-snug">
              {errorMsg || 'Visual parsing failed.'}
            </p>
          </div>
        )}

        <div className="p-5">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-semibold text-slate-200">Capture Meter Data</p>
            </div>
            <p className="text-xs text-slate-500">
              Scan your KPLC meter display or upload an M-Pesa receipt
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Camera Scan */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="group relative flex flex-col items-center gap-2.5 p-4 rounded-xl
                bg-gradient-to-b from-emerald-500/10 to-emerald-500/5
                border border-emerald-500/20 hover:border-emerald-400/40
                active:scale-95 transition-all duration-200 no-select"
              style={{ minHeight: '80px' }}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 group-hover:bg-emerald-500/25 flex items-center justify-center transition-colors">
                <Camera className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-emerald-300 leading-tight">Scan Meter LCD</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Physical meter</p>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0], 'Meter Scan')}
              />
            </button>

            {/* Upload Receipt */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex flex-col items-center gap-2.5 p-4 rounded-xl
                bg-gradient-to-b from-blue-500/10 to-blue-500/5
                border border-blue-500/20 hover:border-blue-400/40
                active:scale-95 transition-all duration-200 no-select"
              style={{ minHeight: '80px' }}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 group-hover:bg-blue-500/25 flex items-center justify-center transition-colors">
                <FileImage className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-blue-300 leading-tight">Upload Receipt</p>
                <p className="text-[10px] text-slate-500 mt-0.5">M-Pesa screenshot</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </button>
          </div>

          {/* Drop hint */}
          <p className="text-center text-[10px] text-slate-600 mt-3">
            or drag & drop an image here
          </p>
        </div>
      </div>
    </section>
  );
}
