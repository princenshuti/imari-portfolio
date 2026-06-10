// glossary.js — the education layer (F9). Plain-language explainers for the
// financial terms Imari's insights use. Content only — no calculations. Keep
// each body honest, concrete, and grounded in the same assumptions the app
// uses (TAX_RULES, engine/insights/refs.js); cite the official source, never
// a made-up figure.

export const GLOSSARY = {
  'real-vs-nominal': {
    term: 'Real vs nominal',
    short: 'Nominal is the number on screen; real is what it buys after inflation.',
    body: 'If your net worth grew 8% but prices rose 5%, your real growth was about 3% — the rest is inflation, not wealth. Imari uses NISR CPI as the inflation reference, weighted by your own spending mix where possible.',
  },
  cgt: {
    term: 'Capital gains tax (CGT)',
    short: 'Tax charged on the profit when you sell an asset for more than it cost.',
    body: 'Rwanda generally applies 5% on the gain (sale price minus what you paid) for assets like land, property, and listed shares; some securities also carry a 15% withholding on income. Imari estimates with these published RRA rates — your filing position may differ, so confirm with RRA or an accountant before selling.',
  },
  'concentration-risk': {
    term: 'Concentration risk',
    short: 'Too much of your wealth in one asset or one place.',
    body: 'When a single asset dominates your net worth, one bad event — a land dispute, a tenant leaving, a market drop — moves your whole financial life. Spreading value across asset types means no single shock can take a large share of it.',
  },
  'idle-cash': {
    term: 'Idle cash',
    short: 'Money sitting at ~0% while safe alternatives pay interest.',
    body: 'Cash beyond your emergency buffer earns nothing in a current account while BNR T-bills and money-market products pay a published yield. The gap between those two is a real, counting cost — that is the figure Imari shows, using the reference T-bill yield.',
  },
  'savings-rate': {
    term: 'Savings rate',
    short: 'The share of your income you keep instead of spend.',
    body: 'Net cash flow divided by income. At a 20% savings rate you bank a fifth of everything you earn; below 0% you are funding the month from past wealth. It is the single number that most decides how fast goals arrive.',
  },
  'cost-basis': {
    term: 'Cost basis',
    short: 'What you actually paid for an asset, used to measure true gain.',
    body: 'An asset "worth" RWF 12M that cost you RWF 10M has a 2M gain — and that gain, not the headline value, is what CGT applies to when you sell. Without a recorded cost basis, neither profit nor tax can be estimated honestly.',
  },
  runway: {
    term: 'Runway',
    short: 'How many months your liquid money covers your expenses.',
    body: 'Liquid value (cash, MoMo, savings) divided by average monthly expenses. Three months is the common safety floor: below that, one missed salary or one emergency forces you to sell assets or borrow at the worst moment.',
  },
  'replacement-ratio': {
    term: 'Replacement ratio',
    short: 'Retirement income as a percentage of your working income.',
    body: 'If you earn RWF 1M a month and your pension will pay RWF 350k, your replacement ratio is 35%. Comfort is usually placed around 70% — the gap is what voluntary saving (e.g. Ejo Heza) exists to close, and it compounds hardest when started early.',
  },
  'debt-to-asset': {
    term: 'Debt-to-asset ratio',
    short: 'How much of what you own is offset by what you owe.',
    body: 'Total debt divided by total assets. At 50%+ every franc of asset value is half-claimed by a lender, and a drop in asset values or income squeezes you twice. Lenders read this number the same way.',
  },
  liquidity: {
    term: 'Liquidity',
    short: 'How fast an asset turns into spendable cash without losing value.',
    body: 'MoMo and bank balances are liquid; land and a house are not — selling well takes months. A portfolio can be large and still unable to pay a hospital bill tomorrow; that is why Imari tracks liquid value separately.',
  },
};

// Which explainer chips belong under which insight (engine rule id → terms).
export const TERMS_BY_INSIGHT = {
  'real-vs-nominal':       ['real-vs-nominal'],
  'concentration-risk':    ['concentration-risk', 'liquidity'],
  'idle-cash-yield-gap':   ['idle-cash', 'runway'],
  'tax-deadline-exposure': ['cgt', 'cost-basis'],
  'runway-months':         ['runway', 'liquidity'],
  'goal-pace-gap':         ['savings-rate'],
  'income-generating-share': ['concentration-risk'],
  'land-revaluation-stale': ['cost-basis', 'cgt'],
  'stale-net-worth':       [],
};

/** Glossary entries to offer under an insight card. */
export function glossaryFor(insightId) {
  return (TERMS_BY_INSIGHT[insightId] || [])
    .map(id => ({ id, ...GLOSSARY[id] }))
    .filter(e => e.term);
}
