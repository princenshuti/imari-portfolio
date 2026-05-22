// data.js — country profiles + sample dataset
// Country-aware: currency, locale, tax bands, regulator, mobile money, advisors,
// holdings, market tickers. Used across mobile + desktop screens.

// ─── Country profiles ────────────────────────────────────────────
const COUNTRIES = {
  RW: {
    code: 'RW',
    name: 'Rwanda',
    flag: '🇷🇼',
    capital: 'Kigali',
    currency: { code: 'RWF', symbol: 'RWF', toUSD: 1 / 1380 },
    languages: ['Kinyarwanda', 'English', 'French', 'Swahili'],
    greeting: 'Muraho',                  // Kinyarwanda
    regulator: { name: 'National Bank of Rwanda', short: 'BNR', kind: 'Central bank & banking regulator' },
    markets:   { name: 'Capital Market Authority', short: 'CMA', kind: 'Securities regulator' },
    tax:       { name: 'Rwanda Revenue Authority', short: 'RRA', kind: 'Tax authority' },
    exchange:  { name: 'Rwanda Stock Exchange', short: 'RSE' },
    pension:   { name: 'Rwanda Social Security Board', short: 'RSSB' },
    mobileMoney: ['MTN MoMo', 'Airtel Money'],
    banks: ['Bank of Kigali', 'I&M Bank', 'BPR Atlas Mara', 'Equity Bank', 'Cogebanque'],
    taxBands: [
      { upTo: 60_000,  rate: 0.00, label: '0% — up to 60,000 RWF/mo' },
      { upTo: 100_000, rate: 0.20, label: '20% — 60,001 – 100,000' },
      { upTo: Infinity, rate: 0.30, label: '30% — above 100,000' },
    ],
    // Real listed tickers on RSE (small market, illustrative)
    tickers: [
      { sym: 'BOK',  name: 'Bank of Kigali',     px: 320,  ch: +1.6, lot: 100 },
      { sym: 'BLR',  name: 'Bralirwa',           px: 178,  ch: -0.5, lot: 100 },
      { sym: 'CTL',  name: 'Crystal Telecom',    px: 78,   ch: +0.0, lot: 100 },
      { sym: 'MTNR', name: 'MTN Rwanda',         px: 198,  ch: +2.1, lot: 100 },
      { sym: 'IMR',  name: 'I&M Bank Rwanda',    px: 41,   ch: +0.7, lot: 100 },
      { sym: 'CMR',  name: 'Cimerwa',            px: 105,  ch: -1.2, lot: 100 },
    ],
    govBonds: [
      { name: '5-yr Treasury Bond',  yield: 12.50 },
      { name: '7-yr Treasury Bond',  yield: 13.25 },
      { name: '15-yr Infra Bond',    yield: 13.90 },
      { name: '91-day T-Bill',       yield:  9.20 },
    ],
    advisorContext: 'Land of a Thousand Hills · Vision 2050',
  },
  KE: {
    code: 'KE', name: 'Kenya', flag: '🇰🇪', capital: 'Nairobi',
    currency: { code: 'KES', symbol: 'KSh', toUSD: 1/129 },
    languages: ['Swahili', 'English'], greeting: 'Habari',
    regulator: { name: 'Central Bank of Kenya', short: 'CBK', kind: 'Central bank' },
    markets:   { name: 'Capital Markets Authority', short: 'CMA', kind: 'Securities regulator' },
    tax:       { name: 'Kenya Revenue Authority', short: 'KRA', kind: 'Tax authority' },
    exchange:  { name: 'Nairobi Securities Exchange', short: 'NSE' },
    pension:   { name: 'National Social Security Fund', short: 'NSSF' },
    mobileMoney: ['M-Pesa', 'Airtel Money'],
    banks: ['Equity Bank', 'KCB', 'Co-op Bank', 'NCBA', 'ABSA'],
    taxBands: [
      { upTo: 24_000,  rate: 0.10, label: '10% — up to 24,000' },
      { upTo: 32_333,  rate: 0.25, label: '25% — 24,001 – 32,333' },
      { upTo: 500_000, rate: 0.30, label: '30% — 32,334 – 500,000' },
      { upTo: Infinity, rate: 0.35, label: '35% — above 500,000' },
    ],
    tickers: [
      { sym: 'SCOM', name: 'Safaricom',          px: 19.5, ch: +1.2, lot: 100 },
      { sym: 'EQTY', name: 'Equity Group',       px: 48.0, ch: -0.4, lot: 100 },
      { sym: 'KCB',  name: 'KCB Group',          px: 39.3, ch: +0.8, lot: 100 },
      { sym: 'EABL', name: 'East African Brew.', px: 152,  ch: +0.2, lot: 100 },
      { sym: 'COOP', name: 'Co-op Bank',         px: 14.7, ch: -0.5, lot: 100 },
      { sym: 'ABSA', name: 'ABSA Kenya',         px: 17.1, ch: +0.0, lot: 100 },
    ],
    govBonds: [
      { name: '91-day T-Bill', yield: 15.80 },
      { name: '10-yr Bond',    yield: 16.50 },
      { name: 'Infrastructure Bond', yield: 18.20 },
    ],
    advisorContext: 'Silicon Savannah · Vision 2030',
  },
  UG: {
    code: 'UG', name: 'Uganda', flag: '🇺🇬', capital: 'Kampala',
    currency: { code: 'UGX', symbol: 'USh', toUSD: 1/3760 },
    languages: ['English', 'Swahili', 'Luganda'], greeting: 'Oli otya',
    regulator: { name: 'Bank of Uganda', short: 'BoU', kind: 'Central bank' },
    markets:   { name: 'Capital Markets Authority', short: 'CMA', kind: 'Securities regulator' },
    tax:       { name: 'Uganda Revenue Authority', short: 'URA', kind: 'Tax authority' },
    exchange:  { name: 'Uganda Securities Exchange', short: 'USE' },
    pension:   { name: 'National Social Security Fund', short: 'NSSF' },
    mobileMoney: ['MTN MoMo', 'Airtel Money'],
    banks: ['Stanbic Bank', 'Centenary Bank', 'DFCU', 'Absa'],
    taxBands: [
      { upTo: 235_000,  rate: 0.00, label: '0% — up to 235,000' },
      { upTo: 335_000,  rate: 0.10, label: '10% — 235,001 – 335,000' },
      { upTo: 410_000,  rate: 0.20, label: '20% — 335,001 – 410,000' },
      { upTo: Infinity, rate: 0.30, label: '30% — above 410,000' },
    ],
    tickers: [
      { sym: 'MTN',  name: 'MTN Uganda',         px: 175,  ch: +0.7, lot: 100 },
      { sym: 'SBU',  name: 'Stanbic Uganda',     px: 34,   ch: +1.1, lot: 100 },
      { sym: 'BATU', name: 'BAT Uganda',         px: 32_000, ch: -0.3, lot: 10 },
      { sym: 'UMEME',name: 'Umeme',              px: 333,  ch: +0.0, lot: 100 },
    ],
    govBonds: [
      { name: '91-day T-Bill', yield: 11.80 },
      { name: '10-yr Bond',    yield: 16.10 },
    ],
    advisorContext: 'Pearl of Africa · Vision 2040',
  },
  US: {
    code: 'US', name: 'United States', flag: '🇺🇸', capital: 'Washington D.C.',
    currency: { code: 'USD', symbol: '$', toUSD: 1 },
    languages: ['English'], greeting: 'Hello',
    regulator: { name: 'Federal Reserve', short: 'FED', kind: 'Central bank' },
    markets:   { name: 'Securities & Exchange Commission', short: 'SEC', kind: 'Securities regulator' },
    tax:       { name: 'Internal Revenue Service', short: 'IRS', kind: 'Tax authority' },
    exchange:  { name: 'NYSE / Nasdaq', short: 'US' },
    pension:   { name: 'Social Security Administration', short: 'SSA' },
    mobileMoney: ['Apple Pay', 'Venmo', 'Cash App'],
    banks: ['Chase', 'Bank of America', 'Wells Fargo', 'Citi'],
    taxBands: [
      { upTo: 11_600,   rate: 0.10, label: '10% — up to 11,600' },
      { upTo: 47_150,   rate: 0.12, label: '12% — 11,601 – 47,150' },
      { upTo: 100_525,  rate: 0.22, label: '22% — 47,151 – 100,525' },
      { upTo: 191_950,  rate: 0.24, label: '24% — 100,526 – 191,950' },
      { upTo: Infinity, rate: 0.32, label: '32%+ — above 191,950' },
    ],
    tickers: [
      { sym: 'VTI',  name: 'Vanguard Total Market', px: 268, ch: +0.4, lot: 1 },
      { sym: 'AAPL', name: 'Apple',                 px: 218, ch: -0.2, lot: 1 },
      { sym: 'MSFT', name: 'Microsoft',             px: 432, ch: +0.8, lot: 1 },
      { sym: 'VXUS', name: 'Vanguard Intl ex-US',   px: 65,  ch: +0.1, lot: 1 },
    ],
    govBonds: [
      { name: '10-yr Treasury', yield: 4.25 },
      { name: '30-yr Treasury', yield: 4.55 },
    ],
    advisorContext: 'SEC-regulated · Reg BI',
  },
};

