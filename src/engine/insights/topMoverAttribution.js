// topMoverAttribution — which single holding drove most of the portfolio's
// gain or loss (by RWF, vs cost basis). Positive movers are informational;
// a dominant loss carries a Cost-of-Absence hook.

import { makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF, costRWF } from '../../data.js';

export default function topMoverAttribution(state, { now = new Date() } = {}) {
  const assets = state.assets || [];
  if (assets.length === 0) return null;

  let top = null;
  for (const a of assets) {
    const gain = valueRWF(a, now) - costRWF(a);
    if (!top || Math.abs(gain) > Math.abs(top.gain)) top = { a, gain };
  }
  if (!top || Math.abs(top.gain) < 1) return null; // nothing meaningfully moved

  const { a, gain } = top;
  const up = gain >= 0;
  const pct = costRWF(a) > 0 ? (gain / costRWF(a)) * 100 : 0;

  const insight = {
    id: 'top-mover-attribution',
    type: up ? 'surprise' : 'comparison',
    category: 'networth',
    headline: up
      ? `"${a.name}" is your biggest gainer`
      : `"${a.name}" is your biggest drag`,
    body: `"${a.name}" has moved ${up ? '+' : ''}${rwf(gain)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%) vs cost — the largest single contributor to your net worth change.`,
    sourceRefs: [a.id],
    dataAsOf: inputsAsOf(state, [a.id], now),
    now,
  };

  // Only a material loss earns a cost hook; gains stay informational.
  if (!up && Math.abs(gain) >= 100_000) {
    insight.costOfAbsence = {
      severity: 'info',
      amount: Math.abs(gain),
      costStatement: `This one position is pulling your net worth down by ${rwf(Math.abs(gain))}. Worth deciding: hold, average down, or exit.`,
      action: { label: 'Open in Assets', to: 'assets' },
    };
  }

  return makeInsight(insight);
}
