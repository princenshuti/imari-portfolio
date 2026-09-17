// landRevaluationStale — real estate drifts with the market; a UPI-anchored
// parcel that hasn't been revalued in a while quietly distorts net worth and
// the Fixed Asset Tax base (§7). Fires on the stalest property.

import { makeInsight } from './_shared.js';
import { TREND_DOMAINS } from '../../data.js';

import { tx } from '../../i18n/tx.js';

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
    headline: tx('"{0}" not revalued in {1} months', [worst.a.name, monthsStr]),
    body: tx(
      '"{0}" was last revalued {1} months ago; its on-screen value may have drifted from the market.{2}',
      [
        worst.a.name,
        monthsStr,
        idx ? ` The ${idx.label} (Modeled) has moved since.` : ''
      ]
    ),
    costOfAbsence: {
      severity: 'info',
      amount: worst.months,
      costStatement: tx(
        'A stale land value distorts your net worth and Fixed Asset Tax base — update "{0}" to make it real.',
        [worst.a.name]
      ),
      action: { label: tx('Update valuation'), to: 'assets' },
    },
    sourceRefs: [worst.a.id],
    dataAsOf: worst.a.lastRevaluedAt,
    now,
  });
}
