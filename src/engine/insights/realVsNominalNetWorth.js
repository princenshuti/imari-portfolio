// realVsNominalNetWorth — nominal RWF net-worth change vs the same change in
// real (inflation-adjusted) terms, using the NISR CPI reference. Surfaces the
// drift the user can't see: "flat in RWF, down in real terms".

import { REFERENCE } from './refs.js';
import { makeInsight } from './_shared.js';
import { valueRWF } from '../../data.js';

import { tx } from '../../i18n/tx.js';

export default function realVsNominalNetWorth(state, { now = new Date(), refs = REFERENCE } = {}) {
  const snaps = (state.snapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (snaps.length < 2) return null;
  if (!(refs.cpiYoYPct > 0)) return null; // no inflation reference → no real drift to report

  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  if (!first.netWorth) return null;

  const days = (new Date(last.date) - new Date(first.date)) / 86400000;
  if (days < 25) return null; // need a meaningful window
  const years = days / 365.25;

  const nominalPct = ((last.netWorth - first.netWorth) / first.netWorth) * 100;
  // Real return ≈ (1 + nominal) / (1 + inflation_over_period) − 1
  const inflationOverPeriod = (refs.cpiYoYPct / 100) * years;
  const realPct = ((1 + nominalPct / 100) / (1 + inflationOverPeriod) - 1) * 100;
  const erodedPct = nominalPct - realPct;
  if (erodedPct < 0.5) return null; // negligible

  // Net-worth-wide insight → anchor to the top contributing assets so it has
  // real source refs and survives the stale-ref guard.
  const assets = state.assets || [];
  const topIds = assets
    .map(a => ({ id: a.id, v: valueRWF(a, now) }))
    .sort((x, y) => y.v - x.v)
    .slice(0, 3)
    .map(x => x.id);

  const losingGround = realPct < 0;
  const severity = losingGround ? 'warning' : 'info';
  const monthsLabel = days >= 330 ? 'over the past year' : `over the past ${Math.round(days / 30)} months`;

  return makeInsight({
    id: 'real-vs-nominal',
    type: 'comparison',
    category: 'networth',
    headline: losingGround
      ? tx(
      'Up {0}% in RWF, {1}% in real terms',
      [nominalPct.toFixed(1), realPct.toFixed(1)]
    )
      : tx('{0}% of your growth was inflation', [erodedPct.toFixed(1)]),
    body: tx(
      'Net worth moved {0}{1}% in RWF {2}, but after {3}% inflation that\'s {4}{5}% in real purchasing power.',
      [
        nominalPct >= 0 ? '+' : '',
        nominalPct.toFixed(1),
        monthsLabel,
        refs.cpiYoYPct,
        realPct >= 0 ? '+' : '',
        realPct.toFixed(1)
      ]
    ),
    costOfAbsence: {
      severity,
      amount: erodedPct,
      costStatement: losingGround
        ? tx(
        'In real terms your wealth is shrinking — inflation outran your {0}% nominal gain.',
        [nominalPct.toFixed(1)]
      )
        : tx(
        'Inflation quietly ate {0} points of your gain. Real growth, not the RWF number, is what compounds.',
        [erodedPct.toFixed(1)]
      ),
      action: { label: tx('See real vs nominal'), to: 'trends' },
    },
    sourceRefs: topIds,
    dataAsOf: first.date, // oldest input = earliest snapshot in the window
    now,
  });
}
