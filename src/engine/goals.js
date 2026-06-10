// goals.js — single source of truth for goal funding & progress.
// Every surface that shows a goal's progress (Goals page, dashboard widget,
// insight rules, AI advisor context) must derive it from here, so the same
// goal can never report different numbers in different views.

import { valueRWF, toBase } from '../data.js';
import { liquidValueRWF, netWorthRWF } from './insights/_shared.js';

/** Goal target converted to RWF. */
export function goalTargetRWF(goal) {
  return toBase(goal.targetAmount || 0, goal.currency || 'RWF');
}

/**
 * The RWF value currently counting toward a goal, per its fundingType:
 *   'liquid'    — cash + savings + MoMo only
 *   'linked'    — sum of explicitly-linked asset IDs
 *   'net-worth' — assets − liabilities (default, back-compat)
 */
export function goalCurrentRWF(goal, state, now = new Date()) {
  const assets = state.assets || [];
  if (goal.fundingType === 'liquid') return liquidValueRWF(assets, now);
  if (goal.fundingType === 'linked') {
    const byId = new Map(assets.map(a => [a.id, a]));
    return (goal.linkedAssetIds || []).reduce((s, id) => {
      const a = byId.get(id);
      return a ? s + valueRWF(a, now) : s;
    }, 0);
  }
  return netWorthRWF(state, now);
}

/** Progress toward a goal, 0–100 (capped). 0 when the target is unset. */
export function goalProgressPct(goal, state, now = new Date()) {
  const target = goalTargetRWF(goal);
  if (target <= 0) return 0;
  return Math.min((goalCurrentRWF(goal, state, now) / target) * 100, 100);
}
