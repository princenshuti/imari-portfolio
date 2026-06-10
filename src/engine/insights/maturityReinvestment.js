// maturityReinvestment — a fixed-income position is maturing (or already
// matured) with no plan for the proceeds. Money that lands and sits idle
// starts paying the idle-cash cost from day one; naming the date and the
// monthly cost makes the reinvestment decision impossible to forget.

import { REFERENCE } from './refs.js';
import { makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF } from '../../data.js';
import { parseLocalDate } from '../recurrence.js';

const HORIZON_DAYS = 60; // look-ahead window

export default function maturityReinvestment(state, { now = new Date(), refs = REFERENCE } = {}) {
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000);

  const maturing = (state.assets || [])
    .filter(a => a.maturity)
    .map(a => ({ a, due: parseLocalDate(a.maturity), value: valueRWF(a, now) }))
    .filter(x => !Number.isNaN(x.due.getTime()) && x.value > 0 && x.due <= horizon)
    .sort((x, y) => x.due - y.due);
  if (maturing.length === 0) return null;

  const next = maturing[0];
  const daysUntil = Math.ceil((next.due - now) / 86400000);
  const matured = daysUntil <= 0;
  const idleMonthly = next.value * refs.tBillYieldPct / 100 / 12;
  const dateStr = next.due.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const ids = maturing.map(x => x.a.id);

  return makeInsight({
    id: 'maturity-reinvestment',
    type: 'foresight',
    category: 'fixed-income',
    headline: matured
      ? `"${next.a.name}" has matured — proceeds need a home`
      : `"${next.a.name}" matures in ${daysUntil} days`,
    body: matured
      ? `${rwf(next.value)} matured on ${dateStr}. Until it's reinvested it earns nothing — decide its next home (roll into a new T-bill/bond, a goal, or debt repayment).`
      : `${rwf(next.value)} lands on ${dateStr}. Plan the reinvestment now so the proceeds never sit idle${maturing.length > 1 ? ` (${maturing.length} positions mature within ${HORIZON_DAYS} days)` : ''}.`,
    costOfAbsence: {
      severity: matured || daysUntil <= 30 ? 'warning' : 'info',
      amount: idleMonthly,
      costStatement: `Idle after maturity, ${rwf(next.value)} forgoes ~${rwf(idleMonthly)}/month at the ${refs.tBillYieldPct}% reference yield.`,
      action: { label: 'Review the position', to: 'assets' },
    },
    sourceRefs: ids,
    dataAsOf: inputsAsOf(state, ids, now),
    now,
  });
}
