import { useState, useRef, useCallback } from 'react';
import { fmtBase, fromBase } from '../data.js';

export function Sparkline({ data, w = 80, h = 26, stroke = 'currentColor', fill = false, ariaLabel }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  const firstV = data[0], lastV = data[data.length - 1];
  const trendPct = firstV ? ((lastV - firstV) / firstV * 100) : 0;
  const dir = trendPct >= 0 ? 'up' : 'down';
  const label = ariaLabel || `Sparkline trend ${dir} ${Math.abs(trendPct).toFixed(1)} percent over ${data.length} points`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }} role="img" aria-label={label}>
      {fill && <path d={area} fill={stroke} opacity={0.12} />}
      <path d={path} stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * AreaChart with hover crosshair + tooltip. Renders static if no `labels`
 * provided; if `labels` provided, mousemove computes nearest point and
 * draws a vertical guide + value bubble. `formatValue` formats the tooltip
 * number; default falls back to compact integer.
 */
export function AreaChart({
  data, labels, w = 320, h = 120,
  stroke = 'currentColor', accent = 'currentColor',
  showGuides = true, responsive = false,
  formatValue, ariaLabel,
}) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  if (!data || data.length < 2) return null;
  const min = Math.min(...data) * 0.97, max = Math.max(...data) * 1.02;
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 12) - 6,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  const lastY = pts[pts.length - 1][1];
  const svgSize = responsive
    ? { width: '100%', style: { display: 'block', maxWidth: '100%', height: 'auto', cursor: 'crosshair' } }
    : { width: w, height: h, style: { display: 'block', cursor: 'crosshair' } };

  const onMove = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width * w;
    const idx = Math.round((relX / w) * (data.length - 1));
    const clamp = Math.max(0, Math.min(data.length - 1, idx));
    setHover({ idx: clamp, x: pts[clamp][0], y: pts[clamp][1] });
  }, [data, pts, w]);

  const onLeave = () => setHover(null);

  const fmtV = formatValue || ((v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : `${Math.round(v)}`);
  const firstV = data[0], lastV = data[data.length - 1];
  const trendPct = firstV ? ((lastV - firstV) / firstV * 100) : 0;
  const a11yLabel = ariaLabel ||
    `Area chart with ${data.length} points, latest value ${fmtV(lastV)}, ${trendPct >= 0 ? 'up' : 'down'} ${Math.abs(trendPct).toFixed(1)} percent vs start.`;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        {...svgSize}
        viewBox={`0 0 ${w} ${h}`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        role="img"
        aria-label={a11yLabel}
      >
        {showGuides && [0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line key={i} x1="0" x2={w} y1={p * h} y2={p * h} stroke="var(--line-soft)" strokeDasharray={i === 0 || i === 4 ? '' : '2 3'} />
        ))}
        <path d={area} fill={accent} fillOpacity={0.12} />
        <path d={path} stroke={stroke} strokeWidth="1.75" fill="none" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1][0]} cy={lastY} r="3" fill={stroke} />
        <circle cx={pts[pts.length - 1][0]} cy={lastY} r="7" fill={stroke} fillOpacity="0.15" />
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={4} y2={h - 4}
              stroke={stroke} strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
            <circle cx={hover.x} cy={hover.y} r="4" fill={stroke} stroke="var(--paper)" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute',
          top: Math.max(4, hover.y / h * 100) + '%',
          left: Math.min(Math.max(hover.x / w * 100, 8), 92) + '%',
          transform: 'translate(-50%, -120%)',
          pointerEvents: 'none',
          background: 'var(--paper)',
          border: '0.5px solid var(--line-strong)',
          borderRadius: 'var(--r-sm)',
          padding: '5px 9px',
          boxShadow: 'var(--shadow-2)',
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          color: 'var(--ink)',
        }}>
          {labels && labels[hover.idx] && (
            <div className="muted" style={{ fontSize: 9, fontWeight: 500, marginBottom: 1 }}>{labels[hover.idx]}</div>
          )}
          {fmtV(data[hover.idx])}
        </div>
      )}
    </div>
  );
}

