// _shared.js — pure helpers shared across insight rules.
// Everything here is deterministic given (state, now); no side effects, no I/O,
// no live-clock reads except the caller-supplied `now`. This is what makes the
// engine unit-testable (R1).

import { CLASSES, valueRWF, costRWF, toBase } from '../../data.js';

export const LIQUID_KINDS = new Set(['savings', 'momo-cash']);
export const MAINT_KINDS = new Set(['realestate-house', 'realestate-land', 'vehicle', 'livestock']);

export const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 };

/** Mirror of the dashboard's income-generating classification (single source of truth). */
export function isIncomeGenerating(a) {
  if (a.incomeGenerates) return true;
  if (a.kind === 'bond') return true;
  if ((a.kind === 'savings' || a.kind === 'receivable') && (a.yieldPct || 0) > 0) return true;
  if (a.kind === 'rse-equity' || a.kind === 'foreign-equity') return true;
  if (a.kind === 'realestate-house') return true;
  return false;
}

/** Sum of liquid (cash / MoMo / savings) asset values in RWF. */
export function liquidValueRWF(assets = [], now) {
  return assets
    .filter(a => LIQUID_KINDS.has(a.kind))
    .reduce((s, a) => s + valueRWF(a, now), 0);
}

/** Gross asset value and cost basis in RWF. */
export function grossValueRWF(assets = [], now) {
  return assets.reduce((s, a) => s + valueRWF(a, now), 0);
}
export function totalCostRWF(assets = []) {
  return assets.reduce((s, a) => s + costRWF(a), 0);
}

/** Total debt (remaining balances) in RWF. */
export function totalDebtRWF(liabilities = []) {
  return liabilities.reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0);
}

export function netWorthRWF(state, now) {
  return grossValueRWF(state.assets || [], now) - totalDebtRWF(state.liabilities || []);
}

/** Normalize a recurring cashflow amount to a per-month RWF figure. */
function monthlyAmountRWF(cf) {
  const base = toBase(cf.amount || 0, cf.currency || 'RWF');
  if (cf.recurring === 'monthly') return base;
  if (cf.recurring === 'quarterly') return base / 3;
  if (cf.recurring === 'annually') return base / 12;
  return 0; // 'once' handled separately
}

/**
 * Average monthly income & expense in RWF, consistent with the dashboard's
 * 6-month trend: recurring entries pro-rated to monthly + one-time entries in
 * the trailing `months` window averaged over that window.
 */
export function monthlyFlowsRWF(cashflows = [], now = new Date(), months = 6) {
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  let recurInc = 0, recurExp = 0, onceInc = 0, onceExp = 0;
  for (const cf of cashflows) {
    const d = new Date(cf.date);
    if (cf.recurring && cf.recurring !== 'once') {
      if (d <= now) {
        if (cf.type === 'income') recurInc += monthlyAmountRWF(cf);
        else recurExp += monthlyAmountRWF(cf);
      }
    } else {
      if (d >= start && d <= now) {
        const amt = toBase(cf.amount || 0, cf.currency || 'RWF');
        if (cf.type === 'income') onceInc += amt; else onceExp += amt;
      }
    }
  }
  return {
    monthlyIncome: recurInc + onceInc / months,
    monthlyExpense: recurExp + onceExp / months,
  };
}

export function classOf(a) {
  return CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
}

/**
 * Oldest "as of" timestamp among the given assets — the staleness anchor for a
 * derived figure (§11: a number is only as fresh as its oldest input). Falls
 * back to profile.createdAt, then `now`. Returns an ISO string.
 */
export function inputsAsOf(state, assetIds, now = new Date()) {
  const ids = new Set(assetIds || []);
  const stamps = (state.assets || [])
    .filter(a => ids.has(a.id))
    .map(a => a.updatedAt || a.createdAt || null)
    .filter(Boolean);
  if (stamps.length) return stamps.sort()[0];
  return state.profile?.createdAt || now.toISOString();
}

/**
 * Build an Insight record. `id` is the stable rule id so a dismissal persists
 * across regenerations. dataAsOf is normalized to an ISO string.
 */
export function makeInsight({
  id, type, category, headline, body,
  costOfAbsence = null, sourceRefs = [], dataAsOf, now = new Date(),
}) {
  return {
    id,
    type,
    category,
    headline,
    body,
    costOfAbsence,
    sourceRefs: [...new Set(sourceRefs)],
    computedAt: now.toISOString(),
    dataAsOf: dataAsOf instanceof Date ? dataAsOf.toISOString() : (dataAsOf || now.toISOString()),
    dismissed: false,
  };
}

/**
 * Compact RWF formatting for insight copy (engine-side, no display-currency dep).
 * Floors toward −∞ — a figure shown to the user must never exceed reality.
 */
export function rwf(n) {
  const floorTo = (val, d) => { const f = 10 ** d; return Math.floor(val * f) / f; };
  const abs = Math.abs(n);
  let disp, dec, suffix = '';
  if (abs >= 1_000_000_000) { dec = abs >= 10_000_000_000 ? 0 : 1; disp = floorTo(n / 1_000_000_000, dec); suffix = 'B'; }
  else if (abs >= 1_000_000) { dec = abs >= 10_000_000 ? 0 : 1; disp = floorTo(n / 1_000_000, dec); suffix = 'M'; }
  else if (abs >= 1_000) { dec = 0; disp = floorTo(n / 1_000, dec); suffix = 'k'; }
  else { dec = 0; disp = floorTo(n, 0); }
  const sign = disp < 0 ? '-' : '';
  const mag = Math.abs(disp);
  return `RWF ${sign}${suffix ? mag.toFixed(dec) + suffix : String(mag)}`;
}
