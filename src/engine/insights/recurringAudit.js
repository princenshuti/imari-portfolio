// Recurring-subscription audit. Pure. Groups every non-'once' expense entry
// into a per-line monthly equivalent so the user can see what they're paying
// every month without looking at it. Income flows are excluded — the audit is
// about "money going out on autopilot."
import { toBase } from '../../data.js';

/** RWF monthly equivalent of a single recurring entry. */
function monthlyOf(entry) {
  const a = toBase(entry.amount || 0, entry.currency || 'RWF');
  switch (entry.recurring) {
    case 'monthly':   return a;
    case 'quarterly': return a / 3;
    case 'annually':  return a / 12;
    default:          return 0; // 'once' is not a subscription
  }
}

/**
 * @param {Array} cashflows  state.cashflows
 * @returns {{
 *   subscriptions: Array<{ id, description, category, recurring, amount, currency, monthly }>,
 *   totalMonthly: number,
 *   totalAnnual: number,
 *   count: number,
 *   byCategory: Array<{ category: string, count: number, monthly: number }>
 * }}
 */
export function auditRecurring(cashflows = []) {
  const subs = cashflows
    .filter(cf => cf.type === 'expense' && cf.recurring && cf.recurring !== 'once')
    .map(cf => ({
      id: cf.id,
      description: cf.description || cf.notes || cf.category || 'Recurring expense',
      category: cf.category || 'other',
      recurring: cf.recurring,
      amount: cf.amount,
      currency: cf.currency || 'RWF',
      monthly: monthlyOf(cf),
    }))
    .sort((a, b) => b.monthly - a.monthly);

  const totalMonthly = subs.reduce((s, x) => s + x.monthly, 0);
  const totalAnnual  = totalMonthly * 12;

  const catMap = new Map();
  for (const s of subs) {
    const cur = catMap.get(s.category) || { category: s.category, count: 0, monthly: 0 };
    cur.count += 1;
    cur.monthly += s.monthly;
    catMap.set(s.category, cur);
  }
  const byCategory = [...catMap.values()].sort((a, b) => b.monthly - a.monthly);

  return { subscriptions: subs, totalMonthly, totalAnnual, count: subs.length, byCategory };
}

export default auditRecurring;
