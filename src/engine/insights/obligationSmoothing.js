// obligationSmoothing — a large annual/quarterly obligation (school fees,
// insurance premium, land tax) is approaching and the liquid surplus won't
// cover it. The fix is boring and effective: divide the lump by the months
// remaining and set that aside monthly, starting now.

import { REFERENCE } from './refs.js';
import { liquidIds, liquidValueRWF, safetyBufferRWF, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { toBase } from '../../data.js';
import { nextOccurrence } from '../recurrence.js';

import { tx, txLocale } from '../../i18n/tx.js';

const HORIZON_DAYS = 120;

export default function obligationSmoothing(state, { now = new Date(), refs = REFERENCE } = {}) {
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000);

  const lumps = (state.cashflows || [])
    .filter(cf => cf.type === 'expense' && (cf.recurring === 'annually' || cf.recurring === 'quarterly'))
    .map(cf => ({ cf, amountRWF: toBase(cf.amount || 0, cf.currency || 'RWF'), due: nextOccurrence(cf, now) }))
    .filter(x => x.due && x.due <= horizon && x.amountRWF >= refs.idleCashFloorRWF)
    .sort((a, b) => b.amountRWF - a.amountRWF);
  if (lumps.length === 0) return null;

  const assets = state.assets || [];
  const liquid = liquidValueRWF(assets, now);
  const { monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
  const spare = liquid - safetyBufferRWF(monthlyExpense, refs);

  const hit = lumps.find(x => x.amountRWF > spare);
  if (!hit) return null; // every upcoming lump is already covered

  const daysUntil = Math.max(1, Math.ceil((hit.due - now) / 86400000));
  const monthsUntil = Math.max(1, Math.ceil(daysUntil / 30.44));
  const shortfall = hit.amountRWF - Math.max(0, spare);
  const setAside = shortfall / monthsUntil;
  const label = hit.cf.notes || hit.cf.category || tx('this obligation');
  const dateStr = hit.due.toLocaleDateString(txLocale(), { day: 'numeric', month: 'long' });
  const cashIds = liquidIds(assets);
  const sourceRefs = [hit.cf.id, ...cashIds];

  return makeInsight({
    id: 'obligation-smoothing',
    type: 'foresight',
    category: 'cashflow',
    headline: tx('{0} due {1} — not covered yet', [rwf(hit.amountRWF), dateStr]),
    body: tx(
      '"{0}" ({1}, {2}) lands in ~{3} month{4}, but your liquid surplus beyond the safety buffer is {5}. Setting aside {6}/month from now covers it without touching the buffer or borrowing.',
      [
        label,
        rwf(hit.amountRWF),
        hit.cf.recurring,
        monthsUntil,
        monthsUntil > 1 ? 's' : '',
        rwf(Math.max(0, spare)),
        rwf(setAside)
      ]
    ),
    costOfAbsence: {
      severity: monthsUntil <= 1 ? 'critical' : 'warning',
      amount: shortfall,
      costStatement: tx(
        'Unprepared, {0} of "{1}" lands on your buffer or a loan — smoothed, it\'s just {2}/month.',
        [rwf(shortfall), label, rwf(setAside)]
      ),
      action: { label: tx('See the 30-day forecast'), to: 'cashflow' },
    },
    sourceRefs,
    dataAsOf: inputsAsOf(state, cashIds, now),
    now,
  });
}