// ─── Sample user dataset ────────────────────────────────────────
// All amounts are stored in the country's *native* currency.
// `tier` and `dataState` swap entire datasets — wired to Tweaks.

const DATASETS = {
  RW: {
    empty: {
      name: 'Aline',
      tier: 'consumer',
      networth: 240_000,
      cash:    240_000,
      invest:        0,
      goals:   [],
      budget:  [],
      txns:    [],
      holdings: [],
    },
    typical: {
      name: 'Aline Uwase',
      tier: 'consumer',
      networth: 4_820_000,
      cash:     1_240_000,
      invest:   2_180_000,
      property: 1_400_000,
      monthlyIncome: 720_000,
      monthlySpend:  486_000,
      goals: [
        { id:'house',    label: 'Down payment, Kigali',  target: 18_000_000, saved:  4_200_000, by: 'Dec 2028', color:'brand' },
        { id:'edu',      label: 'Daughter — Univ. fees', target:  8_000_000, saved:  2_100_000, by: 'Sep 2030', color:'gold' },
        { id:'emergency',label: 'Emergency fund',        target:  2_400_000, saved:  1_800_000, by: 'On track', color:'sky' },
      ],
      budget: [
        { cat:'Rent',         spent: 180_000, budget: 180_000, color:'brand' },
        { cat:'Groceries',    spent:  92_000, budget: 110_000, color:'gold'  },
        { cat:'Transport',    spent:  48_000, budget:  60_000, color:'sky'   },
        { cat:'MoMo / utils', spent:  31_400, budget:  40_000, color:'plum'  },
        { cat:'Eating out',   spent:  62_000, budget:  45_000, color:'clay'  },
        { cat:'School',       spent:  72_000, budget:  75_000, color:'brand' },
      ],
      txns: [
        { d:'Today',     t:'09:42', who:'Kimironko Market',  cat:'Groceries',  amt: -8_400, via:'MTN MoMo' },
        { d:'Today',     t:'08:11', who:'SafeMotos',         cat:'Transport',  amt: -2_200, via:'MoMo' },
        { d:'Yesterday', t:'19:22', who:'Repub Lounge',      cat:'Eating out', amt:-22_000, via:'Card' },
        { d:'Yesterday', t:'12:30', who:'Salary — RDB',      cat:'Income',     amt:+720_000, via:'Bank' },
        { d:'2 Jun',     t:'18:55', who:'REG · Electricity', cat:'Utilities',  amt: -9_400, via:'MoMo' },
        { d:'2 Jun',     t:'14:10', who:'Simba Supermarket', cat:'Groceries',  amt:-31_200, via:'Card' },
        { d:'1 Jun',     t:'17:02', who:'Bank of Kigali',    cat:'Investment', amt:-150_000, via:'Transfer' },
        { d:'31 May',    t:'09:00', who:'RSSB contribution', cat:'Pension',    amt: -43_200, via:'Auto' },
      ],
      holdings: [
        { sym:'BOK',  shares: 2400, avg: 295, cls:'Equity · RSE' },
        { sym:'MTNR', shares: 1800, avg: 184, cls:'Equity · RSE' },
        { sym:'BLR',  shares:  900, avg: 162, cls:'Equity · RSE' },
        { sym:'TBOND',shares:    1, avg: 500_000, cls:'Gov. Bond · 7yr', yield:13.25, name:'7-yr Treasury Bond' },
        { sym:'UTRUST',shares:300_000,avg:1, cls:'Unit Trust · BK', yield:11.50, name:'BK Money Market Fund' },
      ],
      insights: [
        { kind:'warn', title:'Eating out is 38% over budget', body:'You\'ve spent 62,000 RWF on restaurants this month — 17,000 over the limit. Want me to lower next month\'s cap or shift it from another category?' },
        { kind:'idea', title:'7-yr T-Bond yields 13.25%', body:'Idle cash of 380,000 RWF could earn ~50,000 RWF/yr in a BNR Treasury Bond. Tax-free up to certain limits per RRA rules.' },
        { kind:'good', title:'Emergency fund 75% complete', body:'At your current pace you\'ll hit the 2.4M target by November — two months ahead of plan.' },
      ],
    },
    wealthy: {
      name: 'Jean-Paul Habimana',
      tier: 'hnw',
      networth: 412_000_000,
      cash:      28_000_000,
      invest:   246_000_000,
      property: 138_000_000,
      monthlyIncome: 14_200_000,
      monthlySpend:   5_840_000,
      goals: [
        { id:'legacy',  label:'Family trust',        target: 500_000_000, saved: 184_000_000, by: '2032', color:'brand' },
        { id:'villa',   label:'Lake Kivu villa',     target: 220_000_000, saved:  92_000_000, by: 'Dec 2027', color:'gold' },
        { id:'venture', label:'Agri-VC fund commit', target: 100_000_000, saved:  40_000_000, by: '2026', color:'sky' },
      ],
      budget: [
        { cat:'Property',     spent: 1_800_000, budget: 2_000_000, color:'brand' },
        { cat:'Household',    spent: 1_240_000, budget: 1_500_000, color:'gold'  },
        { cat:'Travel',       spent: 1_100_000, budget: 1_400_000, color:'sky'   },
        { cat:'Philanthropy', spent:   900_000, budget: 1_200_000, color:'plum'  },
        { cat:'Education',    spent:   620_000, budget:   700_000, color:'clay'  },
        { cat:'Other',        spent:   180_000, budget:   200_000, color:'brand' },
      ],
      txns: [
        { d:'Today',     t:'10:11', who:'Serena Hotel',         cat:'Travel',      amt: -340_000,  via:'Card' },
        { d:'Today',     t:'09:30', who:'Inkomoko VC — capital call', cat:'Investment', amt:-12_000_000, via:'Wire' },
        { d:'Yesterday', t:'16:00', who:'BK Wealth Mgmt — dividend', cat:'Income',  amt:+4_200_000, via:'Bank' },
        { d:'2 Jun',     t:'12:30', who:'Property Mgmt — Nyarutarama', cat:'Property', amt:-1_800_000, via:'Bank' },
        { d:'1 Jun',     t:'09:00', who:'Salary — Habimana Group', cat:'Income',  amt:+14_200_000,via:'Bank' },
        { d:'31 May',    t:'14:20', who:'AgaKhan Foundation',   cat:'Philanthropy',amt: -900_000,  via:'Bank' },
      ],
      holdings: [
        { sym:'BOK',  shares: 48_000, avg: 280, cls:'Equity · RSE' },
        { sym:'MTNR', shares: 32_000, avg: 175, cls:'Equity · RSE' },
        { sym:'BLR',  shares: 22_000, avg: 160, cls:'Equity · RSE' },
        { sym:'CTL',  shares: 18_000, avg:  72, cls:'Equity · RSE' },
        { sym:'IMR',  shares: 56_000, avg:  38, cls:'Equity · RSE' },
        { sym:'INFRA',shares:    180,  avg: 500_000, cls:'Gov. Bond · 15yr', yield:13.90, name:'15-yr Infra Bond' },
        { sym:'PEFND',shares:      1,  avg: 60_000_000, cls:'Private Equity', yield:18.00, name:'Inkomoko Growth Fund III' },
      ],
      insights: [
        { kind:'idea', title:'Concentration risk — RSE 78%', body:'Your equity portfolio is 78% on Rwanda Stock Exchange. Consider EAC regional diversification via Nairobi or Dar es Salaam listings.' },
        { kind:'warn', title:'Capital gains exposure: 14M RWF', body:'If you sell BOK at current price you crystallise 14M RWF in gains. RRA capital gains rules apply for shares held under 12 months.' },
        { kind:'good', title:'Philanthropy under cap', body:'You\'ve used 75% of the deductible philanthropy budget. AgaKhan Foundation contributions are RRA-deductible.' },
      ],
    },
  },
};

