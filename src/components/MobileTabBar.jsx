import { useState } from 'react';

const MAIN_TABS = [
  { id: 'dashboard',   label: 'Home',      glyph: '◐' },
  { id: 'assets',      label: 'Assets',    glyph: '◆' },
  { id: 'cashflow',    label: 'Cash Flow', glyph: '⇄' },
  { id: 'goals',       label: 'Goals',     glyph: '◎' },
];

const MORE_ITEMS = [
  { id: 'liabilities', label: 'Liabilities', glyph: '↓' },
  { id: 'accounts',    label: 'Accounts',    glyph: '⌬' },
  { id: 'trends',      label: 'Trends',      glyph: '↗' },
  { id: 'tax',         label: 'Tax Report',  glyph: '§' },
  { id: 'advisor',     label: 'AI Advisor',  glyph: '✦' },
  { id: 'settings',    label: 'Settings',    glyph: '⚙' },
];

export default function MobileTabBar({ active, onNav }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_ITEMS.some(i => i.id === active);

  const navigate = (id) => { onNav(id); setMoreOpen(false); };

  return (
    <>
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 49,
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
        }} />
      )}

      {moreOpen && (
        <div style={{
          position: 'fixed', bottom: 66, left: 0, right: 0, zIndex: 50,
          background: 'var(--paper)', borderTop: '0.5px solid var(--line)',
          borderRadius: '16px 16px 0 0', padding: '16px 12px 8px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.14)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {MORE_ITEMS.map(it => (
              <button key={it.id} onClick={() => navigate(it.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 8px', borderRadius: 12, border: 0, cursor: 'pointer',
                background: it.id === active ? 'var(--brand-soft)' : 'var(--bg-2)',
                color: it.id === active ? 'var(--brand)' : 'var(--ink-2)',
              }}>
                <span style={{ fontSize: 20 }}>{it.glyph}</span>
                <span style={{ fontSize: 10, fontWeight: 500 }}>{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="mobile-tab-bar" aria-label="Mobile navigation">
        {MAIN_TABS.map(it => (
          <button key={it.id} onClick={() => navigate(it.id)}
            className={`tab-btn${it.id === active ? ' active' : ''}`}
            aria-current={it.id === active ? 'page' : undefined}>
            <span style={{ fontSize: 20 }}>{it.glyph}</span>
            <span>{it.label}</span>
          </button>
        ))}
        <button onClick={() => setMoreOpen(o => !o)}
          className={`tab-btn${isMoreActive || moreOpen ? ' active' : ''}`}>
          <span style={{ fontSize: 20 }}>⋯</span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
