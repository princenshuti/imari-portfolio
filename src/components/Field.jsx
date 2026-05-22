import { Sparkline } from './charts.jsx';

export const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)',
  fontFamily: 'inherit', fontSize: 13, outline:'none',
};

export function Input({ value, onChange, type = 'text', placeholder }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />;
}

export function Field({ label, hint, children, top = 14 }) {
  return (
    <div style={{ marginTop: top }}>
      <div className="row" style={{ justifyContent:'space-between', marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color:'var(--ink-2)', letterSpacing:'0.02em' }}>{label}</label>
        {hint && <span className="muted" style={{ fontSize: 10 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function KPI({ label, value, sub, accent = 'var(--brand)' }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>{label}</div>
      <div className="font-serif" style={{ fontSize: 28, marginTop: 4, letterSpacing:'-0.01em', color: accent }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function TrendCard({ d, big = false }) {
  return (
    <div className="card" style={{ padding: 16, position:'relative' }}>
      <div className="row" style={{ justifyContent:'space-between' }}>
        <div className="muted" style={{ fontSize: 11, fontWeight: 500 }}>{d.label}</div>
        <span className="pill pill-soft" style={{ fontSize: 9 }}>illustrative</span>
      </div>
      <div className="row" style={{ alignItems:'baseline', gap: 8, marginTop: 6 }}>
        <div className="font-serif num" style={{ fontSize: big ? 28 : 22, letterSpacing:'-0.01em' }}>
          {d.unit === '$' ? '$' : ''}{d.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}{d.unit && d.unit !== '$' ? d.unit : ''}
        </div>
        <div className="num" style={{ fontSize: 12, color: d.change >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {d.change >= 0 ? '▲' : '▼'} {Math.abs(d.change).toFixed(2)}{d.unit === '%' ? 'pp' : '%'}
        </div>
      </div>
      <div style={{ marginTop: 6, color: d.color }}>
        <Sparkline data={d.series} w={big ? 240 : 160} h={big ? 38 : 28} stroke={d.color} fill />
      </div>
      <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>{d.source}</div>
    </div>
  );
}
