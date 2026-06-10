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
