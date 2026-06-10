// budgets.js — monthly budget envelopes per expense category. Pure. A budget
// is a monthly RWF limit; spend is what the current calendar month's entries
// say (recurring entries at their monthly equivalent, one-offs dated in the
// month) — consistent with how the CashFlow view counts a month.
import { EXPENSE_CATEGORIES } from '../data.js';
import { monthlyEquivalentRWF, countsInMonth } from './recurrence.js';

/** Expense spend in RWF per category for the calendar month containing `now`. */
export function monthSpendByCategory(cashflows = [], now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  const spend = {};
  for (const cf of cashflows) {
    if (cf.type !== 'expense') continue;
    if (!countsInMonth(cf, y, m)) continue;
    const cat = cf.category || 'other-exp';
    spend[cat] = (spend[cat] || 0) + monthlyEquivalentRWF(cf);
  }
  return spend;
}

/**
 * Envelope status for the month containing `now`.
 *
 * @param {Array}  cashflows  state.cashflows
 * @param {object} budgets    state.budgets — { [categoryId]: monthlyLimitRWF }
 * @returns {{
 *   rows: Array<{ category, label, budget, spent, remaining, pct, over, pace }>,
 *   totalBudget: number, totalSpent: number, totalOver: number,
 *   overCount: number, monthPct: number,
 * }}
 * `pct` is spend vs budget (can exceed 100). `monthPct` is how far through the
 * month we are — the honest pace baseline. `pace` is 'over' | 'hot' | 'ok':
 * hot = not over yet, but burning faster than the month is passing.
 */
export function budgetStatus(cashflows = [], budgets = {}, now = new Date()) {
  const spend = monthSpendByCategory(cashflows, now);
  const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = (now.getDate() / daysIn) * 100;

  const rows = EXPENSE_CATEGORIES
    .filter(c => (budgets[c.id] || 0) > 0)
    .map(c => {
      const budget = budgets[c.id];
      const spent = spend[c.id] || 0;
      const pct = (spent / budget) * 100;
      const over = spent > budget;
      const pace = over ? 'over' : pct > monthPct + 10 ? 'hot' : 'ok';
      return { category: c.id, label: c.label, budget, spent, remaining: budget - spent, pct, over, pace };
    })
    .sort((a, b) => b.pct - a.pct);

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalOver = rows.reduce((s, r) => s + (r.over ? r.spent - r.budget : 0), 0);

  return {
    rows,
    totalBudget,
    totalSpent,
    totalOver,
    overCount: rows.filter(r => r.over).length,
    monthPct,
  };
}
