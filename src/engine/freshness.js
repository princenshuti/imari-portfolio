// freshness.js — Data Freshness & Trust layer (§11).
// Every derived number should be able to say how old its inputs are. A
// confidently-wrong stale number erodes trust faster than no number.
//
// Pure: all time reads come from the caller-supplied `now`.

// Per-type staleness thresholds (ms). FX/market mirror the existing SW policy;
// user-entered assets get 30 days before we nudge.
export const THRESHOLDS_MS = {
  fx: 60 * 60 * 1000, // 1 hour
  market: 15 * 60 * 1000, // 15 minutes
  asset: 30 * 24 * 60 * 60 * 1000, // 30 days
  netWorth: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/** When an asset's value was last verified — a real stamp, never the purchase date. */
export function assetAsOf(asset) {
  return asset?.updatedAt || asset?.createdAt || null;
}

/**
 * Net worth is only as fresh as its oldest input. Returns the oldest asset
 * stamp; falls back to profile.createdAt; null if nothing is known.
 */
export function netWorthAsOf(state) {
  const stamps = (state.assets || []).map(assetAsOf).filter(Boolean).sort();
  if (stamps.length) return stamps[0];
  return state.profile?.createdAt || null;
}

function ageMs(asOfISO, now) {
  return now.getTime() - new Date(asOfISO).getTime();
}

/** Human relative age: "today", "3 days ago", "3 weeks ago", "2 months ago". */
export function humanizeAge(ms) {
  const days = ms / 86400000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 14) return `${Math.round(days)} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const yrs = days / 365;
  return `${yrs.toFixed(yrs < 2 ? 1 : 0)} years ago`;
}

/**
 * Freshness chip descriptor for a derived figure.
 * @returns {{ asOf: string, ageMs: number, isStale: boolean, label: string } | null}
 */
export function freshnessChip(asOfISO, { now = new Date(), thresholdMs = THRESHOLDS_MS.asset } = {}) {
  if (!asOfISO) return null;
  const age = ageMs(asOfISO, now);
  return {
    asOf: asOfISO,
    ageMs: age,
    isStale: age > thresholdMs,
    label: `as of ${humanizeAge(age)}`,
  };
}

/** Assets carrying a stamp older than the threshold (the ones worth refreshing). */
export function staleAssets(state, { now = new Date(), thresholdMs = THRESHOLDS_MS.asset } = {}) {
  return (state.assets || []).filter(a => {
    const s = assetAsOf(a);
    return s && ageMs(s, now) > thresholdMs;
  });
}

/**
 * Cost-of-Absence-shaped insight when net worth rests on stale inputs (§11
 * step 3). Returns null when fresh. Shares the Insight schema so the dashboard
 * can rank it against engine insights for the single pinned card.
 */
export function staleNetWorthInsight(state, { now = new Date() } = {}) {
  const asOf = netWorthAsOf(state);
  if (!asOf) return null;
  const age = ageMs(asOf, now);
  if (age <= THRESHOLDS_MS.netWorth) return null;

  const stale = staleAssets(state, { now });
  const assets = state.assets || [];
  const sourceRefs = stale.length ? stale.map(a => a.id) : assets.slice(0, 3).map(a => a.id);
  if (sourceRefs.length === 0) return null; // nothing to point at

  const n = stale.length;
  const ageLabel = humanizeAge(age);
  const severity = age > 60 * 86400000 ? 'warning' : 'info';

  return {
    id: 'stale-net-worth',
    type: 'foresight',
    category: 'networth',
    headline: `Your net worth is ${ageLabel.replace('ago', 'old').trim()}`,
    body: `These figures rest on data last touched ${ageLabel}. Refresh your assets so the number on screen is real.`,
    costOfAbsence: {
      severity,
      amount: age / 86400000,
      costStatement: n > 0
        ? `Your net worth is based on data last touched ${ageLabel} — update ${n} asset${n === 1 ? '' : 's'} to make it real.`
        : `Your net worth is based on data last touched ${ageLabel} — refresh your assets to make it real.`,
      action: { label: 'Update assets', to: 'assets' },
    },
    sourceRefs,
    computedAt: now.toISOString(),
    dataAsOf: asOf,
    dismissed: false,
  };
}
