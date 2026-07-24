import { useState, useRef } from 'react';
import { Camera, FileImage, Loader2, Sparkles, X, CheckCircle2 } from 'lucide-react';

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
  const [result, setResult] = useState(null); // 'success' | null
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const stageTimerRef = useRef(null);

  const simulateProcessing = (source) => {
    setIsProcessing(true);
    setStage(0);
    setResult(null);

    let s = 0;
    stageTimerRef.current = setInterval(() => {
      s++;
      if (s < PROCESSING_STAGES.length) {
        setStage(s);
      } else {
        clearInterval(stageTimerRef.current);
        setIsProcessing(false);
        setResult('success');
        onCapture?.({ source, units: parseFloat((Math.random() * 80 + 20).toFixed(1)) });
        setTimeout(() => setResult(null), 3000);
      }
    }, 700);
  };

  const handleFile = (file) => {
    if (!file || isProcessing) return;
    simulateProcessing('Upload');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
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
              onClick={() => { cameraInputRef.current?.click(); simulateProcessing('Meter Scan'); }}
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
                onChange={(e) => handleFile(e.target.files[0])}
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
