const TABS = [
  { id: 'dashboard', glyph: '◐', label: 'Home' },
  { id: 'assets',    glyph: '◆', label: 'Assets' },
  { id: 'accounts',  glyph: '⌬', label: 'Accounts' },
  { id: 'advisor',   glyph: '✦', label: 'Advisor' },
  { id: 'settings',  glyph: '⚙', label: 'More' },
];

export default function MobileTabBar({ active, onNav }) {
  return (
    <nav className="mobile-tab-bar" aria-label="Main navigation">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onNav(t.id)}
          aria-current={active === t.id ? 'page' : undefined}
        >
          <span className="glyph">{t.glyph}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