// Mirror the RW dataset shape for other countries (currency-converted) so the
// country switcher works without designing 4× the screens. We scale numbers by
// the inverse FX so the "feel" stays similar (e.g. ~$3.5k/mo income).
function mirrorDataset(srcCountry, srcDataset, dstCountryCode) {
  const dst = COUNTRIES[dstCountryCode];
  if (!dst) return srcDataset;
  const fx = COUNTRIES[srcCountry].currency.toUSD / dst.currency.toUSD;
  const scale = (n) => Math.round(n * fx);
  const cp = (obj) => JSON.parse(JSON.stringify(obj));
  const out = cp(srcDataset);
  const numKeys = ['networth','cash','invest','property','monthlyIncome','monthlySpend'];
  numKeys.forEach(k => { if (out[k]) out[k] = scale(out[k]); });
  out.goals?.forEach(g => { g.target = scale(g.target); g.saved = scale(g.saved); });
  out.budget?.forEach(b => { b.spent = scale(b.spent); b.budget = scale(b.budget); });
  out.txns?.forEach(t => { t.amt = scale(t.amt); });
  out.holdings?.forEach(h => { h.avg = scale(h.avg); });
  // Swap RSE tickers for the country's own
  out.holdings = (out.holdings || []).map((h, i) => {
    const t = dst.tickers[i % dst.tickers.length];
    return { ...h, sym: t.sym };
  });
  return out;
}

['KE','UG','US'].forEach(cc => {
  DATASETS[cc] = {
    empty:   mirrorDataset('RW', DATASETS.RW.empty,   cc),
    typical: mirrorDataset('RW', DATASETS.RW.typical, cc),
    wealthy: mirrorDataset('RW', DATASETS.RW.wealthy, cc),
  };
});

// ─── Formatters ─────────────────────────────────────────────────
function fmtMoney(n, country, opts = {}) {
  if (n == null || isNaN(n)) return '—';
  const c = COUNTRIES[country] || COUNTRIES.RW;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const compact = opts.compact ?? false;
  let body;
  if (compact && abs >= 1_000_000) body = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M';
  else if (compact && abs >= 1_000) body = (abs / 1_000).toFixed(0) + 'k';
  else body = abs.toLocaleString('en-US', { maximumFractionDigits: opts.decimals ?? 0 });
  if (opts.symbolAfter) return `${sign}${body} ${c.currency.code}`;
  return `${sign}${c.currency.symbol === c.currency.code ? c.currency.code + ' ' : c.currency.symbol}${body}`;
}

function fmtPct(n, decimals = 1) {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

Object.assign(window, { COUNTRIES, DATASETS, fmtMoney, fmtPct });
