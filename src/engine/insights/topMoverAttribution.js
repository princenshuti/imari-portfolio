// topMoverAttribution — which single holding drove most of the portfolio's
// gain or loss (by RWF, vs cost basis). Positive movers are informational;
// a dominant loss carries a Cost-of-Absence hook.

import { makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF, costRWF } from '../../data.js';

import { tx } from '../../i18n/tx.js';

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
      ? tx('"{0}" is your biggest gainer', [a.name])
      : tx('"{0}" is your biggest drag', [a.name]),
    body: tx(
      '"{0}" has moved {1}{2} ({3}{4}%) vs cost — the largest single contributor to your net worth change.',
      [a.name, up ? '+' : '', rwf(gain), pct >= 0 ? '+' : '', pct.toFixed(1)]
    ),
    sourceRefs: [a.id],
    dataAsOf: inputsAsOf(state, [a.id], now),
    now,
  };

  // Only a material loss earns a cost hook; gains stay informational.
  if (!up && Math.abs(gain) >= 100_000) {
    insight.costOfAbsence = {
      severity: 'info',
      amount: Math.abs(gain),
      costStatement: tx(
        'This one position is pulling your net worth down by {0}. Worth deciding: hold, average down, or exit.',
        [rwf(Math.abs(gain))]
      ),
      action: { label: tx('Open in Assets'), to: 'assets' },
    };
  }

  return makeInsight(insight);
}
