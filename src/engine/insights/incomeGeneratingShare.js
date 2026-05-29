// incomeGeneratingShare — share of wealth that actually earns income vs idle.
// Low share = wealth working less hard than it could (a quiet, ongoing cost).

import { REFERENCE } from './refs.js';
import { isIncomeGenerating, makeInsight, inputsAsOf } from './_shared.js';
import { valueRWF } from '../../data.js';

export default function incomeGeneratingShare(state, { now = new Date(), refs = REFERENCE } = {}) {
  const assets = state.assets || [];
  const total = assets.reduce((s, a) => s + valueRWF(a, now), 0);
  if (total <= 0) return null;

  let incomeValue = 0;
  const idleIds = [];
  for (const a of assets) {
    const v = valueRWF(a, now);
    if (isIncomeGenerating(a)) incomeValue += v;
    else idleIds.push(a.id);
  }
  const sharePct = (incomeValue / total) * 100;
  if (sharePct >= refs.incomeShareInfoPct) return null; // healthy enough — no nag

  const idleValue = total - incomeValue;
  const severity = sharePct < refs.incomeShareWarnPct ? 'warning' : 'info';
  const shareStr = sharePct.toFixed(0);

  // Anchor refs to the largest idle holdings (most leverage to fix).
  const topIdle = assets
    .filter(a => idleIds.includes(a.id))
    .map(a => ({ id: a.id, v: valueRWF(a, now) }))
    .sort((x, y) => y.v - x.v)
    .slice(0, 3)
    .map(x => x.id);

  return makeInsight({
    id: 'income-generating-share',
    type: 'comparison',
    category: 'allocation',
    headline: `Only ${shareStr}% of wealth earns income`,
    body: `${shareStr}% of your assets generate income; the rest is idle or purely appreciating.`,
    costOfAbsence: {
      severity,
      amount: idleValue,
      costStatement: `About that much of your wealth isn't producing cash flow — idle capital is opportunity cost you can't see on a balance sheet.`,
      action: { label: 'Review assets', to: 'assets' },
    },
    sourceRefs: topIdle.length ? topIdle : idleIds.slice(0, 1),
    dataAsOf: inputsAsOf(state, topIdle, now),
    now,
  });
}
