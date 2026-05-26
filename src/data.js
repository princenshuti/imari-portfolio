// data.js — asset classes, valuation rules, currencies, trend data.

// ───── Currencies + FX (RWF as base) ──────────────────────────
// FX = manual / fallback rates (symmetric). Mutated by reducer when the user
// edits rates in Settings; mirrors the per-portfolio `state.fx` map.
export const FX = {
  RWF: 1,
  USD: 1380,
  EUR: 1490,
  KES: 10.7,
};

// LIVE_FX = asymmetric rates from BNR (populated by market.js once per session).
// Shape: { USD: { buy, sell, avg, date }, ... }. RWF is implicit (1).
// Convention: BNR buying rate values foreign→RWF; selling rate values RWF→foreign.
export const LIVE_FX = {};

export function setLiveFX(rates) {
  for (const k of Object.keys(LIVE_FX)) delete LIVE_FX[k];
  Object.assign(LIVE_FX, rates || {});
}

export const CURRENCIES = [
  { code:'RWF', symbol:'RWF', label:'Rwandan Franc',  flag:'🇷🇼' },
  { code:'USD', symbol:'$',   label:'US Dollar',      flag:'🇺🇸' },
  { code:'EUR', symbol:'€',   label:'Euro',           flag:'🇪🇺' },
  { code:'KES', symbol:'KSh', label:'Kenyan Shilling',flag:'🇰🇪' },
];

