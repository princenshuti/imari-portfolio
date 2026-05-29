// index.js — the Insight Engine entry point.
// Runs every rule, drops insights whose sources no longer exist (stale-ref
// guard), filters dismissed ones, ranks by Cost-of-Absence severity, and
// returns the top N plus the single highest-severity cost to pin (§1).
//
// Pure and deterministic given (state, ctx). The AI layer narrates this output
// rather than free-associating (§2 step 4).

import { SEVERITY_RANK } from './_shared.js';
import { REFERENCE } from './refs.js';

import runwayMonths from './runwayMonths.js';
import idleCashYieldGap from './idleCashYieldGap.js';
import realVsNominalNetWorth from './realVsNominalNetWorth.js';
import concentrationRisk from './concentrationRisk.js';
import taxDeadlineExposure from './taxDeadlineExposure.js';
import goalPaceGap from './goalPaceGap.js';
import incomeGeneratingShare from './incomeGeneratingShare.js';
import topMoverAttribution from './topMoverAttribution.js';
import landRevaluationStale from './landRevaluationStale.js';

// Registration order = stable tiebreak for equal-severity, equal-magnitude items.
export const RULES = [
  runwayMonths,
  idleCashYieldGap,
  taxDeadlineExposure,
  concentrationRisk,
  goalPaceGap,
  realVsNominalNetWorth,
  incomeGeneratingShare,
  landRevaluationStale,
  topMoverAttribution,
];

/** Set of every entity id the engine may legitimately reference. */
function validIdSet(state) {
  const ids = new Set();
  for (const a of state.assets || []) ids.add(a.id);
  for (const l of state.liabilities || []) ids.add(l.id);
  for (const c of state.cashflows || []) ids.add(c.id);
  for (const g of state.goals || []) ids.add(g.id);
  return ids;
}

function severityRank(insight) {
  return insight.costOfAbsence ? SEVERITY_RANK[insight.costOfAbsence.severity] || 0 : 0;
}

/**
 * @param {object} state  portfolio state
 * @param {object} ctx    { now?: Date, refs?, dismissed?: Set<string>, limit?: number }
 * @returns {{ insights: Insight[], topCost: Insight|null }}
 */
export function runInsights(state, ctx = {}) {
  const now = ctx.now || new Date();
  const refs = ctx.refs || REFERENCE;
  const dismissed = ctx.dismissed instanceof Set ? ctx.dismissed : new Set(ctx.dismissed || []);
  const limit = ctx.limit ?? 6;
  const valid = validIdSet(state);

  const out = [];
  for (const rule of RULES) {
    let insight = null;
    try {
      insight = rule(state, { now, refs });
    } catch {
      insight = null; // a single bad rule must never break the engine (NFR-REL-1)
    }
    if (!insight) continue;

    // Stale-ref guard: keep only refs that still resolve; drop the insight if
    // none survive (an insight with no real numeric source must not render).
    insight.sourceRefs = (insight.sourceRefs || []).filter(id => valid.has(id));
    if (insight.sourceRefs.length === 0) continue;

    insight.dismissed = dismissed.has(insight.id);
    out.push(insight);
  }

  // Rank: cost insights first, by severity then magnitude; info-only after.
  out.sort((a, b) => {
    const sr = severityRank(b) - severityRank(a);
    if (sr !== 0) return sr;
    const am = (b.costOfAbsence?.amount || 0) - (a.costOfAbsence?.amount || 0);
    if (am !== 0) return am;
    return 0; // V8 sort is stable — preserves rule registration order
  });

  const topCost = out.find(i => i.costOfAbsence && !i.dismissed) || null;

  return { insights: out.slice(0, limit), topCost };
}

export default runInsights;
