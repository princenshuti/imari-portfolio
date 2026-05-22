/**
 * market.js — Live market data fetcher.
 * Uses CoinGecko (crypto) and open.er-api.com (FX).
 * Results are cached in sessionStorage for 15 minutes.
 */

const CACHE_KEY = 'imari:market:v1';
const CACHE_TTL = 15 * 60 * 1000; // 15 min

function load() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function save(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

export async function fetchMarket() {
  const cached = load();
  if (cached.ts && Date.now() - cached.ts < CACHE_TTL && cached.data) return cached.data;

  const result = {};
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  const safeFetch = (url) => Promise.race([fetch(url), timeout(6000)]).then(r => r.json()).catch(() => null);

  // ── Crypto prices (USD) via CoinGecko free API ──
  const gecko = await safeFetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
  );
  if (gecko) {
    result.btcUsd      = gecko.bitcoin?.usd;
    result.btcChange   = gecko.bitcoin?.usd_24h_change;
    result.ethUsd      = gecko.ethereum?.usd;
    result.ethChange   = gecko.ethereum?.usd_24h_change;
  }

  // ── FX rates (USD base) via open.er-api.com ──
  const fx = await safeFetch('https://open.er-api.com/v6/latest/USD');
  if (fx?.rates) {
    result.usdRwf = fx.rates.RWF;
    result.usdEur = fx.rates.EUR;
    result.usdKes = fx.rates.KES;
    result.eurRwf = fx.rates.RWF / fx.rates.EUR;
    result.kesRwf = fx.rates.RWF / fx.rates.KES;
  }

  // ── Gold price proxy — derive from XAU if available ──
  // CoinGecko doesn't cover gold; we estimate from the ETF tGOLD or skip
  // Open.er-api includes XAU (troy oz in USD) on paid tier only.
  // Use a static fallback of ~$2,400/oz that the user can override in FX settings.
  result.goldUsd = result.goldUsd || 2480;

  result.fetchedAt = new Date().toISOString();
  save(result);
  return result;
}

/** Convenience: last cached result without fetching. */
export function getCachedMarket() {
  return load().data || null;
}
