/**
 * MarketContext — single source of truth for live market data.
 *
 * Fixes issue #4 (UX Review): Dashboard and Trends previously showed different
 * USD/RWF values because each view fetched/displayed market data independently.
 * Dashboard used the static `TREND_DOMAINS` fallback (1300); Trends called
 * `fetchMarket()` and applied overrides (1463). This context unifies them: one
 * fetch on mount, one `overrides` map, one place where market data lives.
 *
 * Consumers:
 *   const { market, overrides, status, fetchedAt, refresh } = useMarket();
 *
 *   - `market`     — raw result from services/market.js (USD rate, gold, crypto, etc.)
 *   - `overrides`  — keyed by TREND_DOMAINS[i].id; pass to <TrendCard override={…} />
 *   - `status`     — 'loading' | 'done' | 'error'
 *   - `fetchedAt`  — Date | null
 *   - `refresh(force)` — re-fetch (force=true bypasses 10-min sessionStorage cache)
 *
 * The provider also primes LIVE_FX (via setLiveFX inside fetchMarket) so the
 * RWF/USD/EUR/KES conversion helpers everywhere read the latest BNR rates.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMarket, getCachedMarket } from '../services/market.js';

const MarketContext = createContext(null);

/** Build per-domain overrides from a market fetch result. */
function buildOverrides(market) {
  if (!market) return {};
  const fetchedAt = market.fetchedAt ?? null;
  const out = {};

  if (market.usdRwf && market.usdRwfLive) {
    // BNR publishes three rates daily: buying, average (mid), selling. The app
    // uses BUY for foreign→RWF conversions and SELL for RWF→foreign (see
    // toBase/fromBase in data.js). Display all three so the user understands
    // the spread instead of seeing one rate while the math uses two others.
    const bnrUSD = market.bnrRates?.USD;
    out['usdrwf'] = {
      // Headline value uses the precise mid; falls back to the rounded usdRwf
      // when the source is the symmetric open.er-api fallback (no spread).
      value: bnrUSD?.avg ?? market.usdRwf,
      change: null,
      live: true,
      fetchedAt,
      source: bnrUSD
        ? 'BNR official daily rate · buying / mid / selling spread'
        : 'ExchangeRate-API · updated every 24h · BNR-tracked rate',
      spread: bnrUSD ?? null,  // { buy, sell, avg, date } when from BNR
    };
  }
  if (market.goldUsd && market.goldUsdLive) {
    out['gold'] = {
      value: market.goldUsd, change: null, live: true, fetchedAt,
      source: 'metals.live · XAU/USD spot price',
    };
  }
  if (market.btcUsd && market.btcLive) {
    out['btc'] = {
      value: market.btcUsd, change: market.btcChange, live: true, fetchedAt,
      source: 'CoinGecko · real-time',
    };
  }
  if (market.ethUsd && market.ethLive) {
    out['eth'] = {
      value: market.ethUsd, change: market.ethChange, live: true, fetchedAt,
      source: 'CoinGecko · real-time',
    };
  }
  if (market.sp500 && market.sp500Live) {
    out['sp500'] = {
      value: market.sp500, change: market.sp500Change, live: true, fetchedAt,
      source: 'Yahoo Finance · last close',
    };
  }
  return out;
}

export function MarketProvider({ children }) {
  // Seed from sessionStorage cache so first paint never shows stale fallback values.
  const [market, setMarket] = useState(() => getCachedMarket() || null);
  const [status, setStatus] = useState(() => (getCachedMarket() ? 'done' : 'loading'));
  const [error,  setError]  = useState(null);

  const refresh = useCallback(async (force = false) => {
    setStatus('loading'); setError(null);
    try {
      const m = await fetchMarket(force);
      setMarket(m);
      setStatus('done');
      return m;
    } catch (e) {
      setError(e?.message || 'Could not reach market data sources.');
      setStatus('error');
      throw e;
    }
  }, []);

  // Fetch on mount — getCachedMarket() returned non-null means the sessionStorage
  // cache is fresh, but we still want fetchMarket() to repopulate LIVE_FX (the
  // converter rates in data.js) since module-state doesn't persist across reloads.
  useEffect(() => { refresh(false); }, [refresh]);

  const overrides = useMemo(() => buildOverrides(market), [market]);
  const fetchedAt = useMemo(() => (market?.fetchedAt ? new Date(market.fetchedAt) : null), [market]);

  const value = useMemo(
    () => ({ market, overrides, status, error, fetchedAt, refresh }),
    [market, overrides, status, error, fetchedAt, refresh]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within <MarketProvider>');
  return ctx;
}
