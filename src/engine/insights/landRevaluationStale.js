// landRevaluationStale — real estate drifts with the market; a UPI-anchored
// parcel that hasn't been revalued in a while quietly distorts net worth and
// the Fixed Asset Tax base (§7). Fires on the stalest property.

import { makeInsight } from './_shared.js';
import { TREND_DOMAINS } from '../../data.js';

const STALE_MONTHS = 12;

export default function landRevaluationStale(state, { now = new Date() } = {}) {
  const props = (state.assets || []).filter(
    a => (a.kind === 'realestate-land' || a.kind === 'realestate-house') && a.lastRevaluedAt);
  if (props.length === 0) return null;

  let worst = null;
  for (const a of props) {
    const months = (now - new Date(a.lastRevaluedAt)) / (30.44 * 86400000);
    if (months > STALE_MONTHS && (!worst || months > worst.months)) worst = { a, months };
  }
  if (!worst) return null;

  const idx = TREND_DOMAINS.find(d => d.id === 'kigali-re');
  const monthsStr = Math.round(worst.months);
  return makeInsight({
    id: 'land-revaluation-stale',
    type: 'foresight',
    category: 'allocation',
    headline: `"${worst.a.name}" not revalued in ${monthsStr} months`,
    body: `"${worst.a.name}" was last revalued ${monthsStr} months ago; its on-screen value may have drifted from the market.${idx ? ` The ${idx.label} (Modeled) has moved since.` : ''}`,
    costOfAbsence: {
      severity: 'info',
      amount: worst.months,
      costStatement: `A stale land value distorts your net worth and Fixed Asset Tax base — update "${worst.a.name}" to make it real.`,
      action: { label: 'Update valuation', to: 'assets' },
    },
    sourceRefs: [worst.a.id],
    dataAsOf: worst.a.lastRevaluedAt,
    now,
  });
}
