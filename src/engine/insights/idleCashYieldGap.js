// idleCashYieldGap — cash earning below the idle threshold vs the BNR T-bill
// reference. Cost hook = forgone yield per month (a running price tag, §9).

import { REFERENCE } from './refs.js';
import { LIQUID_KINDS, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF } from '../../data.js';

import { tx } from '../../i18n/tx.js';

export default function idleCashYieldGap(state, { now = new Date(), refs = REFERENCE } = {}) {
  const assets = state.assets || [];
  const idle = assets.filter(a => {
    if (!LIQUID_KINDS.has(a.kind)) return false;
    const y = a.kind === 'momo-cash' ? 0 : (a.yieldPct || 0);
    return y < refs.idleYieldThresholdPct;
  });
  if (idle.length === 0) return null;

  const idleValue = idle.reduce((s, a) => s + valueRWF(a, now), 0);
  if (idleValue < refs.idleCashFloorRWF) return null; // too small to matter

  // Forgone yield = idle balance × (T-bill rate − what it earns now), per asset.
  const forgoneMonthly = idle.reduce((s, a) => {
    const y = a.kind === 'momo-cash' ? 0 : (a.yieldPct || 0);
    const gap = Math.max(0, refs.tBillYieldPct - y) / 100;
    return s + valueRWF(a, now) * gap / 12;
  }, 0);
  if (!(forgoneMonthly > 0)) return null;

  const ids = idle.map(a => a.id);
  return makeInsight({
    id: 'idle-cash-yield-gap',
    type: 'comparison',
    category: 'liquidity',
    headline: tx('{0} earning almost nothing', [rwf(idleValue)]),
    body: tx(
      '{0} sits in cash/MoMo below {1}% while BNR T-bills reference ~{2}%.',
      [rwf(idleValue), refs.idleYieldThresholdPct, refs.tBillYieldPct]
    ),
    costOfAbsence: {
      severity: 'warning',
      amount: forgoneMonthly,
      costStatement: tx(
        'That\'s ~{0}/month you\'re not earning — about {1}/year forgone.',
        [rwf(forgoneMonthly), rwf(forgoneMonthly * 12)]
      ),
      action: { label: tx('See idle-cash options'), to: 'trends' },
    },
    sourceRefs: ids,
    dataAsOf: inputsAsOf(state, ids, now),
    now,
  });
}
