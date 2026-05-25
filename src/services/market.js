/**
 * market.js — Live market data fetcher.
 *
 * Sources used (all free, CORS-enabled, no API key required):
 *   • FX rates   → Supabase `exchange_rates` (BNR official, refreshed daily by Edge Function).
 *                  Fallback → open.er-api.com/v6/latest/USD when Supabase is empty/offline.
 *   • Crypto     → api.coingecko.com              (updated in real time, includes 24h change)
 *   • Gold       → api.metals.live/v1/spot/gold   (spot price in USD/troy oz)
 *   • S&P 500    → query1.finance.yahoo.com       (best-effort; may fail due to CORS)
 *
 * Rwanda-specific rates (BNR Repo, NISR CPI, RSE ASI, 10yr Treasury) have
 * NO public API — they are reference values manually sourced from official publications.
 *
 * Results are cached in sessionStorage for CACHE_TTL to avoid hammering free tiers.
 */
import { supabase, isConfigured as supabaseConfigured } from '../supabase.js';
import { setLiveFX } from '../data.js';

const CACHE_KEY = 'imari:market:v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const BNR_CURRENCIES = ['USD', 'EUR', 'KES'];

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
 * Pull the most recent BNR rate row for each tracked currency.
 * Returns { USD: { buy, sell, avg, date }, ... } or null if Supabase isn't
 * configured / table is empty / network failed.
 */
async function fetchBnrRates() {
  if (!supabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('currency, rate_date, buying_rate, average_rate, selling_rate')
      .in('currency', BNR_CURRENCIES)
      .order('rate_date', { ascending: false })
      .limit(BNR_CURRENCIES.length * 12); // small over-fetch so we always have one per ccy
    if (error || !Array.isArray(data) || data.length === 0) return null;

    const latest = {};
    for (const row of data) {
      const prev = latest[row.currency];
      if (!prev || row.rate_date > prev.date) {
        latest[row.currency] = {
          buy:  +row.buying_rate,
          sell: +row.selling_rate,
          avg:  +row.average_rate,
          date: row.rate_date,
        };
      }
    }
    return Object.keys(latest).length ? latest : null;
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
    if (cached) {
      // Cache hit doesn't include LIVE_FX in module state — repopulate from
      // whatever rates the cache holds so converters keep working after reload.
      if (cached.data?.bnrRates) setLiveFX(cached.data.bnrRates);
      return cached.data;
    }
  }

  const result = {};

  // ── 1a. BNR official rates (preferred FX source) ────────────────────────
  // Refreshed daily by the bnr-rates Edge Function. Includes asymmetric
  // buying / selling spread that the converters use directly.
  const bnr = await fetchBnrRates();
  if (bnr) {
    setLiveFX(bnr);
    result.bnrRates = bnr;
    result.fxSource = 'bnr';
    result.fxAsOf   = Object.values(bnr).map(r => r.date).sort().pop();
    if (bnr.USD) { result.usdRwf = Math.round(bnr.USD.avg); result.usdRwfLive = true; }
    if (bnr.EUR) result.eurRwf = Math.round(bnr.EUR.avg);
    if (bnr.KES) result.kesRwf = +bnr.KES.avg.toFixed(2);
    result.fxRates = {
      RWF: 1,
      USD: bnr.USD ? Math.round(bnr.USD.avg) : undefined,
      EUR: bnr.EUR ? Math.round(bnr.EUR.avg) : undefined,
      KES: bnr.KES ? +bnr.KES.avg.toFixed(2)  : undefined,
    };
  }

  // ── 1b. Fallback FX (USD base) — ExchangeRate-API ───────────────────────
  // Only consulted when BNR isn't available. Symmetric (single rate per pair).
  if (!result.fxRates) {
    const fx = await safeFetch('https://open.er-api.com/v6/latest/USD');
    if (fx?.result === 'success' && fx.rates) {
      const r = fx.rates;
      if (r.RWF) {
        result.usdRwf      = Math.round(r.RWF);
        result.usdRwfLive  = true;
      }
      if (r.EUR) result.eurRwf = +(r.RWF / r.EUR).toFixed(0);
      if (r.KES) result.kesRwf = +(r.RWF / r.KES).toFixed(2);
      if (r.RWF && r.EUR && r.KES) {
        result.fxRates = {
          RWF: 1,
          USD: Math.round(r.RWF),
          EUR: Math.round(r.RWF / r.EUR),
          KES: +(r.RWF / r.KES).toFixed(2),
        };
        result.fxSource = 'open.er-api.com';
        // Mirror the symmetric fallback into LIVE_FX so converters still work
        // asymmetrically (buy === sell when source has no spread).
        const mirror = {};
        for (const c of BNR_CURRENCIES) {
          const v = result.fxRates[c];
          if (v) mirror[c] = { buy: v, sell: v, avg: v, date: null };
        }
        setLiveFX(mirror);
      }
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
