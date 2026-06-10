// features.js — progressive feature modules. The nav starts small (core four)
// and grows as the user's financial life does: modules switch on automatically
// when their data appears (add an expense → Cash Flow appears), and can be
// forced on/off explicitly in Settings → Features. profile.features[key]:
// true = always show, false = always hide, undefined = automatic.
//
// Hidden ≠ blocked: routes still resolve (deep links, search results, and
// insight actions all work) — only the menus are filtered. Visiting a feature
// is intent, not an error.

export const CORE_NAV_IDS = ['dashboard', 'assets', 'advisor', 'settings'];

export const FEATURE_MODULES = [
  {
    key: 'cashflow',
    label: 'Cash flow & expenses',
    hint: 'Record income and expenses, import statements, budgets and the 30-day forecast.',
    navIds: ['cashflow'],
    auto: (s) => (s.cashflows || []).length > 0,
  },
  {
    key: 'liabilities',
    label: 'Debts & loans',
    hint: 'Track loans and what they cost; powers repayment advice.',
    navIds: ['liabilities'],
    auto: (s) => (s.liabilities || []).length > 0,
  },
  {
    key: 'goals',
    label: 'Goals',
    hint: 'Targets with deadlines, progress, and pace warnings.',
    navIds: ['goals'],
    auto: (s) => (s.goals || []).length > 0,
  },
  {
    key: 'accounts',
    label: 'Bank & MoMo accounts',
    hint: 'Balances that update from your linked cash-flow entries.',
    navIds: ['accounts'],
    auto: (s) => (s.assets || []).some(a => a.kind === 'savings' || a.kind === 'momo-cash'),
  },
  {
    key: 'trends',
    label: 'Markets & trends',
    hint: 'BNR rates, CPI, RSE, crypto — the macro behind your money.',
    navIds: ['trends'],
    auto: (s) => ((s.profile || {}).watchlist || []).length > 0,
  },
  {
    key: 'reports',
    label: 'Reports',
    hint: 'Monthly report, balance sheet, tax estimate, year in review.',
    navIds: ['reports', 'balancesheet', 'tax', 'yearreview'],
    auto: (s) => (s.cashflows || []).length > 0 || (s.liabilities || []).length > 0,
  },
  {
    key: 'projections',
    label: 'Fast Forward projections',
    hint: 'Net-worth projection scenarios.',
    navIds: ['projections'],
    auto: (s) => (s.goals || []).length > 0,
  },
  {
    key: 'retirement',
    label: 'Retirement',
    hint: 'RSSB / Ejo Heza readiness and trajectory.',
    navIds: ['retirement'],
    auto: (s) => Boolean((s.profile || {}).retirement?.currentAge)
      || (s.cashflows || []).some(cf => cf.type === 'income' && cf.category === 'salary'),
  },
];

/** Effective on/off for one module: explicit setting wins, else data decides. */
export function isFeatureEnabled(state, key) {
  const explicit = (state.profile || {}).features?.[key];
  if (typeof explicit === 'boolean') return explicit;
  const mod = FEATURE_MODULES.find(m => m.key === key);
  return mod ? mod.auto(state) : true;
}

/** Set of nav ids the menus should show for this state. */
export function visibleNavIds(state) {
  const ids = new Set(CORE_NAV_IDS);
  for (const mod of FEATURE_MODULES) {
    if (isFeatureEnabled(state, mod.key)) mod.navIds.forEach(id => ids.add(id));
  }
  return ids;
}
