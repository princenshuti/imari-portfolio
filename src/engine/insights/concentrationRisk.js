// concentrationRisk — any single asset or asset-group above 25% of total assets.
// Denominator is gross asset value (NOT net worth) — the same basis the
// dashboard's allocation chart and concentration alerts use, so the percentage
// reads identically everywhere it appears.

import { REFERENCE } from './refs.js';
import { classOf, makeInsight, inputsAsOf } from './_shared.js';
import { valueRWF } from '../../data.js';

import { tx } from '../../i18n/tx.js';

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
    // Group names come from the asset-class table, so translate the label here:
    // it is interpolated into sentences rather than rendered on its own.
    kind = 'group'; pct = groupPct; label = tx(topGroup.group); refsIds = topGroup.ids;
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
    headline: tx(
      '{0}% of your assets in {1}',
      [pctStr, kind === 'group' ? label : tx('one asset')]
    ),
    body: kind === 'group'
      ? tx(
      'Your {0} holdings are {1}% of total assets — above the 25% concentration guide.',
      [label, pctStr]
    )
      : tx(
      '"{0}" alone is {1}% of total assets — above the 25% concentration guide.',
      [label, pctStr]
    ),
    costOfAbsence: {
      severity,
      amount: pct,
      costStatement: tx(
        'A single shock to {0} would move {1}% of your wealth at once. Diversifying spreads that risk.',
        [kind === 'group' ? label : `"${label}"`, pctStr]
      ),
      action: { label: tx('Review allocation'), to: 'assets' },
    },
    sourceRefs: refsIds,
    dataAsOf: inputsAsOf(state, refsIds, now),
    now,
  });
}
