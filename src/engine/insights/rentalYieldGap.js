// rentalYieldGap — rental income measured against the value of the rental
// property. When the gross yield runs far below the risk-free reference, the
// equity tied up in the property is underworking: the honest prompt is to
// review the rent level (or the property's role), not "sell your house".

import { REFERENCE } from './refs.js';
import { makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF, toBase } from '../../data.js';
import { monthlyEquivalent } from '../recurrence.js';

import { tx } from '../../i18n/tx.js';

export default function rentalYieldGap(state, { now = new Date(), refs = REFERENCE } = {}) {
  const houses = (state.assets || []).filter(a => a.kind === 'realestate-house');
  if (houses.length === 0) return null;
  const houseValue = houses.reduce((s, a) => s + valueRWF(a, now), 0);
  if (!(houseValue > 0)) return null;

  const rentals = (state.cashflows || []).filter(cf =>
    cf.type === 'income' && cf.category === 'rental' && cf.recurring && cf.recurring !== 'once');
  if (rentals.length === 0) return null; // owner-occupied or unrecorded — can't judge

  const monthlyRent = rentals.reduce((s, cf) =>
    s + monthlyEquivalent(toBase(cf.amount || 0, cf.currency || 'RWF'), cf.recurring), 0);
  if (!(monthlyRent > 0)) return null;

  const grossYieldPct = (monthlyRent * 12 / houseValue) * 100;
  const threshold = refs.tBillYieldPct / 2; // below half the risk-free rate → worth a look
  if (grossYieldPct >= threshold) return null;

  const gapAnnual = houseValue * (refs.tBillYieldPct - grossYieldPct) / 100;
  const ids = [...houses.map(a => a.id), ...rentals.map(cf => cf.id)];

  return makeInsight({
    id: 'rental-yield-gap',
    type: 'comparison',
    category: 'property',
    headline: tx(
      'Rental yield {0}% vs {1}% risk-free',
      [grossYieldPct.toFixed(1), refs.tBillYieldPct]
    ),
    body: tx(
      'Rent of {0}/month on property valued at {1} is a {2}% gross yield — under half the {3}% T-bill reference. Property values here are your own estimates, so first check the valuation is current; then review whether the rent has kept up with the market.',
      [
        rwf(monthlyRent),
        rwf(houseValue),
        grossYieldPct.toFixed(1),
        refs.tBillYieldPct
      ]
    ),
    costOfAbsence: {
      severity: 'info',
      amount: gapAnnual,
      costStatement: tx(
        'The gap to the risk-free rate is ~{0}/year of underworked equity — a rent review costs nothing to ask for.',
        [rwf(gapAnnual)]
      ),
      action: { label: tx('Review the property'), to: 'assets' },
    },
    sourceRefs: ids,
    dataAsOf: inputsAsOf(state, houses.map(a => a.id), now),
    now,
  });
}
