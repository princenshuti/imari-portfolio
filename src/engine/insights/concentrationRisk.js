// concentrationRisk — any single asset or asset-group above 25% of net worth.
// Reuses the existing dashboard alert threshold.

import { REFERENCE } from './refs.js';
import { classOf, makeInsight, inputsAsOf } from './_shared.js';
import { valueRWF } from '../../data.js';

export default function concentrationRisk(state, { now = new Date(), refs = REFERENCE } = {}) {
  const assets = state.assets || [];
  const total = assets.reduce((s, a) => s + valueRWF(a, now), 0);
  if (total <= 0) return null;

  // Largest single asset.
  let topAsset = null;
  const byGroup = {};
  for (const a of assets) {
    const v = valueRWF(a, now);
    if (!topAsset || v > topAsset.v) topAsset = { a, v };
    const g = classOf(a).group;
    (byGroup[g] = byGroup[g] || { value: 0, ids: [] });
    byGroup[g].value += v;
    byGroup[g].ids.push(a.id);
  }

  // Largest group.
  let topGroup = null;
  for (const [group, info] of Object.entries(byGroup)) {
    if (!topGroup || info.value > topGroup.value) topGroup = { group, ...info };
  }

  const assetPct = (topAsset.v / total) * 100;
  const groupPct = (topGroup.value / total) * 100;

  // Prefer whichever concentration is larger; require strictly > threshold.
  let kind, pct, label, refsIds;
  if (groupPct >= assetPct) {
    kind = 'group'; pct = groupPct; label = topGroup.group; refsIds = topGroup.ids;
  } else {
    kind = 'asset'; pct = assetPct; label = topAsset.a.name; refsIds = [topAsset.a.id];
  }
  if (pct <= refs.concentrationPct) return null;

  const severity = pct > 40 ? 'critical' : 'warning';
  const pctStr = pct.toFixed(0);
  return makeInsight({
    id: 'concentration-risk',
    type: 'surprise',
    category: 'allocation',
    headline: `${pctStr}% of wealth in ${kind === 'group' ? label : 'one asset'}`,
    body: kind === 'group'
      ? `Your ${label} holdings are ${pctStr}% of net worth — above the 25% concentration guide.`
      : `"${label}" alone is ${pctStr}% of net worth — above the 25% concentration guide.`,
    costOfAbsence: {
      severity,
      amount: pct,
      costStatement: `A single shock to ${kind === 'group' ? label : `"${label}"`} would move ${pctStr}% of your wealth at once. Diversifying spreads that risk.`,
      action: { label: 'Review allocation', to: 'assets' },
    },
    sourceRefs: refsIds,
    dataAsOf: inputsAsOf(state, refsIds, now),
    now,
  });
}
