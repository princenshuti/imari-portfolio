import { CURRENCIES } from '../data.js';
import { fmtBase } from '../data.js';

const items = [
  { id:'dashboard', label:'Dashboard', glyph:'◐' },
  { id:'accounts',  label:'Accounts',  glyph:'⌬' },
  { id:'assets',    label:'Assets',    glyph:'◆' },
  { id:'trends',    label:'Trends',    glyph:'↗' },
  { id:'advisor',   label:'AI Advisor',glyph:'✦' },
  { id:'settings',  label:'Settings',  glyph:'⚙' },
];

export default function Sidebar({ active, onNav, profile, netWorth, displayCurrency }) {
  return (
    <div className="col" style={{
      width: 240, padding: '22px 16px', background:'var(--paper)',
      borderRight: '0.5px solid var(--line)', gap: 20, flexShrink: 0, height: '100vh', position:'sticky', top: 0,
    }}>
      <div className="row" style={{ gap: 10, padding: '0 6px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Instrument Serif, serif', fontSize: 20,
        }}>●</div>
        <div>
          <div className="font-serif" style={{ fontSize: 19, lineHeight: 1 }}>Imari</div>
          <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>Personal Portfolio</div>
        </div>
      </div>

      <div className="col" style={{ padding: 14, borderRadius: 12, background:'var(--bg-2)', gap: 4 }}>
        <div className="muted" style={{ fontSize: 10, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>Net worth</div>
        <div className="font-serif" style={{ fontSize: 26, letterSpacing:'-0.02em', lineHeight: 1.1 }}>
          {fmtBase(netWorth, displayCurrency, { compact: true })}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>{displayCurrency} · {profile.name || 'You'}</div>
      </div>

      <div className="col" style={{ gap: 1 }}>
        {items.map(it => (
          <div key={it.id} onClick={() => onNav(it.id)} style={{
            display:'flex', alignItems:'center', gap: 12, padding: '9px 11px', borderRadius: 9,
            background: it.id === active ? 'var(--brand-soft)' : 'transparent',
            color: it.id === active ? 'var(--brand)' : 'var(--ink-2)',
            fontSize: 13.5, fontWeight: it.id === active ? 600 : 500, cursor:'pointer',
            transition: 'background .12s',
          }}>
            <span style={{ width: 16, textAlign:'center', fontSize: 15 }}>{it.glyph}</span>
            <span>{it.label}</span>
          </div>
        ))}
      </div>

      <div className="col" style={{ marginTop:'auto', gap: 6, padding: 12, borderRadius: 10, background:'var(--bg-2)', fontSize: 11, color:'var(--ink-3)', lineHeight: 1.5 }}>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ width:6, height:6, borderRadius:999, background:'var(--up)' }}/>
          <span>Saved locally · this browser</span>
        </div>
        <div className="muted" style={{ fontSize: 10 }}>Use Settings to back up to JSON</div>
      </div>
    </div>
  );
}
