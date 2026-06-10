// obligationSmoothing — a large annual/quarterly obligation (school fees,
// insurance premium, land tax) is approaching and the liquid surplus won't
// cover it. The fix is boring and effective: divide the lump by the months
// remaining and set that aside monthly, starting now.

import { REFERENCE } from './refs.js';
import { liquidIds, liquidValueRWF, safetyBufferRWF, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { toBase } from '../../data.js';
import { nextOccurrence } from '../recurrence.js';

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
  const label = hit.cf.notes || hit.cf.category || 'this obligation';
  const dateStr = hit.due.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const cashIds = liquidIds(assets);
  const sourceRefs = [hit.cf.id, ...cashIds];

  return makeInsight({
    id: 'obligation-smoothing',
    type: 'foresight',
    category: 'cashflow',
    headline: `${rwf(hit.amountRWF)} due ${dateStr} — not covered yet`,
    body: `"${label}" (${rwf(hit.amountRWF)}, ${hit.cf.recurring}) lands in ~${monthsUntil} month${monthsUntil > 1 ? 's' : ''}, but your liquid surplus beyond the safety buffer is ${rwf(Math.max(0, spare))}. Setting aside ${rwf(setAside)}/month from now covers it without touching the buffer or borrowing.`,
    costOfAbsence: {
      severity: monthsUntil <= 1 ? 'critical' : 'warning',
      amount: shortfall,
      costStatement: `Unprepared, ${rwf(shortfall)} of "${label}" lands on your buffer or a loan — smoothed, it's just ${rwf(setAside)}/month.`,
      action: { label: 'See the 30-day forecast', to: 'cashflow' },
    },
    sourceRefs,
    dataAsOf: inputsAsOf(state, cashIds, now),
    now,
  });
}
