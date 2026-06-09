// forecast.js — 30-day cash-flow forecast. Pure: deterministic given
// (cashflows, openingBalance, now). Projects the user's liquid balance forward
// day by day from their recurring entries plus any future-dated one-offs, so
// "can I cover the next 30 days?" is answered from data they already entered.
import { toBase } from '../data.js';

function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

// Local-calendar ISO date — toISOString() would shift a local midnight back a
// day for any user east of UTC (Kigali is UTC+2).
function isoLocal(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Day-of-month an anchored recurring entry fires on, clamped to the month
 *  (an entry anchored on the 31st fires on Feb 28/29). */
function clampedDay(anchorDay, year, monthIdx) {
  return Math.min(anchorDay, daysInMonth(year, monthIdx));
}

/** Does this cashflow entry produce an occurrence on `date` (a local Date at midnight)? */
function occursOn(cf, date) {
  const anchor = new Date(cf.date);
  if (Number.isNaN(anchor.getTime())) return false;
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();

  if (!cf.recurring || cf.recurring === 'once') {
    // One-offs only matter if future-dated: past ones are already in balances.
    return anchor.getFullYear() === y && anchor.getMonth() === m && anchor.getDate() === d;
  }

  // A recurring entry never fires before its anchor date.
  if (date < new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) return false;

  const monthsSince = (y - anchor.getFullYear()) * 12 + (m - anchor.getMonth());
  const fireDay = clampedDay(anchor.getDate(), y, m);
  switch (cf.recurring) {
    case 'monthly':   return d === fireDay;
    case 'quarterly': return monthsSince % 3 === 0 && d === fireDay;
    case 'annually':  return monthsSince % 12 === 0 && d === fireDay;
    default:          return false;
  }
}

/**
 * Project the liquid balance forward.
 *
 * @param {object} opts
 * @param {Array}  opts.cashflows       state.cashflows
 * @param {number} opts.openingBalance  liquid balance in RWF at `now`
 * @param {Date}   opts.now             forecast start (exclusive — day 1 is tomorrow)
 * @param {number} opts.days            horizon, default 30
 * @returns {{
 *   openingBalance: number,
 *   days: Array<{ date: string, income: number, expense: number, net: number, balance: number }>,
 *   totalIncome: number, totalExpense: number, net: number,
 *   endBalance: number, minBalance: number, minDate: string|null,
 *   firstShortfallDate: string|null,
 * }}
 */
export function forecastCashflow({ cashflows = [], openingBalance = 0, now = new Date(), days = 30 } = {}) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  let balance = openingBalance;
  let totalIncome = 0, totalExpense = 0;
  let minBalance = openingBalance, minDate = null, firstShortfallDate = null;

  for (let i = 1; i <= days; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    let income = 0, expense = 0;
    for (const cf of cashflows) {
      if (!occursOn(cf, date)) continue;
      const amt = toBase(cf.amount || 0, cf.currency || 'RWF');
      if (cf.type === 'income') income += amt; else expense += amt;
    }
    balance += income - expense;
    totalIncome += income;
    totalExpense += expense;
    const iso = isoLocal(date);
    if (balance < minBalance) { minBalance = balance; minDate = iso; }
    if (balance < 0 && !firstShortfallDate) firstShortfallDate = iso;
    out.push({ date: iso, income, expense, net: income - expense, balance });
  }

  return {
    openingBalance,
    days: out,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    endBalance: balance,
    minBalance,
    minDate,
    firstShortfallDate,
  };
}
