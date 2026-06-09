// monthlyReport.js — auto-generated monthly money report. Pure. Everything is
// derived from data the user already entered (cashflows, snapshots, budgets);
// nothing here invents a number. Month counting matches the CashFlow view and
// budgets.js: recurring entries at monthly equivalent once anchored, one-offs
// dated inside the month.
import { toBase, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../data.js';
import { budgetStatus } from './budgets.js';

const ALL_CATS = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

function monthlyEquivalentRWF(cf) {
  const a = toBase(cf.amount || 0, cf.currency || 'RWF');
  switch (cf.recurring) {
    case 'monthly':   return a;
    case 'quarterly': return a / 3;
    case 'annually':  return a / 12;
    default:          return a;
  }
}

/** Entries that count toward the calendar month (y, mIdx), with RWF monthly value. */
function entriesForMonth(cashflows, y, mIdx) {
  const endOfMonth = new Date(y, mIdx + 1, 0);
  const out = [];
  for (const cf of cashflows) {
    const d = new Date(cf.date);
    if (Number.isNaN(d.getTime())) continue;
    const counts = cf.recurring && cf.recurring !== 'once'
      ? d <= endOfMonth
      : d.getFullYear() === y && d.getMonth() === mIdx;
    if (counts) out.push({ ...cf, _rwf: monthlyEquivalentRWF(cf) });
  }
  return out;
}

function summarise(entries) {
  let income = 0, expense = 0;
  const expenseByCat = {};
  for (const e of entries) {
    if (e.type === 'income') { income += e._rwf; continue; }
    expense += e._rwf;
    const cat = e.category || 'other-exp';
    expenseByCat[cat] = (expenseByCat[cat] || 0) + e._rwf;
  }
  return { income, expense, expenseByCat };
}

/**
 * Build the report for the calendar month `monthOffset` months back from `now`
 * (0 = the month containing `now`).
 *
 * @returns {{
 *   year: number, monthIdx: number,
 *   income: number, expense: number, net: number, savingsRate: number|null,
 *   expenseCategories: Array<{ category, label, amount, share }>,
 *   topExpenses: Array<{ description, category, label, amount, date }>,
 *   prev: { income: number, expense: number },
 *   incomeDelta: number, expenseDelta: number,
 *   netWorth: null | { start: number, end: number, change: number,
 *                      startDate: string, endDate: string, includesSynthetic: boolean },
 *   budgets: ReturnType<typeof budgetStatus>,
 * }}
 */
export function buildMonthlyReport({ cashflows = [], snapshots = [], budgets = {}, now = new Date(), monthOffset = 0 } = {}) {
  const ref = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const y = ref.getFullYear(), mIdx = ref.getMonth();

  const entries = entriesForMonth(cashflows, y, mIdx);
  const { income, expense, expenseByCat } = summarise(entries);
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : null;

  const expenseCategories = Object.entries(expenseByCat)
    .map(([category, amount]) => ({
      category,
      label: ALL_CATS.find(c => c.id === category)?.label || category,
      amount,
      share: expense > 0 ? (amount / expense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topExpenses = entries
    .filter(e => e.type === 'expense' && (!e.recurring || e.recurring === 'once'))
    .sort((a, b) => b._rwf - a._rwf)
    .slice(0, 5)
    .map(e => ({
      description: e.notes || e.description || ALL_CATS.find(c => c.id === e.category)?.label || 'Expense',
      category: e.category || 'other-exp',
      label: ALL_CATS.find(c => c.id === e.category)?.label || 'Other',
      amount: e._rwf,
      date: e.date,
    }));

  // Previous month, for deltas.
  const prevRef = new Date(y, mIdx - 1, 1);
  const prevSummary = summarise(entriesForMonth(cashflows, prevRef.getFullYear(), prevRef.getMonth()));
  const prev = { income: prevSummary.income, expense: prevSummary.expense };

  // Net-worth motion inside the month, from daily snapshots.
  const ymStr = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
  const inMonth = snapshots
    .filter(s => s.date && s.date.startsWith(ymStr))
    .sort((a, b) => a.date.localeCompare(b.date));
  const netWorth = inMonth.length >= 2
    ? {
        start: inMonth[0].netWorth,
        end: inMonth[inMonth.length - 1].netWorth,
        change: inMonth[inMonth.length - 1].netWorth - inMonth[0].netWorth,
        startDate: inMonth[0].date,
        endDate: inMonth[inMonth.length - 1].date,
        includesSynthetic: inMonth.some(s => s.synthetic),
      }
    : null;

  return {
    year: y,
    monthIdx: mIdx,
    income,
    expense,
    net,
    savingsRate,
    expenseCategories,
    topExpenses,
    prev,
    incomeDelta: income - prev.income,
    expenseDelta: expense - prev.expense,
    netWorth,
    budgets: budgetStatus(cashflows, budgets, new Date(y, mIdx + 1, 0)),
  };
}
