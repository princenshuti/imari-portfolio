// idleCashYieldGap — cash earning below the idle threshold vs the BNR T-bill
// reference. Cost hook = forgone yield per month (a running price tag, §9).

import { REFERENCE } from './refs.js';
import { LIQUID_KINDS, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF } from '../../data.js';

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
    headline: `${rwf(idleValue)} earning almost nothing`,
    body: `${rwf(idleValue)} sits in cash/MoMo below ${refs.idleYieldThresholdPct}% while BNR T-bills reference ~${refs.tBillYieldPct}%.`,
    costOfAbsence: {
      severity: 'warning',
      amount: forgoneMonthly,
      costStatement: `That's ~${rwf(forgoneMonthly)}/month you're not earning — about ${rwf(forgoneMonthly * 12)}/year forgone.`,
      action: { label: 'See idle-cash options', to: 'trends' },
    },
    sourceRefs: ids,
    dataAsOf: inputsAsOf(state, ids, now),
    now,
  });
}
