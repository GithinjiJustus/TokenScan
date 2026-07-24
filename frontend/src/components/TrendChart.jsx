import { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TrendChart({ data }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);

  const chartHeight = 80;
  const chartWidth = 280;
  const barWidth = chartWidth / data.length;

  // Build SVG line path
  const points = data.map((d, i) => {
    const x = i * barWidth + barWidth / 2;
    const y = chartHeight - (d.value / maxVal) * chartHeight * 0.9 + chartHeight * 0.05;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Smooth curve using cubic bezier
  const smoothPath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX} ${prev.y} ${cpX} ${p.y} ${p.x} ${p.y}`;
  }, '');

  // Area fill path
  const areaPath = `${smoothPath} L ${points[points.length - 1].x} ${chartHeight + 10} L ${points[0].x} ${chartHeight + 10} Z`;

  const hasAnomaly = data.some((d) => d.anomaly);
  const trend = values[values.length - 1] > values[values.length - 2];

  const totalConsumption = values.reduce((a, b) => a + b, 0).toFixed(1);
  const avgDaily = (totalConsumption / values.length).toFixed(1);

  return (
    <section className="px-4">
      <div className="glass-card p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-300">7-Day Consumption</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Daily kWh usage trend</p>
          </div>
          <div className="flex items-center gap-2">
            {hasAnomaly && (
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-medium text-amber-400">Anomaly</span>
              </div>
            )}
            <div className={`flex items-center gap-1 text-xs font-medium ${trend ? 'text-red-400' : 'text-emerald-400'}`}>
              {trend ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative" style={{ height: chartHeight + 40 }}>
          <svg
            width="100%"
            viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
            preserveAspectRatio="none"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
              </linearGradient>
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75, 1].map((frac) => (
              <line
                key={frac}
                x1={0} y1={chartHeight * (1 - frac) + chartHeight * 0.05}
                x2={chartWidth} y2={chartHeight * (1 - frac) + chartHeight * 0.05}
                stroke="rgba(51,65,85,0.5)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Anomaly highlight bands */}
            {data.map((d, i) => {
              if (!d.anomaly) return null;
              const x = i * barWidth;
              return (
                <rect
                  key={`anomaly-${i}`}
                  x={x}
                  y={0}
                  width={barWidth}
                  height={chartHeight + 10}
                  fill="url(#anomalyGrad)"
                  rx={4}
                />
              );
            })}

            {/* Area fill */}
            <path d={areaPath} fill="url(#areaGrad)" />

            {/* Line */}
            <path
              d={smoothPath}
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
            />

            {/* Data points */}
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 6 : 4}
                  fill={p.anomaly ? '#f59e0b' : '#34d399'}
                  stroke={p.anomaly ? '#fbbf24' : '#6ee7b7'}
                  strokeWidth="2"
                  filter={hoveredIndex === i ? "url(#lineGlow)" : undefined}
                  style={{ transition: 'r 0.15s ease' }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                />
                {/* Tooltip on hover */}
                {hoveredIndex === i && (
                  <g>
                    <rect
                      x={Math.min(Math.max(p.x - 22, 0), chartWidth - 44)}
                      y={p.y - 30}
                      width={44}
                      height={20}
                      fill="rgba(15,23,42,0.95)"
                      stroke="rgba(52,211,153,0.3)"
                      strokeWidth="1"
                      rx="6"
                    />
                    <text
                      x={Math.min(Math.max(p.x, 22), chartWidth - 22)}
                      y={p.y - 15}
                      textAnchor="middle"
                      fill={p.anomaly ? '#fbbf24' : '#34d399'}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="600"
                    >
                      {p.value} kWh
                    </text>
                  </g>
                )}
              </g>
            ))}

            {/* Day labels */}
            {DAYS.map((day, i) => (
              <text
                key={day}
                x={i * barWidth + barWidth / 2}
                y={chartHeight + 30}
                textAnchor="middle"
                fill={hoveredIndex === i ? '#94a3b8' : 'rgba(100,116,139,0.7)'}
                fontSize="9"
                fontFamily="Inter, sans-serif"
              >
                {day}
              </text>
            ))}
          </svg>
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800/60">
          <div className="flex-1 text-center">
            <p className="metric-label">7-Day Total</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">{totalConsumption} kWh</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex-1 text-center">
            <p className="metric-label">Daily Avg</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">{avgDaily} kWh</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex-1 text-center">
            <p className="metric-label">Peak Day</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">
              {DAYS[values.indexOf(maxVal)]}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
