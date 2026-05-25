/**
 * Single source of truth for navigation items.
 * Consumed by both Sidebar (desktop) and MobileTabBar.
 */

export const NAV_ITEMS = {
  dashboard:   { id: 'dashboard',   labelDesktop: 'Dashboard',   labelMobile: 'Home',      glyph: '◐', group: 'Overview' },
  assets:      { id: 'assets',      labelDesktop: 'Assets',      labelMobile: 'Assets',    glyph: '◆', group: 'Wealth'   },
  liabilities: { id: 'liabilities', labelDesktop: 'Liabilities', labelMobile: 'Liabilities', glyph: '↓', group: 'Wealth'   },
  cashflow:    { id: 'cashflow',    labelDesktop: 'Cash Flow',   labelMobile: 'Cash Flow', glyph: '⇄', group: 'Wealth'   },
  goals:       { id: 'goals',       labelDesktop: 'Goals',       labelMobile: 'Goals',     glyph: '◎', group: 'Wealth'   },
  accounts:    { id: 'accounts',    labelDesktop: 'Accounts',    labelMobile: 'Accounts',  glyph: '⌬', group: 'Finance'  },
  trends:      { id: 'trends',      labelDesktop: 'Trends',      labelMobile: 'Trends',    glyph: '↗', group: 'Finance'  },
  tax:         { id: 'tax',         labelDesktop: 'Tax Report',  labelMobile: 'Tax Report', glyph: '§', group: 'Finance'  },
  advisor:     { id: 'advisor',     labelDesktop: 'AI Advisor',  labelMobile: 'AI Advisor', glyph: '✦', group: 'Tools'    },
  settings:    { id: 'settings',    labelDesktop: 'Settings',    labelMobile: 'Settings',  glyph: '⚙', group: 'Tools'    },
};

export const NAV_GROUPS = ['Overview', 'Wealth', 'Finance', 'Tools'];

export function navItemsByGroup() {
  return NAV_GROUPS.map(label => ({
    label,
    items: Object.values(NAV_ITEMS).filter(it => it.group === label).map(it => ({
      id: it.id, label: it.labelDesktop, glyph: it.glyph,
    })),
  }));
}

export const MAIN_TABS = ['dashboard', 'assets', 'cashflow', 'goals']
  .map(k => ({ id: NAV_ITEMS[k].id, label: NAV_ITEMS[k].labelMobile, glyph: NAV_ITEMS[k].glyph }));

export const MORE_ITEMS = ['liabilities', 'accounts', 'trends', 'tax', 'advisor', 'settings']
  .map(k => ({ id: NAV_ITEMS[k].id, label: NAV_ITEMS[k].labelMobile, glyph: NAV_ITEMS[k].glyph }));
