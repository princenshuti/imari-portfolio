// goalPaceGap — required vs achievable monthly contribution for each goal, and
// the slippage (in months) if nothing changes. Flags the single most-at-risk
// goal. "Achievable" is the user's recent net monthly savings (a portfolio-wide
// proxy — stated honestly in the copy, since per-goal funding isn't tracked).

import { LIQUID_KINDS, liquidValueRWF, netWorthRWF, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { valueRWF, toBase } from '../../data.js';

export default function goalPaceGap(state, { now = new Date() } = {}) {
  const goals = (state.goals || []).filter(g => !g.achieved && g.deadline);
  if (goals.length === 0) return null;

  const assets = state.assets || [];
  const liquid = liquidValueRWF(assets, now);
  const nw = netWorthRWF(state, now);
  const assetById = new Map(assets.map(a => [a.id, a]));
  const liquidIds = assets.filter(a => LIQUID_KINDS.has(a.kind)).map(a => a.id);

  const { monthlyIncome, monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
  const available = Math.max(0, monthlyIncome - monthlyExpense);
  const haveFlowData = monthlyIncome > 0;

  const currentFor = (g) => {
    if (g.fundingType === 'liquid') return liquid;
    if (g.fundingType === 'linked') {
      return (g.linkedAssetIds || []).reduce((s, id) => {
        const a = assetById.get(id);
        return a ? s + valueRWF(a, now) : s;
      }, 0);
    }
    return nw;
  };

  let worst = null;
  for (const g of goals) {
    const target = toBase(g.targetAmount || 0, g.currency || 'RWF');
    if (target <= 0) continue;
    const remaining = Math.max(0, target - currentFor(g));
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
