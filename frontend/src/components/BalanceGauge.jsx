import { useEffect, useRef, useState } from 'react';
import { Zap, Clock, Activity } from 'lucide-react';

const MAX_KWH = 100;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function BalanceGauge({ balance, daysLeft, currentLoad }) {
  const prevBalanceRef = useRef(balance);
  const [displayBalance, setDisplayBalance] = useState(balance);
  const animFrameRef = useRef(null);

  // Smooth number animation when balance changes
  useEffect(() => {
    const from = prevBalanceRef.current;
    const to = balance;
    if (Math.abs(from - to) < 0.01) return;

    const duration = 800;
    const start = performance.now();

    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayBalance(parseFloat((from + (to - from) * eased).toFixed(1)));
      if (t < 1) animFrameRef.current = requestAnimationFrame(animate);
      else prevBalanceRef.current = to;
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [balance]);

  const pct = Math.min(Math.max(displayBalance / MAX_KWH, 0), 1);
  const startAngle = -135;
  const endAngle = 135;
  const sweepAngle = startAngle + (endAngle - startAngle) * pct;

  const cx = 100, cy = 100, r = 80;
  const trackPath = describeArc(cx, cy, r, startAngle, endAngle);
  const fillPath = pct > 0.001 ? describeArc(cx, cy, r, startAngle, sweepAngle) : '';

  // Color based on level
  const gaugeColor = pct > 0.4
    ? '#34d399'   // emerald
    : pct > 0.2
    ? '#fbbf24'   // amber
    : '#f87171';  // red

  const glowColor = pct > 0.4
    ? 'rgba(52, 211, 153, 0.5)'
    : pct > 0.2
    ? 'rgba(251, 191, 36, 0.5)'
    : 'rgba(248, 113, 113, 0.5)';

  return (
    <section className="px-4">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Energy Balance</h2>
          <span className="text-[10px] font-medium text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">
            Live
          </span>
        </div>

        {/* SVG Gauge */}
        <div className="flex justify-center">
          <div className="relative" style={{ width: 200, height: 200 }}>
            <svg
              viewBox="0 0 200 200"
              width="200"
              height="200"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={gaugeColor} stopOpacity="0.7" />
                  <stop offset="100%" stopColor={gaugeColor} stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Track */}
              <path
                d={trackPath}
                fill="none"
                stroke="rgba(51, 65, 85, 0.8)"
                strokeWidth="12"
                strokeLinecap="round"
              />

              {/* Tick marks */}
              {Array.from({ length: 11 }).map((_, i) => {
                const angle = startAngle + (i / 10) * (endAngle - startAngle);
                const inner = polarToCartesian(cx, cy, 64, angle);
                const outer = polarToCartesian(cx, cy, 70, angle);
                return (
                  <line
                    key={i}
                    x1={inner.x} y1={inner.y}
                    x2={outer.x} y2={outer.y}
                    stroke="rgba(100, 116, 139, 0.4)"
                    strokeWidth={i % 5 === 0 ? 2 : 1}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Fill arc */}
              {fillPath && (
                <path
                  d={fillPath}
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  style={{ transition: 'stroke 0.6s ease' }}
                />
              )}

              {/* Needle cap dot */}
              {pct > 0.001 && (() => {
                const tip = polarToCartesian(cx, cy, r, sweepAngle);
                return (
                  <circle
                    cx={tip.x}
                    cy={tip.y}
                    r={6}
                    fill={gaugeColor}
                    filter="url(#glow)"
                  />
                );
              })()}

              {/* Center content */}
              <text x={cx} y={cy - 14} textAnchor="middle" fill={gaugeColor} fontSize="26" fontWeight="800" fontFamily="Inter, sans-serif">
                {displayBalance.toFixed(1)}
              </text>
              <text x={cx} y={cy + 6} textAnchor="middle" fill="rgba(148,163,184,0.9)" fontSize="11" fontFamily="Inter, sans-serif">
                kWh remaining
              </text>

              {/* Min / Max labels */}
              <text x="28" y="175" textAnchor="middle" fill="rgba(100,116,139,0.7)" fontSize="9" fontFamily="Inter, sans-serif">0</text>
              <text x="172" y="175" textAnchor="middle" fill="rgba(100,116,139,0.7)" fontSize="9" fontFamily="Inter, sans-serif">{MAX_KWH}</text>
            </svg>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="metric-label">Est. Days Left</p>
              <p className="text-sm font-bold text-blue-300 mt-0.5">{daysLeft} Days</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="metric-label">Current Load</p>
              <p className="text-sm font-bold text-amber-300 mt-0.5">{currentLoad} kW</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
