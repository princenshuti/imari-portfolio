// receivableOverdue — money lent out whose due date has passed. Every month
// unpaid is forgone yield at minimum, and collectability decays with age —
// the prompt is to chase it while it's still warm.

import { REFERENCE } from './refs.js';
import { makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF } from '../../data.js';
import { parseLocalDate } from '../recurrence.js';

const GRACE_DAYS = 30; // a few weeks late is life; a month late is a pattern

export default function receivableOverdue(state, { now = new Date(), refs = REFERENCE } = {}) {
  const overdue = (state.assets || [])
    .filter(a => a.kind === 'receivable' && a.dueDate)
    .map(a => {
      const due = parseLocalDate(a.dueDate);
      const days = Number.isNaN(due.getTime()) ? 0 : Math.floor((now - due) / 86400000);
      return { a, days, value: valueRWF(a, now) };
    })
    .filter(x => x.days >= GRACE_DAYS && x.value > 0)
    .sort((x, y) => y.value - x.value);
  if (overdue.length === 0) return null;

  const total = overdue.reduce((s, x) => s + x.value, 0);
  const top = overdue[0];
  const monthlyForgone = total * refs.tBillYieldPct / 100 / 12;
  const who = top.a.debtor || top.a.name || 'the debtor';
  const ids = overdue.map(x => x.a.id);

  return makeInsight({
    id: 'receivable-overdue',
    type: 'surprise',
    category: 'receivables',
    headline: overdue.length === 1
      ? `${rwf(top.value)} owed by ${who} is ${top.days} days overdue`
      : `${rwf(total)} in receivables overdue (${overdue.length} items)`,
    body: `${overdue.length === 1 ? `"${top.a.name}"` : `The largest, "${top.a.name}" (${rwf(top.value)}),`} passed its due date ${top.days} days ago. Money owed to you collects no yield, and the longer it ages the harder it gets to recover — a friendly, dated follow-up now beats an awkward one later.`,
    costOfAbsence: {
      severity: top.days >= 180 ? 'critical' : 'warning',
      amount: monthlyForgone,
      costStatement: `Outstanding, ${rwf(total)} forgoes ~${rwf(monthlyForgone)}/month at the ${refs.tBillYieldPct}% reference — and recovery odds fall every month it ages.`,
      action: { label: 'Review receivables', to: 'assets' },
    },
    sourceRefs: ids,
    dataAsOf: inputsAsOf(state, ids, now),
    now,
  });
}
