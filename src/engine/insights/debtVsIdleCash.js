// debtVsIdleCash — cash sitting in low-yield accounts while an expensive loan
// accrues interest. The single highest-value, most-overlooked move in personal
// finance: paying down an 18% loan is a guaranteed 18% return, which no
// deposit or T-bill matches.
//
// Honesty guardrails:
//  • Never recommends touching the emergency buffer (3 months of recorded
//    spend; the idle-cash floor when no expense data exists).
//  • Fires only when the loan's rate beats the safe T-bill reference — below
//    that, investing the cash genuinely is the better move and the
//    idle-cash-yield-gap rule handles it. runInsights suppresses that rule
//    when this one fires, so the same francs never get two competing pitches.
//  • Saving is netted against the (low) yield the cash earns today, and the
//    copy reminds the user to check prepayment terms.

import { REFERENCE } from './refs.js';
import { LIQUID_KINDS, liquidValueRWF, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { toBase } from '../../data.js';

const MIN_ANNUAL_SAVING_RWF = 50_000; // below this the advice is noise

export default function debtVsIdleCash(state, { now = new Date(), refs = REFERENCE } = {}) {
  const assets = state.assets || [];

  // Loans worth repaying early: outstanding balance, rate above the safe yield.
  const loans = (state.liabilities || [])
    .map(l => ({ l, ratePct: +l.interestRate || 0, remainingRWF: toBase(l.remainingAmount || 0, l.currency || 'RWF') }))
    .filter(x => x.remainingRWF > 0 && x.ratePct > refs.tBillYieldPct)
    .sort((a, b) => b.ratePct - a.ratePct);
  if (loans.length === 0) return null;

  const liquid = liquidValueRWF(assets, now);
  const { monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
  const buffer = monthlyExpense > 0
    ? monthlyExpense * refs.runwayWarnMonths
    : refs.idleCashFloorRWF;
  const surplus = liquid - buffer;
  if (surplus <= 0) return null;

  const top = loans[0];
  const applicable = Math.min(surplus, top.remainingRWF);
  // Net annual saving = interest stopped minus the low yield that cash earns now.
  const netRatePct = top.ratePct - refs.idleYieldThresholdPct;
  const annualSave = applicable * netRatePct / 100;
  if (annualSave < MIN_ANNUAL_SAVING_RWF) return null;

  const loanName = top.l.name || top.l.lender || 'your loan';
  const liquidIds = assets.filter(a => LIQUID_KINDS.has(a.kind)).map(a => a.id);
  const sourceRefs = [top.l.id, ...liquidIds];
  const fullRepay = applicable >= top.remainingRWF;

  return makeInsight({
    id: 'debt-vs-idle-cash',
    type: 'comparison',
    category: 'debt',
    headline: `Cash in the bank while "${loanName}" charges ${top.ratePct}%`,
    body: `You hold ~${rwf(surplus)} beyond a ${monthlyExpense > 0 ? `${refs.runwayWarnMonths}-month` : 'safety'} buffer while ${loanName} accrues ${top.ratePct}%/year on ${rwf(top.remainingRWF)}. ${fullRepay ? `Clearing it entirely` : `Putting ${rwf(applicable)} toward it`} saves ~${rwf(annualSave)}/year in interest — a guaranteed ${netRatePct.toFixed(1)}% return no deposit matches. Check prepayment terms with the lender first.`,
    costOfAbsence: {
      severity: 'warning',
      amount: annualSave,
      costStatement: `Every year this cash sits idle next to ${loanName}, ~${rwf(annualSave)} flows to the bank in interest you could stop paying.`,
      action: { label: 'Review your loans', to: 'liabilities' },
    },
    sourceRefs,
    dataAsOf: inputsAsOf(state, liquidIds, now),
    now,
  });
}
