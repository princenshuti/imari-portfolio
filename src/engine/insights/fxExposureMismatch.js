// fxExposureMismatch — debt in a foreign currency while income arrives in RWF.
// A depreciation makes the debt more expensive in the money the user actually
// earns. The scenario figure is clearly labelled modeled (a flat 5% move), not
// a forecast — the point is the direction and order of magnitude of the risk.

import { REFERENCE } from './refs.js';
import { grossValueRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { toBase } from '../../data.js';
import { monthlyEquivalent } from '../recurrence.js';

const SCENARIO_DEPRECIATION_PCT = 5;
const MATERIALITY_RWF = 1_000_000;
const RWF_INCOME_SHARE_MIN = 0.7;

export default function fxExposureMismatch(state, { now = new Date(), refs = REFERENCE } = {}) {
  const fxDebts = (state.liabilities || [])
    .filter(l => (l.currency || 'RWF') !== 'RWF' && (l.remainingAmount || 0) > 0)
    .map(l => ({ l, valueRWF: toBase(l.remainingAmount, l.currency) }));
  if (fxDebts.length === 0) return null;

  const fxDebtRWF = fxDebts.reduce((s, x) => s + x.valueRWF, 0);
  if (fxDebtRWF < MATERIALITY_RWF) return null;

  // Income currency mix — recurring income entries, at monthly equivalent.
  const incomes = (state.cashflows || []).filter(cf =>
    cf.type === 'income' && cf.recurring && cf.recurring !== 'once');
  if (incomes.length === 0) return null; // no income data → can't claim a mismatch honestly
  let rwfIncome = 0, totalIncome = 0;
  for (const cf of incomes) {
    const m = monthlyEquivalent(toBase(cf.amount || 0, cf.currency || 'RWF'), cf.recurring);
    totalIncome += m;
    if ((cf.currency || 'RWF') === 'RWF') rwfIncome += m;
  }
  if (!(totalIncome > 0) || rwfIncome / totalIncome < RWF_INCOME_SHARE_MIN) return null;

  const scenarioCost = fxDebtRWF * SCENARIO_DEPRECIATION_PCT / 100;
  const grossAssets = grossValueRWF(state.assets || [], now);
  const sharePct = grossAssets > 0 ? (fxDebtRWF / grossAssets) * 100 : 0;
  const ccyList = [...new Set(fxDebts.map(x => x.l.currency))].join(', ');
  const debtIds = fxDebts.map(x => x.l.id);
  const incomeIds = incomes.filter(cf => (cf.currency || 'RWF') === 'RWF').map(cf => cf.id);

  return makeInsight({
    id: 'fx-debt-exposure',
    type: 'surprise',
    category: 'debt',
    headline: `${rwf(fxDebtRWF)} of debt in ${ccyList}, income in RWF`,
    body: `You owe ${rwf(fxDebtRWF)} in ${ccyList} while ${Math.round((rwfIncome / totalIncome) * 100)}% of your recorded income is RWF. If the franc weakens, the debt grows in the money you earn — a ${SCENARIO_DEPRECIATION_PCT}% depreciation (modeled scenario, not a forecast) adds ~${rwf(scenarioCost)} to what you owe.`,
    costOfAbsence: {
      severity: sharePct > 10 ? 'warning' : 'info',
      amount: scenarioCost,
      costStatement: `A ${SCENARIO_DEPRECIATION_PCT}% RWF slide makes this debt ~${rwf(scenarioCost)} heavier in RWF terms. Consider prioritising its repayment or matching it with ${ccyList} income/assets.`,
      action: { label: 'Review liabilities', to: 'liabilities' },
    },
    sourceRefs: [...debtIds, ...incomeIds],
    dataAsOf: inputsAsOf(state, [], now),
    now,
  });
}
