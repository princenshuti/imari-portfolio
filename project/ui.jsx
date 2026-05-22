// ui.jsx — small shared building blocks used by every screen.
// Sparkline, Donut, BudgetBar, Avatar, Sheet header, tab bar, etc.

(function(){

// ── Sparkline ──────────────────────────────────────────────────
function Sparkline({ data, w = 80, h = 26, stroke = 'currentColor', fill = false, strokeWidth = 1.5 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {fill && <path d={area} fill={stroke} opacity={0.12} />}
      <path d={path} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Area chart (bigger, used on portfolio/networth) ────────────
function AreaChart({ data, w = 320, h = 120, stroke = 'currentColor', accent = 'currentColor', showGuides = true }) {
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
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {showGuides && [0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1="0" x2={w} y1={p * h} y2={p * h} stroke="var(--line-soft)" strokeDasharray={i === 0 || i === 4 ? '' : '2 3'} />
      ))}
      <defs>
        <linearGradient id={`grad-${Math.random().toFixed(4)}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={accent} fillOpacity={0.12} />
      <path d={path} stroke={stroke} strokeWidth="1.75" fill="none" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={lastY} r="3" fill={stroke} />
      <circle cx={pts[pts.length - 1][0]} cy={lastY} r="7" fill={stroke} fillOpacity="0.15" />
    </svg>
  );
}

// ── Donut (allocation) ─────────────────────────────────────────
function Donut({ slices, size = 120, thickness = 14, gap = 1.5 }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {slices.map((s, i) => {
        const len = (s.value / total) * C;
        const seg = Math.max(len - gap, 0);
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r}
            stroke={s.color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offset}
            strokeLinecap="butt" />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

// ── Budget progress bar ────────────────────────────────────────
function BudgetBar({ spent, budget, color = 'var(--brand)' }) {
  const pct = Math.min((spent / budget) * 100, 100);
  const over = spent > budget;
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--bg-2)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, width: pct + '%', background: over ? 'var(--down)' : color, borderRadius: 999 }} />
      {over && <div style={{ position: 'absolute', top: 0, bottom: 0, left: '100%', width: 2, background: 'var(--down)' }} />}
    </div>
  );
}

// ── Category dot/icon ──────────────────────────────────────────
function CatGlyph({ color = 'var(--brand)', glyph = '◐', size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, background: `color-mix(in oklab, ${color} 18%, transparent)`,
      color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, fontWeight: 600, flexShrink: 0,
    }}>{glyph}</div>
  );
}

const CAT_COLOR = {
  brand: 'var(--brand)', gold: 'var(--gold)', sky: 'var(--sky)',
  plum: 'var(--plum)', clay: 'var(--clay)',
  Rent:'var(--brand)', Groceries:'var(--gold)', Transport:'var(--sky)',
  'MoMo / utils':'var(--plum)', 'Eating out':'var(--clay)', School:'var(--brand)',
  Utilities:'var(--plum)', Investment:'var(--brand)', Income:'var(--up)',
  Pension:'var(--brand-2)', Travel:'var(--sky)', Property:'var(--brand)',
  Household:'var(--gold)', Philanthropy:'var(--plum)', Education:'var(--clay)',
  Other:'var(--ink-3)',
};
const CAT_GLYPH = {
  Rent:'◐', Groceries:'◇', Transport:'△', 'MoMo / utils':'⌬', 'Eating out':'◯',
  School:'▢', Utilities:'⌬', Investment:'↑', Income:'↓', Pension:'⊛',
  Travel:'✈', Property:'◐', Household:'◇', Philanthropy:'❋', Education:'▢',
  Other:'·',
};

// ── Avatar (monogram) ──────────────────────────────────────────
function Avatar({ name = '', size = 36, bg = 'var(--brand)' }) {
  const initials = name.split(' ').slice(0,2).map(s => s[0] || '').join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, background: bg, color: 'var(--brand-ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Instrument Serif, Georgia, serif', fontSize: size * 0.42, flexShrink: 0,
    }}>{initials}</div>
  );
}

// ── Country chip (header) ──────────────────────────────────────
function CountryChip({ country, onClick, mini = false }) {
  const c = window.COUNTRIES[country];
  return (
    <button onClick={onClick} className="row" style={{
      gap: 6, padding: mini ? '4px 8px' : '6px 10px', borderRadius: 999, border: '1px solid var(--line)',
      background: 'var(--paper)', cursor: 'pointer', font: '500 12px Geist',
    }}>
      <span style={{ fontSize: 14 }}>{c.flag}</span>
      <span>{c.code}</span>
      <span className="muted" style={{ fontSize: 11 }}>· {c.currency.code}</span>
    </button>
  );
}

// ── Mobile tab bar (used by every mobile screen) ───────────────
function MobileTabBar({ active, items = [
  { id:'home',  label:'Home',    glyph:'◐' },
  { id:'budget',label:'Budget',  glyph:'▢' },
  { id:'wealth',label:'Wealth',  glyph:'◆' },
  { id:'advisor',label:'Advisor',glyph:'✦' },
  { id:'more',  label:'More',    glyph:'☰' },
]}) {
  return (
    <div className="row" style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 12px 22px',
      borderTop: '0.5px solid var(--line)', background: 'color-mix(in oklab, var(--paper) 88%, transparent)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      justifyContent: 'space-around',
    }}>
      {items.map(it => (
        <div key={it.id} className="col" style={{
          alignItems:'center', gap: 3, color: it.id === active ? 'var(--brand)' : 'var(--ink-3)',
          fontSize: 10, fontWeight: 500, flex: 1,
        }}>
          <div style={{ fontSize: 18, lineHeight: 1 }}>{it.glyph}</div>
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ── Section header (mobile) ────────────────────────────────────
function SectionHead({ title, action }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '0 16px', marginBottom: 10 }}>
      <div className="font-serif" style={{ fontSize: 19, color: 'var(--ink)' }}>{title}</div>
      {action && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{action}</div>}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────
function genSeries(n, base, drift = 0.02, vol = 0.04, seed = 1) {
  let s = base; let r = seed;
  const out = [];
  for (let i = 0; i < n; i++) {
    r = (r * 9301 + 49297) % 233280;
    const noise = (r / 233280 - 0.5) * vol;
    s = s * (1 + drift / n + noise);
    out.push(Math.round(s));
  }
  return out;
}

Object.assign(window, {
  Sparkline, AreaChart, Donut, BudgetBar, CatGlyph, CAT_COLOR, CAT_GLYPH,
  Avatar, CountryChip, MobileTabBar, SectionHead, genSeries,
});
})();
