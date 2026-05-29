// projection/index.js — deterministic net-worth projection (B12a).
// Pure: future value of current net worth + a monthly-savings annuity + an
// optional lump sum, compounded monthly. Returns a low/expected/high band per
// horizon. Assumptions are explicit and Modeled-tagged — never a guarantee.

export const HORIZONS = [
  { key: '1M', months: 1, label: '1 month' },
  { key: '1Y', months: 12, label: '1 year' },
  { key: '5Y', months: 60, label: '5 years' },
  { key: '10Y', months: 120, label: '10 years' },
  { key: '20Y', months: 240, label: '20 years' },
];

export const DEFAULT_ASSUMPTIONS = {
  expectedAnnualGrowthPct: 8,   // blended expected nominal return across classes
  bandSpreadPct: 4,             // ± applied to the growth rate for low / high
  inflationPct: 5.1,            // NISR CPI reference — for the real-terms lens
  provenance: 'Modeled',
};

/** Future value: PV compounding + lump sum compounding + monthly annuity. */
export function futureValue(pv, monthlyContribution, lumpSum, annualPct, months) {
  const r = annualPct / 100 / 12;
  const pow = Math.pow(1 + r, months);
  const growthPV = (pv || 0) * pow;
  const growthLump = (lumpSum || 0) * pow;
  const annuity = r === 0
    ? (monthlyContribution || 0) * months
    : (monthlyContribution || 0) * (pow - 1) / r;
  return growthPV + growthLump + annuity;
}

/**
 * @param {object} input
 *   currentNetWorth  RWF
 *   monthlySavings   RWF/month added going forward
 *   lumpSum          one-time addition now (RWF)
 *   assumptions      { expectedAnnualGrowthPct, bandSpreadPct, inflationPct }
 * @returns {{ assumptions, horizons: Array<{key,label,months,low,expected,high,realExpected}> }}
 */
export function projectNetWorth(input = {}) {
  const a = { ...DEFAULT_ASSUMPTIONS, ...(input.assumptions || {}) };
  const pv = input.currentNetWorth || 0;
  const monthly = input.monthlySavings || 0;
  const lump = input.lumpSum || 0;
  const lowRate = a.expectedAnnualGrowthPct - a.bandSpreadPct;
  const highRate = a.expectedAnnualGrowthPct + a.bandSpreadPct;

  const horizons = HORIZONS.map(h => {
    const expected = futureValue(pv, monthly, lump, a.expectedAnnualGrowthPct, h.months);
    const low = futureValue(pv, monthly, lump, lowRate, h.months);
    const high = futureValue(pv, monthly, lump, highRate, h.months);
    // Real (inflation-adjusted) expected, in today's purchasing power.
    const realExpected = expected / Math.pow(1 + a.inflationPct / 100, h.months / 12);
    return { key: h.key, label: h.label, months: h.months, low, expected, high, realExpected };
  });

  return { assumptions: a, horizons };
}

export default projectNetWorth;
