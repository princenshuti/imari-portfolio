// maturityReinvestment — a fixed-income position is maturing (or already
// matured) with no plan for the proceeds. Money that lands and sits idle
// starts paying the idle-cash cost from day one; naming the date and the
// monthly cost makes the reinvestment decision impossible to forget.

import { REFERENCE } from './refs.js';
import { makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF } from '../../data.js';
import { parseLocalDate } from '../recurrence.js';

import { tx, txLocale } from '../../i18n/tx.js';

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
  const dateStr = next.due.toLocaleDateString(txLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const ids = maturing.map(x => x.a.id);

  return makeInsight({
    id: 'maturity-reinvestment',
    type: 'foresight',
    category: 'fixed-income',
    headline: matured
      ? tx('"{0}" has matured — proceeds need a home', [next.a.name])
      : tx('"{0}" matures in {1} days', [next.a.name, daysUntil]),
    body: matured
      ? tx(
      '{0} matured on {1}. Until it\'s reinvested it earns nothing — decide its next home (roll into a new T-bill/bond, a goal, or debt repayment).',
      [rwf(next.value), dateStr]
    )
      : tx(
      '{0} lands on {1}. Plan the reinvestment now so the proceeds never sit idle{2}.',
      [
        rwf(next.value),
        dateStr,
        maturing.length > 1 ? ` (${maturing.length} positions mature within ${HORIZON_DAYS} days)` : ''
      ]
    ),
    costOfAbsence: {
      severity: matured || daysUntil <= 30 ? 'warning' : 'info',
      amount: idleMonthly,
      costStatement: tx(
        'Idle after maturity, {0} forgoes ~{1}/month at the {2}% reference yield.',
        [rwf(next.value), rwf(idleMonthly), refs.tBillYieldPct]
      ),
      action: { label: tx('Review the position'), to: 'assets' },
    },
    sourceRefs: ids,
    dataAsOf: inputsAsOf(state, ids, now),
    now,
  });
}
