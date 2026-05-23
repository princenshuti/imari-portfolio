/**
 * market.js — Live market data fetcher.
 *
 * Sources used (all free, CORS-enabled, no API key required):
 *   • FX rates   → open.er-api.com/v6/latest/USD  (updated every 24h, includes RWF)
 *   • Crypto     → api.coingecko.com              (updated in real time, includes 24h change)
 *   • Gold       → api.metals.live/v1/spot/gold   (spot price in USD/troy oz)
 *   • S&P 500    → query1.finance.yahoo.com       (best-effort; may fail due to CORS)
 *
 * Rwanda-specific rates (BNR Repo, NISR CPI, RSE ASI, 10yr Treasury) have
 * NO public API — they are reference values manually sourced from official publications.
 *
 * Results are cached in sessionStorage for CACHE_TTL to avoid hammering free tiers.
 */

const CACHE_KEY = 'imari:market:v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function loadCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
    if (c.ts && Date.now() - c.ts < CACHE_TTL && c.data) return c;
  } catch {}
  return null;
}

function saveCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

/** Fetch a URL with a hard timeout. Returns parsed JSON or null on any failure. */
async function safeFetch(url, timeoutMs = 7000) {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal, mode: 'cors' });
    clearTimeout(id);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Fetch all available live market data.
 * Returns a result object — any field may be missing if its API failed.
 *
 * @param {boolean} forceRefresh  Skip the cache and re-fetch everything
 */
export async function fetchMarket(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = loadCache();
    if (cached) return cached.data;
  }

  const result = {};

  // ── 1. FX rates (USD base) — ExchangeRate-API ───────────────────────────
  // Returns 170+ world currencies including RWF, KES, EUR.
  // Updated every 24h. Free tier, no API key, CORS-enabled.
  const fx = await safeFetch('https://open.er-api.com/v6/latest/USD');
  if (fx?.result === 'success' && fx.rates) {
    const r = fx.rates;
    if (r.RWF) {
      result.usdRwf      = Math.round(r.RWF);        // 1 USD = X RWF
      result.usdRwfLive  = true;
    }
    if (r.EUR) result.eurRwf = +(r.RWF / r.EUR).toFixed(0);  // 1 EUR = X RWF
    if (r.KES) result.kesRwf = +(r.RWF / r.KES).toFixed(2);  // 1 KES = X RWF
    // Derived FX map (RWF base) for the in-app currency converter
    if (r.RWF && r.EUR && r.KES) {
      result.fxRates = {
        RWF: 1,
        USD: Math.round(r.RWF),
        EUR: Math.round(r.RWF / r.EUR),
        KES: +(r.RWF / r.KES).toFixed(2),
      };
    }
  }

  // ── 2. Gold (XAU/USD) — metals.live ─────────────────────────────────────
  // Free public spot-price API. Response: [{ gold: <price_per_troy_oz_USD> }]
  const metals = await safeFetch('https://api.metals.live/v1/spot/gold');
  if (Array.isArray(metals) && metals[0]?.gold) {
    result.goldUsd     = Math.round(metals[0].gold);
    result.goldUsdLive = true;
  } else {
    // Hard fallback — last known reference value (update manually when stale)
    result.goldUsd     = null;   // null = no reference, use TREND_DOMAINS default
    result.goldUsdLive = false;
  }

  // ── 3. Crypto — CoinGecko free API ──────────────────────────────────────
  // Real-time BTC + ETH prices in USD with 24h % change. No key required.
  // Rate limit: ~30 calls/minute on free tier.
  const gecko = await safeFetch(
    'https://api.coingecko.com/api/v3/simple/price' +
    '?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
  );
  if (gecko?.bitcoin?.usd) {
    result.btcUsd    = Math.round(gecko.bitcoin.usd);
    result.btcChange = +(gecko.bitcoin.usd_24h_change ?? 0).toFixed(2);
    result.btcLive   = true;
  }
  if (gecko?.ethereum?.usd) {
    result.ethUsd    = Math.round(gecko.ethereum.usd);
    result.ethChange = +(gecko.ethereum.usd_24h_change ?? 0).toFixed(2);
    result.ethLive   = true;
  }

  // ── 4. S&P 500 — Yahoo Finance (best-effort, may be CORS-blocked) ────────
  // Yahoo Finance does not officially support cross-origin browser requests.
  // We try it optimistically; failures are silently swallowed.
  const yf = await safeFetch(
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d'
  );
  if (yf?.chart?.result?.[0]) {
    const res    = yf.chart.result[0];
    const closes = (res.indicators?.quote?.[0]?.close ?? []).filter(v => v != null);
    if (closes.length >= 2) {
      const last = closes[closes.length - 1];
      const prev = closes[closes.length - 2];
      result.sp500      = Math.round(last);
      result.sp500Change = +((last - prev) / prev * 100).toFixed(2);
      result.sp500Live  = true;
    }
  }

  result.fetchedAt = new Date().toISOString();
  saveCache(result);
  return result;
}

/** Return the last cached result without triggering a fetch. May be null. */
export function getCachedMarket() {
  return loadCache()?.data ?? null;
}
