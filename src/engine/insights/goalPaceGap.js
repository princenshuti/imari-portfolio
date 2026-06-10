// goalPaceGap — required vs achievable monthly contribution for each goal, and
// the slippage (in months) if nothing changes. Flags the single most-at-risk
// goal. "Achievable" is the user's recent net monthly savings (a portfolio-wide
// proxy — stated honestly in the copy, since per-goal funding isn't tracked).

import { liquidIds as liquidIdsOf, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { goalCurrentRWF, goalTargetRWF } from '../goals.js';

export default function goalPaceGap(state, { now = new Date() } = {}) {
  const goals = (state.goals || []).filter(g => !g.achieved && g.deadline);
  if (goals.length === 0) return null;

  const assets = state.assets || [];
  const liquidIds = liquidIdsOf(assets);

  const { monthlyIncome, monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
  const available = Math.max(0, monthlyIncome - monthlyExpense);
  const haveFlowData = monthlyIncome > 0;

  let worst = null;
  for (const g of goals) {
    const target = goalTargetRWF(g);
    if (target <= 0) continue;
    // engine/goals.js is the shared fundingType-aware source the Goals page
    // and dashboard widget use — keeps this rule's numbers identical to theirs.
    const remaining = Math.max(0, target - goalCurrentRWF(g, state, now));
    if (remaining <= 0) continue;

    const monthsLeft = (new Date(g.deadline) - now) / (30.44 * 86400000);
    const overdue = monthsLeft <= 0;

    let slippage, required;
    if (overdue) {
      required = Infinity;
      slippage = Infinity; // already past deadline and unmet
    } else {
      required = remaining / monthsLeft;
      if (!haveFlowData) continue; // can't assess pace without flow data
      const projected = available > 0 ? remaining / available : Infinity;
      slippage = projected - monthsLeft;
      if (slippage <= 0) continue; // on pace
    }

    const score = overdue ? Number.MAX_SAFE_INTEGER : slippage;
    if (!worst || score > worst.score) {
      worst = { g, remaining, monthsLeft, required, slippage, overdue, score };
    }
  }

  if (!worst) return null;

  const { g, remaining, required, slippage, overdue } = worst;
  const backingIds = g.fundingType === 'linked'
    ? (g.linkedAssetIds || [])
    : g.fundingType === 'liquid' ? liquidIds : [];
  const sourceRefs = [g.id, ...backingIds];

  if (overdue) {
    return makeInsight({
      id: 'goal-pace-gap',
      type: 'foresight',
      category: 'goal',
      headline: `"${g.title}" is past its deadline`,
      body: `Deadline has passed with ${rwf(remaining)} still to go.`,
      costOfAbsence: {
        severity: 'warning',
        amount: remaining,
        costStatement: `"${g.title}" missed its target date — ${rwf(remaining)} short. Reset the date or raise contributions to make it real.`,
        action: { label: 'Adjust this goal', to: 'goals' },
      },
      sourceRefs,
      dataAsOf: inputsAsOf(state, backingIds, now),
      now,
    });
  }

  // A slip beyond ~50 years (or infinite, when net saving is ~0) is not a
  // forecast — it's a divide-by-near-zero. Quoting "slipping ~2406.1 years"
  // reads as broken math and destroys trust; say what it actually means.
  if (!Number.isFinite(slippage) || slippage > 600) {
    return makeInsight({
      id: 'goal-pace-gap',
      type: 'foresight',
      category: 'goal',
      headline: `"${g.title}" is out of reach at the current pace`,
      body: `Hitting it on time needs ${rwf(required)}/month; your recent net saving is ~${rwf(available)}/month — effectively no progress toward it.`,
      costOfAbsence: {
        severity: 'warning',
        amount: required,
        costStatement: `"${g.title}" never arrives at your current saving rate. It needs ${rwf(required)}/month — start anywhere above zero.`,
        action: { label: 'Review goals', to: 'goals' },
      },
      sourceRefs,
      dataAsOf: inputsAsOf(state, backingIds, now),
      now,
    });
  }

  const slipStr = slippage >= 12 ? `${(slippage / 12).toFixed(1)} years` : `${Math.ceil(slippage)} months`;
  return makeInsight({
    id: 'goal-pace-gap',
    type: 'foresight',
    category: 'goal',
    headline: `"${g.title}" is slipping ~${slipStr}`,
    body: `Hitting it on time needs ${rwf(required)}/month, but your recent net saving is ~${rwf(available)}/month.`,
    costOfAbsence: {
      severity: 'warning',
      amount: required,
      costStatement: `At your current pace "${g.title}" lands about ${slipStr} late. Closing the gap needs ${rwf(required)}/month.`,
      action: { label: 'Review goals', to: 'goals' },
    },
    sourceRefs,
    dataAsOf: inputsAsOf(state, backingIds, now),
    now,
  });
}
