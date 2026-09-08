import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MAIN_TABS, MORE_ITEMS } from '../nav.js';
import { useT } from '../contexts/I18nContext.jsx';

// Map nav-item id → i18n key for mobile labels. A few diverge from the desktop
// labels because the bottom-bar is narrower (Dashboard→Home, Balance Sheet→Balance,
// Fast Forward→Forecast); everything else reuses the desktop key.
const TAB_KEY = {
  dashboard:    'nav.tabs_home',
  assets:       'nav.assets',
  cashflow:     'nav.cashflow',
  goals:        'nav.goals',
  liabilities:  'nav.liabilities',
  accounts:     'nav.accounts',
  trends:       'nav.trends',
  yearreview:   'nav.tabs_review',
  tax:          'nav.tax',
  balancesheet: 'nav.tabs_balance',
  reports:      'nav.tabs_report',
  projections:  'nav.tabs_forecast',
  retirement:   'nav.tabs_pension',
  advisor:      'nav.advisor',
  settings:     'nav.settings',
  family:       'nav.tabs_family',
  scorecard:    'nav.scorecard',
};

export default function MobileTabBar({ active, onNav, visibleIds = null }) {
  const { t } = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  // Progressive nav: hide modules the user hasn't enabled / has no data for.
  const mainTabs = visibleIds ? MAIN_TABS.filter(i => visibleIds.has(i.id)) : MAIN_TABS;
  const moreItems = visibleIds ? MORE_ITEMS.filter(i => visibleIds.has(i.id)) : MORE_ITEMS;
  const isMoreActive = moreItems.some(i => i.id === active);

  const navigate = (id) => { onNav(id); setMoreOpen(false); };
  const labelFor = (it) => (TAB_KEY[it.id] ? t(TAB_KEY[it.id]) : it.label);

  return (
    <>
      <AnimatePresence>
      {moreOpen && (
        <motion.button
          key="more-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setMoreOpen(false)}
          aria-label={t('mobile_nav.close_menu')}
          style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
            border: 0, padding: 0, cursor: 'pointer',
          }}
        />
      )}

      {moreOpen && (
        <motion.div
          key="more-sheet"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }}
          style={{
          position: 'fixed', bottom: 'calc(58px + env(safe-area-inset-bottom, 8px))', left: 0, right: 0, zIndex: 50,
          background: 'var(--paper)', borderTop: '0.5px solid var(--line)',
          borderRadius: '16px 16px 0 0', padding: '16px 12px 8px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.14)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {moreItems.map(it => (
              <button
                key={it.id}
                onClick={() => navigate(it.id)}
                aria-current={it.id === active ? 'page' : undefined}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 8px', borderRadius: 12, border: 0, cursor: 'pointer',
                  background: it.id === active ? 'var(--brand-soft)' : 'var(--bg-2)',
                  color: it.id === active ? 'var(--brand)' : 'var(--ink-2)',
                  minHeight: 44,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 20 }}>{it.glyph}</span>
                <span style={{ fontSize: 10, fontWeight: 500 }}>{labelFor(it)}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <nav className="mobile-tab-bar" aria-label={t('mobile_nav.label')}>
        {mainTabs.map(it => (
          <button
            key={it.id}
            onClick={() => navigate(it.id)}
            className={`tab-btn${it.id === active ? ' active' : ''}`}
            aria-current={it.id === active ? 'page' : undefined}
          >
            <span aria-hidden="true" style={{ fontSize: 20 }}>{it.glyph}</span>
            <span>{labelFor(it)}</span>
          </button>
        ))}
        <button
          onClick={() => setMoreOpen(o => !o)}
          aria-expanded={moreOpen}
          aria-label={t('mobile_nav.more_open')}
          className={`tab-btn${isMoreActive || moreOpen ? ' active' : ''}`}
        >
          <span aria-hidden="true" style={{ fontSize: 20 }}>⋯</span>
          <span>{t('mobile_nav.more')}</span>
        </button>
      </nav>
    </>
  );
}
