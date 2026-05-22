import { CURRENCIES } from '../data.js';

export default function TopBar({ title, subtitle, profile, displayCurrency, onCurrency, right, role }) {
  const initials = (profile.name || 'You').split(' ').slice(0,2).map(s => s[0] || '').join('').toUpperCase().slice(0,2);

  return (
    <div className="row" style={{
      padding: '16px 28px',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '0.5px solid var(--line)',
      background: 'var(--paper)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      minHeight: 64,
    }}>
      {/* Title area */}
      <div style={{ minWidth: 0 }}>
        {subtitle && (
          <div className="muted" style={{
            fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            fontWeight: 600, marginBottom: 2,
          }}>{subtitle}</div>
        )}
        <div className="font-serif" style={{
          fontSize: 24, lineHeight: 1.1,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
      </div>

      {/* Right controls */}
      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
        {role === 'viewer' && (
          <span className="pill pill-gold" style={{ fontSize: 10.5 }}>View-only</span>
        )}
        {role === 'editor' && (
          <span className="pill pill-brand" style={{ fontSize: 10.5 }}>Editor</span>
        )}
        {right}

        {/* Currency selector */}
        <select
          value={displayCurrency}
          onChange={e => onCurrency(e.target.value)}
          style={{
            padding: '7px 10px', borderRadius: 'var(--r-md)',
            border: '0.5px solid var(--line-strong)',
            background: 'var(--bg-2)',
            fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>

        {/* Avatar */}
        <div title={profile.name || 'You'} style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
          color: 'var(--brand-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 700,
          boxShadow: 'var(--shadow-brand)',
          cursor: 'default',
        }}>{initials}</div>
      </div>
    </div>
  );
}
