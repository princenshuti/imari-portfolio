// recurrence.js — the single source of truth for how a cash-flow entry's
// cadence and date are interpreted. Every module that asks "what does this
// entry cost per month?" or "does this entry count toward month X?" must go
// through here; previously four near-identical copies of this math existed
// (recurringAudit, budgets, monthlyReport, insights/_shared) and could drift.
import { toBase } from '../data.js';

/**
 * Parse a stored entry date as a LOCAL calendar date. `new Date('2026-06-01')`
 * is UTC midnight per spec, so for users west of UTC its local components
 * land on May 31 — recurring anchors fire a day early and month bucketing
 * shifts entries into the prior month. Date-only strings therefore get parsed
 * by components; anything else falls back to the native parser.
 */
export function parseLocalDate(value) {
  if (value instanceof Date) return value;
  if (value == null || value === '') return new Date(NaN); // new Date(null) is the epoch
  const str = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.slice(0, 10));
  if (m && str.length <= 10) return new Date(+m[1], +m[2] - 1, +m[3]);
  // Timestamps ('2026-06-01T08:00:00Z') carry a real time — let JS handle them.
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  // Date-only prefix of a malformed string ('2026-06-01garbage') — salvage it.
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return d; // Invalid Date — callers check with Number.isNaN(d.getTime())
}

/** Per-month equivalent of an amount on the given cadence ('once' = the amount itself). */
export function monthlyEquivalent(amount, recurring) {
  switch (recurring) {
    case 'monthly':   return amount;
    case 'quarterly': return amount / 3;
    case 'annually':  return amount / 12;
    default:          return amount;
  }
}

/** Per-month RWF equivalent of a cash-flow entry. */
export function monthlyEquivalentRWF(cf) {
  return monthlyEquivalent(toBase(cf.amount || 0, cf.currency || 'RWF'), cf.recurring);
}

/**
 * Next occurrence of a recurring entry on or after `from`, with end-of-month
 * anchors clamped to shorter months (a bill anchored on the 31st lands on
 * Feb 28, not Mar 3). Single owner of occurrence-stepping — forecast.js and
 * obligationSmoothing previously each derived their own and could disagree
 * about when the same bill lands.
 * Returns null for invalid dates or 'once' entries already in the past.
 */
export function nextOccurrence(cf, from = new Date()) {
  const anchor = parseLocalDate(cf.date);
  if (Number.isNaN(anchor.getTime())) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (!cf.recurring || cf.recurring === 'once') {
    return anchor >= start ? anchor : null;
  }

  const stepMonths = cf.recurring === 'quarterly' ? 3 : cf.recurring === 'monthly' ? 1 : 12;
  const anchorDay = anchor.getDate();
  let y = anchor.getFullYear(), m = anchor.getMonth();
  // Walk in whole steps from the anchor so the day-of-month never drifts.
  for (let guard = 0; guard < 1200; guard++) {
    const day = Math.min(anchorDay, new Date(y, m + 1, 0).getDate());
    const candidate = new Date(y, m, day);
    if (candidate >= start) return candidate;
    m += stepMonths;
    if (m > 11) { y += Math.floor(m / 12); m %= 12; }
  }
  return null; // unreachable for sane dates; guards a corrupt far-past anchor
}

/**
 * Does this entry count toward the calendar month (year, monthIdx)?
 * Recurring entries count from their anchor month onward (at their monthly
 * equivalent); one-offs count only in the month they're dated.
 */
export function countsInMonth(cf, year, monthIdx) {
  const d = parseLocalDate(cf.date);
  if (Number.isNaN(d.getTime())) return false;
  return cf.recurring && cf.recurring !== 'once'
    ? d <= new Date(year, monthIdx + 1, 0)
    : d.getFullYear() === year && d.getMonth() === monthIdx;
}
