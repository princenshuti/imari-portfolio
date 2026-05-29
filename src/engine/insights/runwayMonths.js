// runwayMonths — months of expenses covered by liquid assets.
// Cost hook when runway < 3 months (warning) or < 1 month (critical).

import { REFERENCE } from './refs.js';
import { LIQUID_KINDS, liquidValueRWF, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';

export default function runwayMonths(state, { now = new Date(), refs = REFERENCE } = {}) {
  const assets = state.assets || [];
  const { monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
  if (!(monthlyExpense > 0)) return null; // no expense data → can't compute honestly

  const liquid = liquidValueRWF(assets, now);
  const months = liquid / monthlyExpense;
  if (months >= refs.runwayWarnMonths) return null; // healthy — no cost

  const liquidIds = assets.filter(a => LIQUID_KINDS.has(a.kind)).map(a => a.id);
  const severity = months < refs.runwayCriticalMonths ? 'critical' : 'warning';
  const monthsStr = months.toFixed(1);

  return makeInsight({
    id: 'runway-months',
    type: 'foresight',
    category: 'liquidity',
    headline: `${monthsStr} months of runway`,
    body: `Your liquid assets (${rwf(liquid)}) cover about ${monthsStr} months at your current spend of ${rwf(monthlyExpense)}/month.`,
    costOfAbsence: {
      severity,
      amount: monthlyExpense,
      costStatement: `If income stopped today, ${rwf(liquid)} lasts ~${monthsStr} months — below the 3-month safety floor.`,
      action: { label: 'Review cash & savings', to: 'accounts' },
    },
    sourceRefs: liquidIds,
    dataAsOf: inputsAsOf(state, liquidIds, now),
    now,
  });
}