/**
 * PortfolioChart — dual-series area chart (net worth + cost basis).
 * Pure SVG, no external library. Hover tooltip via onMouseMove.
 */
export function PortfolioChart({ snapshots = [], displayCurrency = 'RWF', height = 200 }) {
  const [hover, setHover] = useState(null); // { idx, x, y }
  const svgRef = useRef(null);

  const W = 800, H = height, PAD = { t: 16, r: 16, b: 32, l: 0 };
  const CW = W - PAD.l - PAD.r, CH = H - PAD.t - PAD.b;

  if (!snapshots || snapshots.length < 2) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-2)', borderRadius: 'var(--r-md)',
        color: 'var(--ink-3)', fontSize: 13,
      }}>
        Portfolio history builds over time — check back tomorrow.
      </div>
    );
  }

  const nwArr = snapshots.map(s => s.netWorth);
  const cbArr = snapshots.map(s => s.costBasis);
  // Avoid Math.min(...allVals) — spread of 800+ args risks the JS arg-count
  // limit. Iterate explicitly.
  let minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < nwArr.length; i++) {
    if (nwArr[i] < minV) minV = nwArr[i];
    if (nwArr[i] > maxV) maxV = nwArr[i];
    if (cbArr[i] < minV) minV = cbArr[i];
    if (cbArr[i] > maxV) maxV = cbArr[i];
  }
  minV *= 0.96;
  maxV *= 1.02;
  const range = maxV - minV || 1;

  const xOf = (i) => PAD.l + (i / (snapshots.length - 1)) * CW;
  const yOf = (v) => PAD.t + CH - ((v - minV) / range) * CH;

  const polyline = (arr) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

  const nwPath = polyline(nwArr);
  const cbPath = polyline(cbArr);

  // Filled area between cost-basis and net-worth
  const nwArea  = nwPath + ` L${xOf(snapshots.length - 1)},${yOf(minV)} L${xOf(0)},${yOf(minV)} Z`;
  const cbArea  = cbPath + ` L${xOf(snapshots.length - 1)},${yOf(minV)} L${xOf(0)},${yOf(minV)} Z`;

  // Y-axis tick labels
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (range * i) / ticks);

  // X-axis — show every Nth label to avoid clutter.
  // Use the original index from the source array (snapshots.indexOf was O(n²)).
  // Drop the second-to-last tick if it would collide with the final tick (≤ 8% of CW)
  // so "25 May / 26 May" never overlap at the right edge.
  const xStep = Math.max(1, Math.floor(snapshots.length / 6));
  const xLabelsRaw = [];
  for (let i = 0; i < snapshots.length; i++) {
    if (i === 0 || i === snapshots.length - 1 || i % xStep === 0) {
      const s = snapshots[i];
      xLabelsRaw.push({
        date: s.date,
        x: xOf(i),
        label: new Date(s.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      });
    }
  }
  const xLabels = xLabelsRaw.filter((l, i, arr) => {
    if (i === arr.length - 1) return true;
    const next = arr[i + 1];
    return next.x - l.x >= CW * 0.08;
  });

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width * W - PAD.l;
    const idx   = Math.round((relX / CW) * (snapshots.length - 1));
    const clamp = Math.max(0, Math.min(snapshots.length - 1, idx));
    setHover({ idx: clamp, x: xOf(clamp), y: yOf(nwArr[clamp]) });
  }, [snapshots]);

  const snap = hover !== null ? snapshots[hover.idx] : null;
  const gain = snap ? snap.netWorth - snap.costBasis : 0;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height, display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Portfolio growth chart — ${snapshots.length} data points from ${snapshots[0]?.date} to ${snapshots[snapshots.length-1]?.date}. Latest net worth ${fmtBase(snapshots[snapshots.length-1]?.netWorth, displayCurrency, { compact: true })}.`}
      >
        <defs>
          <linearGradient id="pcGradNW" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="pcGradCB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--ink-3)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--ink-3)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line key={i} x1={PAD.l} x2={W - PAD.r} y1={yOf(v)} y2={yOf(v)}
            stroke="var(--line)" strokeWidth="0.5" strokeDasharray={i === 0 ? '' : '3 4'} />
        ))}

        {/* Cost basis fill (bottom layer) */}
        <path d={cbArea} fill="url(#pcGradCB)" />
        <path d={cbPath} stroke="var(--ink-3)" strokeWidth="1.5" fill="none"
          strokeDasharray="4 3" strokeLinecap="round" opacity="0.5" />

        {/* Net worth fill (top layer) */}
        <path d={nwArea} fill="url(#pcGradNW)" />
        <path d={nwPath} stroke="var(--brand)" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 4} textAnchor="middle"
            fontSize="9" fill="var(--ink-4)" fontFamily="inherit">{l.label}</text>
        ))}

        {/* Y-axis labels */}
        {yTicks.slice(1).map((v, i) => (
          <text key={i} x={W - PAD.r + 4} y={yOf(v) + 4} fontSize="9"
            fill="var(--ink-4)" fontFamily="inherit" textAnchor="start">
            {fromBase(v, displayCurrency) >= 1e6
              ? `${(fromBase(v, displayCurrency) / 1e6).toFixed(1)}M`
              : `${(fromBase(v, displayCurrency) / 1e3).toFixed(0)}k`}
          </text>
        ))}

        {/* Hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={PAD.t} y2={H - PAD.b}
              stroke="var(--brand)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <circle cx={hover.x} cy={hover.y} r="5" fill="var(--brand)" stroke="var(--paper)" strokeWidth="2" />
            <circle cx={hover.x} cy={yOf(cbArr[hover.idx])} r="4"
              fill="var(--ink-3)" stroke="var(--paper)" strokeWidth="2" opacity="0.7" />
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hover && snap && (
        <div style={{
          position: 'absolute',
          top: Math.max(8, hover.y - 72),
          left: Math.min(hover.x / 800 * 100, 60) + '%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          background: 'var(--paper)',
          border: '0.5px solid var(--line-strong)',
          borderRadius: 'var(--r-md)',
          padding: '8px 12px',
          boxShadow: 'var(--shadow-3)',
          zIndex: 10,
          minWidth: 160,
        }}>
          <div className="muted" style={{ fontSize: 10, marginBottom: 4 }}>
            {new Date(snap.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
            {fmtBase(snap.netWorth, displayCurrency, { compact: true })}
          </div>
          <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
            Cost: {fmtBase(snap.costBasis, displayCurrency, { compact: true })}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 600, marginTop: 2,
            color: gain >= 0 ? 'var(--up)' : 'var(--down)',
          }}>
            {gain >= 0 ? '+' : ''}{fmtBase(gain, displayCurrency, { compact: true })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'flex-end', marginTop: 4, paddingRight: 8 }}>
        {[
          { color: 'var(--brand)', label: 'Net worth', dash: false },
          { color: 'var(--ink-3)', label: 'Cost basis', dash: true },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="20" height="10" viewBox="0 0 20 10">
              <line x1="0" y1="5" x2="20" y2="5"
                stroke={l.color} strokeWidth="2"
                strokeDasharray={l.dash ? '4 3' : ''} />
            </svg>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Horizontal benchmark comparison bar.
 *
 * Renders two stacked, equal-scaled mini-bars so the portfolio vs benchmark
 * gap is parseable in <0.5s:
 *   • Top  — your portfolio (solid brand color, taller bar)
 *   • Bot  — benchmark      (gold outlined bar)
 * A "spread" pill on the right shows the absolute delta with ✓ (winning)
 * or × (lagging) glyph.
 */
export function BenchmarkBar({ label, portfolioReturn, benchmarkReturn }) {
  const max = Math.max(Math.abs(portfolioReturn), Math.abs(benchmarkReturn), 1) * 1.2;
  const pW = Math.abs(portfolioReturn / max) * 100;
  const bW = Math.abs(benchmarkReturn / max) * 100;
  const pUp = portfolioReturn >= 0;
  const bUp = benchmarkReturn >= 0;
  const spread = portfolioReturn - benchmarkReturn;
  const winning = spread >= 0;
  return (
    <div style={{ marginBottom: 14 }} role="group" aria-label={`${label}: portfolio ${portfolioReturn.toFixed(1)} percent, benchmark ${benchmarkReturn.toFixed(1)} percent, spread ${spread.toFixed(1)} percent`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-2)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 12,
          fontSize: 10, fontWeight: 700,
          background: winning ? 'var(--up-soft)' : 'var(--down-soft)',
          color:      winning ? 'var(--up)'      : 'var(--down)',
          whiteSpace: 'nowrap',
        }} aria-hidden="true">
          {winning ? '▲' : '▼'} {Math.abs(spread).toFixed(1)}pp
        </span>
      </div>
      {/* Portfolio bar — solid brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)', width: 60, flexShrink: 0, fontWeight: 600 }}>You</span>
        <div style={{ position: 'relative', height: 7, flex: 1, background: 'var(--bg-2)', borderRadius: 4 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0,
            width: pW + '%', height: '100%',
            background: pUp ? 'var(--brand)' : 'var(--down)',
            borderRadius: 4,
            transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
          }} />
        </div>
        <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: pUp ? 'var(--up)' : 'var(--down)', minWidth: 50, textAlign: 'right' }}>
          {pUp ? '+' : ''}{portfolioReturn.toFixed(1)}%
        </span>
      </div>
      {/* Benchmark bar — outlined gold */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)', width: 60, flexShrink: 0 }}>Benchmark</span>
        <div style={{ position: 'relative', height: 7, flex: 1, background: 'var(--bg-2)', borderRadius: 4 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0,
            width: bW + '%', height: '100%',
            background: 'transparent',
            border: `1.5px solid ${bUp ? 'var(--gold)' : 'var(--down)'}`,
            borderRadius: 4, boxSizing: 'border-box',
            transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
          }} />
        </div>
        <span className="num" style={{ fontSize: 10.5, fontWeight: 600, color: bUp ? 'var(--gold)' : 'var(--down)', minWidth: 50, textAlign: 'right' }}>
          {bUp ? '+' : ''}{benchmarkReturn.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function Donut({ slices, size = 120, thickness = 14, gap = 1.5, ariaLabel, onSliceHover }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const [hovered, setHovered] = useState(null);
  let offset = 0;
  const label = ariaLabel || (
    slices.length > 0
      ? `Allocation donut: ${slices.map(s => `${s.label || ''} ${(s.value / total * 100).toFixed(0)} percent`).join(', ')}`
      : 'Allocation donut'
  );
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform:'rotate(-90deg)' }}
      role="img"
      aria-label={label}
    >
      {slices.map((s, i) => {
        const len = (s.value / total) * C;
        const seg = Math.max(len - gap, 0);
        const isHover = hovered === i;
        const el = <circle key={i} cx={size/2} cy={size/2} r={r}
            stroke={s.color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offset} strokeLinecap="butt"
            opacity={hovered !== null && !isHover ? 0.35 : 1}
            style={{ transition: 'opacity 150ms ease-out', cursor: onSliceHover ? 'pointer' : 'default' }}
            onMouseEnter={() => { setHovered(i); onSliceHover?.(s, i); }}
            onMouseLeave={() => { setHovered(null); onSliceHover?.(null, null); }} />;
        offset += len;
        return el;
      })}
    </svg>
  );
}
