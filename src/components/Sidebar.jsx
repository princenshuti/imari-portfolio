import { fmtBase, toBase } from '../data.js';
import { signOut } from '../cloud.js';
import { MaxventuresIcon } from './MaxventuresLogo.jsx';
import { navItemsByGroup } from '../nav.js';

const NAV_GROUPS = navItemsByGroup();

export default function Sidebar({ active, onNav, profile, netWorth, totalCost, displayCurrency, session, role, liabilities = [] }) {
  const totalDebt = liabilities.reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0);
  const trueNetWorth = netWorth; // already assets-liabilities in App.jsx
  const gain    = netWorth - totalCost;
  const gainPct = totalCost ? (gain / totalCost) * 100 : 0;
  const up      = gain >= 0;
  const initials = (profile.name || 'You').split(' ').slice(0,2).map(s => s[0] || '').join('').toUpperCase().slice(0,2);

  return (
    <aside className="col sidebar-desktop" style={{
      width: 244, padding: '20px 14px',
      background: 'var(--paper)',
      borderRight: '0.5px solid var(--line)',
      gap: 14, flexShrink: 0,
      height: '100vh', position: 'sticky', top: 0, overflowY: 'auto',
    }}>

      {/* ── Brand mark — clickable home link ── */}
      <button
        type="button"
        onClick={() => onNav('dashboard')}
        aria-label="Go to Dashboard"
        className="sidebar-brand"
        style={{
          all: 'unset',
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '6px 6px', borderRadius: 'var(--r-md)',
          cursor: 'pointer',
          transition: 'background 0.14s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <MaxventuresIcon size={38} id="sidebar-mv" />
        <div>
          <div className="font-serif" style={{ fontSize: 21, lineHeight: 1, letterSpacing: '-0.02em' }}>Imari</div>
          <div className="muted" style={{ fontSize: 9.5, marginTop: 2, letterSpacing: '0.03em' }}>by Maxventures</div>
        </div>
      </button>

      {/* ── Net worth card ── */}
      <button onClick={() => onNav('dashboard')} style={{
        all: 'unset', display: 'block', cursor: 'pointer',
        padding: 16, borderRadius: 'var(--r-lg)',
        background: 'linear-gradient(145deg, var(--brand-softer) 0%, var(--bg-2) 100%)',
        border: '0.5px solid var(--brand-soft)',
        boxSizing: 'border-box', width: '100%',
        transition: 'box-shadow 0.16s ease, transform 0.16s ease',
        boxShadow: 'var(--shadow-1)',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-3)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <div className="col" style={{ gap: 1 }}>
          <div className="muted" style={{ fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700 }}>True net worth</div>
          <div className="font-serif" style={{ fontSize: 24, letterSpacing: '-0.025em', lineHeight: 1.1, marginTop: 2, color: 'var(--ink)' }}>
            {fmtBase(trueNetWorth, displayCurrency, { compact: true })}
          </div>
        </div>

        <div style={{ height: '0.5px', background: 'var(--line)', margin: '10px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="col" style={{ gap: 1 }}>
            <div className="muted" style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Assets</div>
            <div className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--up-ink)' }}>
              {fmtBase(netWorth + totalDebt, displayCurrency, { compact: true })}
            </div>
          </div>
          {totalDebt > 0 && (
            <div className="col" style={{ gap: 1 }}>
              <div className="muted" style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Debt</div>
              <div className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--down-ink)' }}>
                <span aria-hidden="true">−</span>{fmtBase(totalDebt, displayCurrency, { compact: true })}
              </div>
            </div>
          )}
        </div>

        {totalCost > 0 && (
          <div className="row" style={{ gap: 7, alignItems: 'center', marginTop: 8 }}>
            <span className={`pill ${up ? 'pill-up' : 'pill-down'}`} style={{ fontSize: 10 }}>
              <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(gainPct).toFixed(1)}%
            </span>
            <span className="muted" style={{ fontSize: 10 }}>
              {up ? '+' : ''}{fmtBase(gain, displayCurrency, { compact: true })}
            </span>
          </div>
        )}

        <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>
          {displayCurrency} · {profile.name || 'You'}
        </div>
      </button>

      {/* ── Nav groups ── */}
      <nav className="col" style={{ gap: 14 }} aria-label="Main navigation">
        {NAV_GROUPS.map(grp => (
          <div key={grp.label}>
            <div className="muted" style={{
              fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700,
              padding: '0 12px', marginBottom: 3,
            }}>{grp.label}</div>
            <div className="col" style={{ gap: 1 }}>
              {grp.items.map(it => (
                <button
                  key={it.id}
                  className={`nav-btn${it.id === active ? ' active' : ''}`}
                  onClick={() => onNav(it.id)}
                  aria-current={it.id === active ? 'page' : undefined}
                >
                  <span aria-hidden="true" style={{ width: 18, textAlign: 'center', fontSize: 13, opacity: it.id === active ? 1 : 0.65 }}>{it.glyph}</span>
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="col" style={{ marginTop: 'auto', gap: 8 }}>
        <div style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-2)', fontSize: 10.5 }}>
          <div className="row" style={{ gap: 6 }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: session ? 'var(--up)' : 'var(--gold)',
              boxShadow: session ? '0 0 0 2px var(--up-soft)' : '0 0 0 2px var(--gold-soft)',
            }}/>
            <span className="muted">{session ? 'Synced to cloud' : 'Saved locally'}</span>
          </div>
        </div>

        {session?.user && (
          <div style={{ padding: 12, borderRadius: 'var(--r-md)', background: 'var(--bg-2)', border: '0.5px solid var(--line)' }}>
            <div className="row" style={{ gap: 9, alignItems: 'center', marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: profile.avatar ? 'transparent' : 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
                color: 'var(--brand-ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, boxShadow: 'var(--shadow-brand)', overflow: 'hidden',
              }}>
                {profile.avatar
                  ? <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (initials || session.user.email?.[0]?.toUpperCase() || '?')
                }
              </div>
              <div className="col" style={{ minWidth: 0, flex: 1, gap: 1 }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.user.email}
                </div>
                <div className="muted" style={{ fontSize: 10, textTransform: 'capitalize' }}>{role || 'owner'} access</div>
              </div>
            </div>
            <button onClick={() => signOut()} style={{
              width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)',
              border: '0.5px solid var(--line-strong)', background: 'var(--paper)', cursor: 'pointer',
              fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-3)',
              transition: 'background 0.12s, color 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--down-soft)'; e.currentTarget.style.color = 'var(--down-ink)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--paper)'; e.currentTarget.style.color = 'var(--ink-3)'; }}
            >Sign out</button>
          </div>
        )}
      </div>
    </aside>
  );
}
