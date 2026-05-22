import { CURRENCIES } from '../data.js';

export default function TopBar({ title, subtitle, profile, displayCurrency, onCurrency, right }) {
  return (
    <div className="row" style={{
      padding: '18px 28px', justifyContent:'space-between', alignItems:'center',
      borderBottom: '0.5px solid var(--line)', background:'var(--paper)',
    }}>
      <div>
        {subtitle && <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>{subtitle}</div>}
        <div className="font-serif" style={{ fontSize: 26, lineHeight: 1.1, marginTop: 2 }}>{title}</div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        {right}
        <select value={displayCurrency} onChange={e => onCurrency(e.target.value)} style={{
          padding: '7px 10px', borderRadius: 8, border:'1px solid var(--line)', background:'var(--paper)',
          fontSize: 12, fontFamily:'inherit', color:'var(--ink)',
        }}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
        </select>
        <div style={{
          width: 36, height: 36, borderRadius: 999, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 16,
        }}>{(profile.name || 'You').split(' ').slice(0,2).map(s => s[0] || '').join('').toUpperCase().slice(0,2)}</div>
      </div>
    </div>
  );
}
