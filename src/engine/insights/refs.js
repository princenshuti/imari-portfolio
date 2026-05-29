// refs.js — deterministic reference rates the Insight Engine reasons against.
// Sourced from the provenance-tagged TREND_DOMAINS so a single edit there keeps
// the engine in sync. These are Reference values (no live API), surfaced with an
// `asOf` so every insight that uses them can show its provenance (§11).

import { TREND_DOMAINS } from '../../data.js';

const cpi = TREND_DOMAINS.find(d => d.id === 'cpi');

export const REFERENCE = {
  // BNR Treasury-bill primary-auction yield — the benchmark idle cash is measured against.
  tBillYieldPct: 10,
  tBillAsOf: 'BNR T-bill primary auction · reference',

  // National CPI (YoY) used for real-vs-nominal net-worth math.
  cpiYoYPct: cpi?.value ?? 5.1,
  cpiAsOf: cpi?.asOf ?? 'NISR · reference',

  // A liquid balance earning less than this is treated as "idle".
  idleYieldThresholdPct: 2,

  // A single asset / group above this share of net worth is a concentration risk.
  concentrationPct: 25,

  // Runway shorter than this (months of expenses in liquid assets) is a cost.
  runwayWarnMonths: 3,
  runwayCriticalMonths: 1,

  // Below this share of income-generating assets, idle wealth is flagged.
  incomeShareWarnPct: 25,
  incomeShareInfoPct: 40,

  // Minimum idle balance (RWF) before the idle-cash insight fires — noise guard.
  idleCashFloorRWF: 500_000,
};
