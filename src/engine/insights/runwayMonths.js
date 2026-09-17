// runwayMonths — months of expenses covered by liquid assets.
// Cost hook when runway < 3 months (warning) or < 1 month (critical).

import { REFERENCE } from './refs.js';
import { liquidIds as liquidIdsOf, liquidValueRWF, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';

import { tx } from '../../i18n/tx.js';

export default function runwayMonths(state, { now = new Date(), refs = REFERENCE } = {}) {
  const assets = state.assets || [];
  const { monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
  if (!(monthlyExpense > 0)) return null; // no expense data → can't compute honestly

  const liquid = liquidValueRWF(assets, now);
  const months = liquid / monthlyExpense;
  if (months >= refs.runwayWarnMonths) return null; // healthy — no cost

  const liquidIds = liquidIdsOf(assets);
  const severity = months < refs.runwayCriticalMonths ? 'critical' : 'warning';
  const monthsStr = months.toFixed(1);

  return makeInsight({
    id: 'runway-months',
    type: 'foresight',
    category: 'liquidity',
    headline: tx('{0} months of runway', [monthsStr]),
    body: tx(
      'Your liquid assets ({0}) cover about {1} months at your current spend of {2}/month.',
      [rwf(liquid), monthsStr, rwf(monthlyExpense)]
    ),
    costOfAbsence: {
      severity,
      amount: monthlyExpense,
      costStatement: tx(
        'If income stopped today, {0} lasts ~{1} months — below the 3-month safety floor.',
        [rwf(liquid), monthsStr]
      ),
      action: { label: tx('Review cash & savings'), to: 'accounts' },
    },
    sourceRefs: liquidIds,
    dataAsOf: inputsAsOf(state, liquidIds, now),
    now,
  });
}
