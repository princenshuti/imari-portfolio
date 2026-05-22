import { Sparkline } from './charts.jsx';

export const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-strong)',
  background: 'var(--paper-2)', color: 'var(--ink)',
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
  transition: 'border-color 0.14s, box-shadow 0.14s',
};

export function Input({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

export function Field({ label, hint, children, top = 14 }) {
  return (
    <div style={{ marginTop: top }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{
          fontSize: 11, fontWeight: 600, color: 'var(--ink-2)',
          letterSpacing: '0.02em',
        }}>{label}</label>
        {hint && <span className="muted" style={{ fontSize: 10 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function KPI({ label, value, sub, accent = 'var(--brand)' }) {
  return (
    <div className="card-stat" style={{ '--stat-accent': accent }}>
      <div className="muted" style={{
        fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
      }}>{label}</div>
      <div className="font-serif" style={{
        fontSize: 26, marginTop: 6, letterSpacing: '-0.015em', lineHeight: 1,
        color: accent === 'var(--brand)' ? 'var(--ink)' : accent,
      }}>{value}</div>
      {sub && (
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

export function TrendCard({ d, big = false }) {
  const isUp = d.change >= 0;
  return (
    <div className="card hover-lift" style={{ padding: big ? 20 : 16, position: 'relative', cursor: 'default' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{d.label}</div>
        <span className="pill pill-soft" style={{ fontSize: 9 }}>illustrative</span>
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
        <div className="font-serif num" style={{
          fontSize: big ? 28 : 20,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {d.unit === '$' ? '$' : ''}{d.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}{d.unit && d.unit !== '$' ? d.unit : ''}
        </div>
        <div className="num" style={{
          fontSize: 11, fontWeight: 600,
          color: isUp ? 'var(--up)' : 'var(--down)',
        }}>
          {isUp ? '▲' : '▼'} {Math.abs(d.change).toFixed(2)}{d.unit === '%' ? 'pp' : '%'}
        </div>
      </div>
      <div style={{ marginTop: 8, color: d.color }}>
        <Sparkline data={d.series} w={big ? 240 : 160} h={big ? 40 : 30} stroke={d.color} fill />
      </div>
      <div className="muted" style={{ fontSize: 9.5, marginTop: 4 }}>{d.source}</div>
    </div>
  );
}
