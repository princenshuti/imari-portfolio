import { fmtBase } from '../data.js';
import { signOut } from '../cloud.js';

const items = [
  { id:'dashboard', label:'Dashboard', glyph:'◐' },
  { id:'accounts',  label:'Accounts',  glyph:'⌬' },
  { id:'assets',    label:'Assets',    glyph:'◆' },
  { id:'trends',    label:'Trends',    glyph:'↗' },
  { id:'advisor',   label:'AI Advisor',glyph:'✦' },
  { id:'settings',  label:'Settings',  glyph:'⚙' },
];

export default function Sidebar({ active, onNav, profile, netWorth, displayCurrency, session, role }) {
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

      <div className="col" style={{ marginTop:'auto', gap: 8 }}>
        {session?.user && (
          <div className="col" style={{ padding: 12, borderRadius: 10, background:'var(--bg-2)', gap: 6 }}>
            <div className="row" style={{ gap: 8, alignItems:'center' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 999, background:'var(--brand)', color:'var(--brand-ink)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 600,
              }}>{session.user.email?.[0]?.toUpperCase() || '?'}</div>
              <div className="col" style={{ minWidth: 0, flex: 1, gap: 2 }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {session.user.email}
                </div>
                <div className="muted" style={{ fontSize: 10, textTransform:'capitalize' }}>{role || 'owner'} access</div>
              </div>
            </div>
            <button onClick={() => signOut()} style={{
              padding:'6px 8px', borderRadius: 7, border:'1px solid var(--line)',
              background:'var(--paper)', cursor:'pointer', fontSize: 11, fontFamily:'inherit', color:'var(--ink-2)',
            }}>
              Sign out
            </button>
          </div>
        )}
        <div className="col" style={{ gap: 4, padding: 10, borderRadius: 10, background:'var(--bg-2)', fontSize: 10.5, color:'var(--ink-3)', lineHeight: 1.5 }}>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ width:6, height:6, borderRadius:999, background:'var(--up)' }}/>
            <span>{session ? 'Synced to cloud' : 'Saved locally'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