// foreign → RWF: BNR will *buy* foreign currency at the buying rate.
export function toBase(amount, currency) {
  if (currency === 'RWF') return amount;
  const live = LIVE_FX[currency]?.buy;
  return amount * (live ?? FX[currency] ?? 1);
}
// RWF → foreign: BNR will *sell* foreign currency at the selling rate.
export function fromBase(amountRWF, currency) {
  if (currency === 'RWF') return amountRWF;
  const live = LIVE_FX[currency]?.sell;
  return amountRWF / (live ?? FX[currency] ?? 1);
}
export function fmt(amount, currency = 'RWF', opts = {}) {
  if (amount == null || isNaN(amount)) return '—';
  const cur = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const compact = opts.compact ?? false;
  let body;
  if (compact && abs >= 1_000_000_000) body = (abs/1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1) + 'B';
  else if (compact && abs >= 1_000_000) body = (abs/1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M';
  else if (compact && abs >= 1_000) body = (abs/1_000).toFixed(0) + 'k';
  else body = abs.toLocaleString('en-US', { maximumFractionDigits: opts.decimals ?? 0 });
  return `${sign}${cur.symbol === cur.code ? cur.code + ' ' : cur.symbol}${body}`;
}
export function fmtBase(amountRWF, displayCurrency, opts) {
  return fmt(fromBase(amountRWF, displayCurrency), displayCurrency, opts);
}

// ───── Asset classes + valuation rules ────────────────────────
export const CLASSES = [
  {
    kind:'realestate-land', label:'Land / plot', group:'Real estate', glyph:'▢', color:'var(--brand)',
    fields:['neighbourhood','upi'],
    rule: (a, today) => simpleGrowth(a, 0.05, today),
    note: '+5%/yr appreciation rule of thumb',
  },
  {
    kind:'realestate-house', label:'House / apartment', group:'Real estate', glyph:'◐', color:'var(--brand)',
    fields:['neighbourhood','upi'],
    rule: (a, today) => simpleGrowth(a, 0.04, today),
    note: '+4%/yr appreciation rule of thumb',
  },
  {
    kind:'vehicle', label:'Vehicle', group:'Vehicles', glyph:'⏵', color:'var(--clay)',
    fields:['model','chassis','vehicleCategory'],
    rule: (a, today) => simpleGrowth(a, -0.15, today),
    note: '-15%/yr depreciation rule of thumb',
  },
  {
    kind:'livestock', label:'Livestock', group:'Livestock', glyph:'⊛', color:'var(--clay)',
    fields:['count'],
    rule: (a, today) => simpleGrowth(a, 0.03, today),
    note: '+3%/yr net of mortality',
  },
  {
    kind:'rse-equity', label:'RSE stock', group:'Stocks', glyph:'↑', color:'var(--brand)',
    fields:['ticker','shares','lastPrice'],
    rule: (a) => (a.shares || 0) * (a.lastPrice || a.purchasePrice / (a.shares||1)),
    note: 'Current value = shares × your last price update',
  },
  {
    kind:'foreign-equity', label:'Foreign stock / ETF', group:'Stocks', glyph:'⇈', color:'var(--brand)',
    fields:['ticker','shares','lastPrice'],
    rule: (a) => (a.shares || 0) * (a.lastPrice || a.purchasePrice / (a.shares||1)),
    note: 'Current value = shares × last price you entered',
  },
  {
    kind:'bond', label:'T-bill / T-bond', group:'Fixed income', glyph:'§', color:'var(--gold)',
    fields:['yieldPct','maturity'],
    rule: (a, today) => bondAccrual(a, today),
    note: 'Accrues at your stated yield, simple interest',
  },
  {
    kind:'savings', label:'Bank savings', group:'Cash & savings', glyph:'⌬', color:'var(--sky)',
    fields:['bank','yieldPct'],
    rule: (a, today) => simpleGrowth(a, (a.yieldPct || 5) / 100, today),
    note: 'Compounds at your stated rate',
  },
  {
    kind:'momo-cash', label:'Mobile money / cash', group:'Cash & savings', glyph:'○', color:'var(--sky)',
    fields:['wallet'],
    rule: (a) => a.purchasePrice,
    note: 'No growth assumed',
  },
  {
    kind:'crypto', label:'Crypto', group:'Crypto', glyph:'◇', color:'var(--plum)',
    fields:['ticker','units','lastPrice'],
    rule: (a) => (a.units || 0) * (a.lastPrice || a.purchasePrice / (a.units||1)),
    note: 'Units × your last price update',
  },
  {
    kind:'gold', label:'Gold / commodity', group:'Commodities', glyph:'◆', color:'var(--gold)',
    fields:['grams'],
    rule: (a, today) => simpleGrowth(a, 0.08, today),
    note: '+8%/yr trend, override if you know the spot price',
  },
  {
    kind:'business', label:'Business equity', group:'Business', glyph:'◈', color:'var(--brand)',
    fields:['stakePct'],
    rule: (a) => a.currentValue || a.purchasePrice,
    note: 'Enter current valuation manually',
  },
  {
    kind:'receivable', label:'Receivable / loan given', group:'Receivables', glyph:'→', color:'var(--sky)',
    fields:['debtor','dueDate','yieldPct'],
    rule: (a, today) => simpleGrowth(a, (a.yieldPct || 0) / 100, today),
    note: 'Accrues at agreed rate',
  },
  {
    kind:'other', label:'Other', group:'Other', glyph:'·', color:'var(--ink-3)',
    fields:[],
    rule: (a) => a.currentValue || a.purchasePrice,
    note: 'Enter current value manually',
  },
];

// ───── Valuation helpers ──────────────────────────────────────
export function yearsBetween(start, end) {
  const a = new Date(start), b = new Date(end);
  return Math.max(0, (b - a) / (365.25 * 24 * 3600 * 1000));
}
export function simpleGrowth(asset, ratePerYear, today = new Date()) {
  const y = yearsBetween(asset.purchaseDate, today);
  return asset.purchasePrice * Math.pow(1 + ratePerYear, y);
}
export function bondAccrual(asset, today = new Date()) {
  const y = yearsBetween(asset.purchaseDate, today);
  return asset.purchasePrice * (1 + ((asset.yieldPct || 0) / 100) * y);
}

export function suggestValue(asset, today = new Date()) {
  const cls = CLASSES.find(c => c.kind === asset.kind) || CLASSES[CLASSES.length - 1];
  try { return Math.round(cls.rule(asset, today) || 0); } catch (e) { return asset.purchasePrice; }
}

export function valueRWF(asset, today = new Date()) {
  const v = asset.currentValue != null && asset.currentValue !== '' ? asset.currentValue : suggestValue(asset, today);
  return toBase(v, asset.currency || 'RWF');
}
export function costRWF(asset) {
  return toBase(asset.purchasePrice || 0, asset.currency || 'RWF');
}

// ───── Trend / "watch" domains ────────────────────────────────
function syn(n, base, drift, vol, seed) {
  let s = base, r = seed;
  const out = [];
  for (let i = 0; i < n; i++) {
    r = (r * 9301 + 49297) % 233280;
    const noise = (r / 233280 - 0.5) * vol;
    s = s * (1 + drift / n + noise);
    out.push(+s.toFixed(2));
  }
  return out;
}

// dataKind legend:
//   'live'      — fetched from a real-time API (market.js)
//   'reference' — static value sourced from official publications, no public API for live fetch
//   'modeled'   — synthetic / estimated, no reliable external source
export const TREND_DOMAINS = [
  {
    id:'usdrwf', label:'USD / RWF', unit:'', dataKind:'live',
    value: 1300,  // fallback only — overridden by market.js live fetch
    change: null,
    series: syn(60, 1220, 0.06, 0.005, 11),
    source: 'ExchangeRate-API · live · BNR-tracked',
    color:'var(--brand)', group:'Rwanda macro',
  },
  {
    id:'bnr-repo', label:'BNR Repo rate', unit:'%', dataKind:'reference',
    value: 6.00,
    change: -0.50,
    series: syn(60, 7.5, -0.18, 0.01, 17),
    source: 'BNR.rw · Monetary Policy Committee · reference',
    asOf:  'Q4 2024 MPC decision',
    color:'var(--brand-2)', group:'Rwanda macro',
  },
  {
    id:'cpi', label:'Inflation (CPI YoY)', unit:'%', dataKind:'reference',
    value: 5.1,
    change: -0.3,
    series: syn(60, 8.0, -0.28, 0.025, 19),
    source: 'NISR · statistics.gov.rw · reference',
    asOf:  'Q1 2025',
    color:'var(--clay)', group:'Rwanda macro',
  },
  {
    id:'rse-asi', label:'RSE All-Share Index', unit:'', dataKind:'reference',
    value: 149.2,
    change: +0.4,
    series: syn(60, 130, 0.14, 0.012, 5),
    source: 'RSE.rw · reference · low-liquidity market',
    asOf:  'Last sourced Q1 2025',
    color:'var(--brand)', group:'Stocks',
  },
  {
    id:'sp500', label:'S&P 500', unit:'', dataKind:'live',
    value: 5800,  // fallback — overridden by market.js when Yahoo Finance allows CORS
    change: null,
    series: syn(60, 4800, 0.21, 0.018, 7),
    source: 'Yahoo Finance · live where available',
    color:'var(--sky)', group:'Stocks',
  },
  {
    id:'gold', label:'Gold / troy oz', unit:'$', dataKind:'live',
    value: 2400,  // fallback — overridden by metals.live live fetch
    change: null,
    series: syn(60, 2000, 0.18, 0.018, 13),
    source: 'metals.live · XAU/USD spot',
    color:'var(--gold)', group:'Commodities',
  },
  {
    id:'btc', label:'Bitcoin', unit:'$', dataKind:'live',
    value: 60_000, // fallback — overridden by CoinGecko live fetch
    change: null,
    series: syn(60, 38000, 0.55, 0.065, 23),
    source: 'CoinGecko · live',
    color:'var(--plum)', group:'Crypto',
  },
  {
    id:'eth', label:'Ethereum', unit:'$', dataKind:'live',
    value: 2800,   // fallback — overridden by CoinGecko live fetch
    change: null,
    series: syn(60, 2000, 0.40, 0.07, 29),
    source: 'CoinGecko · live',
    color:'var(--plum)', group:'Crypto',
  },
  {
    id:'tbond10', label:'10-yr RW Treasury', unit:'%', dataKind:'reference',
    value: 13.50,
    change: +0.10,
    series: syn(60, 13.0, 0.04, 0.008, 31),
    source: 'BNR.rw · primary market yield · reference',
    asOf:  'Q1 2025 primary auction',
    color:'var(--gold)', group:'Yields',
  },
  {
    id:'kigali-re', label:'Kigali RE Index', unit:'', dataKind:'modeled',
    value: 142.3,
    change: +0.9,
    series: syn(60, 118, 0.20, 0.012, 37),
    source: 'Imari composite model — no official index exists',
    asOf:  'Modeled monthly',
    methodology: [
      'No official Rwandan real-estate index exists publicly, so Imari composes one from:',
      '• Volume-weighted per-m² medians of the 7 Kigali neighbourhoods in KIGALI_NEIGHBOURHOODS',
      '• Sample-size weighting by district transaction counts (sourced annually from RHA)',
      '• Smoothed with a 3-month rolling average to dampen single-property outliers',
      'Use as a directional indicator — not an investment-grade benchmark.',
    ].join('\n'),
    color:'var(--brand)', group:'Real estate',
  },
];

export const KIGALI_NEIGHBOURHOODS = [
  { name:'Nyarutarama',   pricePerSqm: 480_000, change:+0.8 },
  { name:'Kacyiru',       pricePerSqm: 410_000, change:+1.1 },
  { name:'Kibagabaga',    pricePerSqm: 280_000, change:+1.4 },
  { name:'Kimironko',     pricePerSqm: 210_000, change:+0.9 },
  { name:'Kabuga',        pricePerSqm: 140_000, change:+1.7 },
  { name:'Rebero',        pricePerSqm: 320_000, change:+0.6 },
  { name:'Gisozi',        pricePerSqm: 180_000, change:+1.2 },
];

// ───── Rwanda administrative geography ───────────────────────
export const RWANDA_PROVINCES = [
  'Kigali City',
  'Eastern Province',
  'Western Province',
  'Northern Province',
  'Southern Province',
];

export const RWANDA_DISTRICTS = {
  'Kigali City':       ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  'Eastern Province':  ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
  'Western Province':  ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'],
  'Northern Province': ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  'Southern Province': ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
};

export const COUNTRIES = [
  'Rwanda',
  'Kenya', 'Uganda', 'Tanzania', 'Burundi', 'DRC',
  'Ethiopia', 'South Africa', 'Nigeria', 'Ghana',
  'United States', 'United Kingdom', 'France', 'Belgium',
  'China', 'India', 'UAE', 'Other',
];

// ───── Rwandan banks + MoMo providers ─────────────────────────
export const RWANDA_BANKS = [
  'Bank of Kigali (BK)',
  'I&M Bank Rwanda',
  'Equity Bank Rwanda',
  'KCB Bank Rwanda',
  'Cogebanque',
  'Banque Populaire du Rwanda (BPR / Atlas Mara)',
  'GT Bank Rwanda',
  'Access Bank Rwanda',
  'Ecobank Rwanda',
  'NCBA Bank Rwanda',
  'Development Bank of Rwanda (BRD)',
  'Bank of Africa Rwanda',
  'Unguka Bank',
  'AB Bank Rwanda',
  'Zigama CSS',
  'Urwego Opportunity Bank',
];

export const MOMO_PROVIDERS = [
  'MTN MoMo',
  'Airtel Money',
];

// UUID v4 — collision-resistant (Math.random + 7 chars used to silently
// overwrite rows via upsert when two ids collided).
export function id() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for ancient environments
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// ───── Liability types ─────────────────────────────────────────
export const LIABILITY_TYPES = [
  { kind:'mortgage',       label:'Mortgage / Property loan', group:'Secured', color:'var(--down)' },
  { kind:'car-loan',       label:'Vehicle loan',             group:'Secured', color:'var(--clay)' },
  { kind:'personal-loan',  label:'Personal loan',            group:'Unsecured', color:'var(--down)' },
  { kind:'sacco',          label:'SACCO / Cooperative loan', group:'Unsecured', color:'var(--gold)' },
  { kind:'business-loan',  label:'Business loan',            group:'Business', color:'var(--plum)' },
  { kind:'credit',         label:'Credit / Overdraft',       group:'Revolving', color:'var(--down)' },
  { kind:'other-debt',     label:'Other debt',               group:'Other', color:'var(--ink-3)' },
];

// ───── Cash-flow categories ────────────────────────────────────
export const INCOME_CATEGORIES = [
  { id:'salary',      label:'Salary / Wages',      color:'var(--up)' },
  { id:'rental',      label:'Rental income',        color:'var(--brand)' },
  { id:'dividends',   label:'Dividends',            color:'var(--gold)' },
  { id:'bond-int',    label:'Bond interest',        color:'var(--gold)' },
  { id:'business',    label:'Business income',      color:'var(--brand)' },
  { id:'freelance',   label:'Freelance / Side gig', color:'var(--sky)' },
  { id:'other-inc',   label:'Other income',         color:'var(--ink-3)' },
];
export const EXPENSE_CATEGORIES = [
  { id:'loan-repay',  label:'Loan repayment',       color:'var(--down)' },
  { id:'sacco-cont',  label:'SACCO contribution',   color:'var(--gold)' },
  { id:'insurance',   label:'Insurance premium',    color:'var(--clay)' },
  { id:'school-fees', label:'School fees',          color:'var(--plum)' },
  { id:'utilities',   label:'Utilities / Bills',    color:'var(--ink-3)' },
  { id:'other-exp',   label:'Other expense',        color:'var(--ink-3)' },
];

// ───── Goal categories ─────────────────────────────────────────
export const GOAL_CATEGORIES = [
  { id:'emergency',   label:'Emergency fund',    icon:'🛡' },
  { id:'house',       label:'Buy a house',       icon:'🏠' },
  { id:'land',        label:'Buy land',          icon:'📐' },
  { id:'vehicle',     label:'Buy a vehicle',     icon:'🚗' },
  { id:'education',   label:'Education',         icon:'🎓' },
  { id:'retirement',  label:'Retirement',        icon:'🌅' },
  { id:'business',    label:'Start a business',  icon:'💼' },
  { id:'investment',  label:'Investment target',  icon:'📈' },
  { id:'travel',      label:'Travel',            icon:'✈' },
  { id:'other-goal',  label:'Other goal',        icon:'⭐' },
];

// ───── Net-worth milestone thresholds (in RWF) ────────────────
export const MILESTONES = [
  10_000_000, 25_000_000, 50_000_000, 100_000_000,
  250_000_000, 500_000_000, 1_000_000_000,
];

// ───── Fixed Asset Tax (RRA · immovable property) ─────────────
// Source: rra.gov.rw/fileadmin/img/fixed-asset-tax.html
export const FIXED_ASSET_TAX = {
  rate:                 0.001,          // 1/1000 = 0.1% per year of market value
  residentialExemption: 3_000_000,     // RWF · only excess above this threshold is taxed
  // Applies to: realestate-land (full rate), realestate-house (with exemption)
  // Exempt: agricultural/forestry land ≤ 2 ha; government; religious; diplomatic; residential ≤ 3M
  declarationDeadline:  'March 31',    // self-assessed · annual
  paymentDeadline:      'March 31',    // annual obligation
  latePenalties:        [0.10, 0.20, 0.30, 0.40], // < 1 month, 1-2m, 2-3m, > 3 months
  lateInterestMonthly:  0.015,         // 1.5% / month from due date
  lateSurcharge:        { rate: 0.10, max: 100_000 }, // 10% of tax, capped at 100k RWF
};

// ───── Vehicle Road Maintenance Levy (Law 013/2025 of 27/05/2025) ─────
// Source: Official Gazette, special issue 29/05/2025 · applies annually, due 31 December
export const VEHICLE_CATEGORIES = [
  { id:'car',         label:'Car',            levy:  50_000 },
  { id:'jeep',        label:'Jeep / SUV 4×4', levy:  50_000 },
  { id:'pickup',      label:'Pick-up',         levy: 100_000 },
  { id:'microbus',    label:'Microbus',        levy: 100_000 },
  { id:'minibus',     label:'Minibus',         levy: 100_000 },
  { id:'bus',         label:'Bus',             levy: 100_000 },
  { id:'truck',       label:'Truck',           levy: 120_000 },
  { id:'halftrailer', label:'Half-trailer',    levy: 120_000 },
  { id:'trailer',     label:'Trailer',         levy: 150_000 },
  // Fuel levy (collected at customs, not filed individually):
  // Petrol / Gas oil: 15% of CIF value · Law 013/2025 Art. 2(1)
];

// ───── Rwanda CGT / tax rates by asset class ──────────────────
export const TAX_RULES = {
  'realestate-land':  { rate: 0.05, label: 'Land CGT 5%',   withholding: false },
  'realestate-house': { rate: 0.05, label: 'Property CGT 5%', withholding: false },
  'rse-equity':       { rate: 0.05, label: 'RSE CGT 5%',     withholding: true, wRate: 0.15 },
  'foreign-equity':   { rate: 0.05, label: 'Capital gain 5%', withholding: true, wRate: 0.15 },
  'bond':             { rate: 0,    label: 'Tax-exempt',      withholding: true, wRate: 0.15 },
  'crypto':           { rate: 0.05, label: 'Capital gain 5%', withholding: false },
  'other':            { rate: 0.05, label: 'Capital gain 5%', withholding: false },
};

export const SEED_ASSETS = [
  { id: id(), kind:'realestate-land', name:'Plot in Kabuga',           currency:'RWF', purchasePrice: 150_000_000, purchaseDate:'2022-06-15', neighbourhood:'Kabuga', currentValue: '' },
  { id: id(), kind:'rse-equity',      name:'Bank of Kigali shares',     currency:'RWF', purchasePrice: 56_000,      purchaseDate:'2023-03-10', ticker:'BOK',  shares:200, lastPrice:320, currentValue: '' },
  { id: id(), kind:'rse-equity',      name:'MTN Rwanda shares',         currency:'RWF', purchasePrice: 92_000,      purchaseDate:'2024-01-22', ticker:'MTNR', shares:500, lastPrice:198, currentValue: '' },
  { id: id(), kind:'vehicle',         name:'Toyota Rav4',              currency:'RWF', purchasePrice: 18_000_000,  purchaseDate:'2021-09-01', model:'Toyota Rav4 2018', currentValue: '' },
  { id: id(), kind:'livestock',       name:'Cattle — 5 head',          currency:'RWF', purchasePrice: 2_500_000,   purchaseDate:'2023-11-04', count:5, currentValue: '' },
  { id: id(), kind:'bond',            name:'5-yr Treasury Bond',       currency:'RWF', purchasePrice: 500_000,     purchaseDate:'2024-05-20', yieldPct:12.5, maturity:'2029-05-20', currentValue: '' },
  { id: id(), kind:'momo-cash',       name:'MTN MoMo balance',         currency:'RWF', purchasePrice: 320_000,     purchaseDate:'2025-01-01', wallet:'MTN MoMo', currentValue: '' },
  { id: id(), kind:'savings',         name:'BK savings account',       currency:'RWF', purchasePrice: 1_200_000,   purchaseDate:'2023-08-12', bank:'Bank of Kigali', yieldPct:5, currentValue: '' },
  { id: id(), kind:'crypto',          name:'Bitcoin',                  currency:'USD', purchasePrice: 1_750,       purchaseDate:'2023-11-15', ticker:'BTC',  units:0.05, lastPrice:68240, currentValue: '' },
  { id: id(), kind:'foreign-equity',  name:'VTI · US total market',    currency:'USD', purchasePrice: 2_400,       purchaseDate:'2024-02-08', ticker:'VTI',  shares:10,   lastPrice:268, currentValue: '' },
];
