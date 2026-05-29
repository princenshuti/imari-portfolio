// retirement/index.js — RSSB / Ejo Heza pension projection (§5). Pure + tested.
// The statutory contribution-rate schedule is CONFIG (not hard-coded into the
// math) because Rwanda is ramping 6% → 12% (2025) → 20% (by 2030); editing the
// table re-prices every projection without touching code.

export const RSSB_RATE_SCHEDULE = [
  { fromYear: 2000, totalRatePct: 6 },   // legacy baseline
  { fromYear: 2025, totalRatePct: 12 },  // 2025 step
  { fromYear: 2030, totalRatePct: 20 },  // toward 20% by 2030
];

export const RETIREMENT_CONFIG = {
  retirementAges: [60, 65],
  defaultRealReturnPct: 4,    // pension fund real (above-inflation) growth
  yearsInRetirement: 20,      // drawdown horizon for the pension annuity
  replacementTargetPct: 60,   // a "comfortable" income-replacement ratio
  asOf: 'RSSB statutory schedule · 2025',
};

/** Statutory total contribution rate (%) in effect for a given year. */
export function statutoryRate(year) {
  let rate = RSSB_RATE_SCHEDULE[0].totalRatePct;
  for (const step of RSSB_RATE_SCHEDULE) if (year >= step.fromYear) rate = step.totalRatePct;
  return rate;
}

export function readinessScore(replacementRatioPct, target = RETIREMENT_CONFIG.replacementTargetPct) {
  if (replacementRatioPct == null || target <= 0) return null;
  // Floor (never round up) so the score never overstates how ready you are.
  return Math.max(0, Math.min(100, Math.floor((replacementRatioPct / target) * 100)));
}

/**
 * @param {object} input
 *   currentAge, retirementAge (default 60)
 *   contributionsToDate (RWF), monthlyContribution (RWF), employerMatch (RWF)
 *   annualSalary (RWF), realReturnPct, yearsInRetirement
 * @returns {{ years, projectedPot, annualPension, monthlyPension, replacementRatio, readiness } | null}
 */
export function projectPension(input = {}) {
  const cfg = RETIREMENT_CONFIG;
  const currentAge = input.currentAge;
  if (currentAge == null) return null;
  const retirementAge = input.retirementAge ?? cfg.retirementAges[0];
  const years = Math.max(0, retirementAge - currentAge);
  const months = years * 12;
  const r = (input.realReturnPct ?? cfg.defaultRealReturnPct) / 100 / 12;
  const monthly = (input.monthlyContribution || 0) + (input.employerMatch || 0);
  const pow = Math.pow(1 + r, months);
  const pot = (input.contributionsToDate || 0) * pow + (r === 0 ? monthly * months : monthly * (pow - 1) / r);
  const yearsRet = input.yearsInRetirement ?? cfg.yearsInRetirement;
  const annualPension = yearsRet > 0 ? pot / yearsRet : 0;
  const monthlyPension = annualPension / 12;
  const replacementRatio = input.annualSalary > 0 ? (annualPension / input.annualSalary) * 100 : null;
  return {
    years, projectedPot: pot, annualPension, monthlyPension,
    replacementRatio,
    readiness: readinessScore(replacementRatio),
  };
}

export default projectPension;
