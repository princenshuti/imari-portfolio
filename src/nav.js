/**
 * Single source of truth for navigation items.
 * Consumed by both Sidebar (desktop) and MobileTabBar.
 */

export const NAV_ITEMS = {
  dashboard:   { id: 'dashboard',   labelDesktop: 'Dashboard',   labelMobile: 'Home',      glyph: '◐', group: 'Overview' },
  // The AI is the product's selling point — it lives at the top of the menu.
  advisor:     { id: 'advisor',     labelDesktop: 'AI Advisor',  labelMobile: 'AI Advisor', glyph: '✦', group: 'Overview' },
  assets:      { id: 'assets',      labelDesktop: 'Assets',      labelMobile: 'Assets',    glyph: '◆', group: 'Wealth'   },
  liabilities: { id: 'liabilities', labelDesktop: 'Liabilities', labelMobile: 'Liabilities', glyph: '↓', group: 'Wealth'   },
  cashflow:    { id: 'cashflow',    labelDesktop: 'Cash Flow',   labelMobile: 'Cash Flow', glyph: '⇄', group: 'Wealth'   },
  goals:       { id: 'goals',       labelDesktop: 'Goals',       labelMobile: 'Goals',     glyph: '◎', group: 'Wealth'   },
  accounts:    { id: 'accounts',    labelDesktop: 'Accounts',    labelMobile: 'Accounts',  glyph: '⌬', group: 'Money & Markets'  },
  trends:      { id: 'trends',      labelDesktop: 'Trends',      labelMobile: 'Trends',    glyph: '↗', group: 'Money & Markets'  },
  reports:     { id: 'reports',     labelDesktop: 'Monthly Report', labelMobile: 'Report',  glyph: '▤', group: 'Reports'  },
  balancesheet:{ id: 'balancesheet',labelDesktop: 'Balance Sheet', labelMobile: 'Balance',  glyph: '▦', group: 'Reports'  },
  tax:         { id: 'tax',         labelDesktop: 'Tax Report',  labelMobile: 'Tax Report', glyph: '§', group: 'Reports'  },
  yearreview:  { id: 'yearreview',  labelDesktop: 'Year in Review', labelMobile: 'Review', glyph: '✺', group: 'Reports'  },
  projections: { id: 'projections', labelDesktop: 'Fast Forward', labelMobile: 'Forecast', glyph: '⤴', group: 'Tools'    },
  retirement:  { id: 'retirement',  labelDesktop: 'Retirement',   labelMobile: 'Pension',  glyph: '☂', group: 'Tools'    },
  settings:    { id: 'settings',    labelDesktop: 'Settings',    labelMobile: 'Settings',  glyph: '⚙', group: 'Tools'    },
};

export const NAV_GROUPS = ['Overview', 'Wealth', 'Money & Markets', 'Reports', 'Tools'];

export function navItemsByGroup() {
  return NAV_GROUPS.map(label => ({
    label,
    items: Object.values(NAV_ITEMS).filter(it => it.group === label).map(it => ({
      id: it.id, label: it.labelDesktop, glyph: it.glyph,
    })),
  }));
}

export const MAIN_TABS = ['dashboard', 'advisor', 'assets', 'cashflow']
  .map(k => ({ id: NAV_ITEMS[k].id, label: NAV_ITEMS[k].labelMobile, glyph: NAV_ITEMS[k].glyph }));

export const MORE_ITEMS = ['goals', 'liabilities', 'accounts', 'trends', 'yearreview', 'tax', 'balancesheet', 'reports', 'projections', 'retirement', 'settings']
  .map(k => ({ id: NAV_ITEMS[k].id, label: NAV_ITEMS[k].labelMobile, glyph: NAV_ITEMS[k].glyph }));
