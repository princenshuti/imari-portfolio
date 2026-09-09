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
import { liquidIds, liquidValueRWF, safetyBufferRWF, monthlyFlowsRWF, makeInsight, inputsAsOf, rwf } from './_shared.js';
import { toBase } from '../../data.js';

import { tx } from '../../i18n/tx.js';

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
  const surplus = liquid - safetyBufferRWF(monthlyExpense, refs);
  if (surplus <= 0) return null;

  const top = loans[0];
  const applicable = Math.min(surplus, top.remainingRWF);
  // Net annual saving = interest stopped minus the low yield that cash earns now.
  const netRatePct = top.ratePct - refs.idleYieldThresholdPct;
  const annualSave = applicable * netRatePct / 100;
  if (annualSave < MIN_ANNUAL_SAVING_RWF) return null;

  const loanName = top.l.name || top.l.lender || 'your loan';
  const cashIds = liquidIds(assets);
  const sourceRefs = [top.l.id, ...cashIds];
  const fullRepay = applicable >= top.remainingRWF;

  return makeInsight({
    id: 'debt-vs-idle-cash',
    type: 'comparison',
    category: 'debt',
    headline: tx('Cash in the bank while "{0}" charges {1}%', [loanName, top.ratePct]),
    body: tx(
      'You hold ~{0} beyond a {1} buffer while {2} accrues {3}%/year on {4}. {5} saves ~{6}/year in interest — a guaranteed {7}% return no deposit matches. Check prepayment terms with the lender first.',
      [
        rwf(surplus),
        monthlyExpense > 0 ? `${refs.runwayWarnMonths}-month` : 'safety',
        loanName,
        top.ratePct,
        rwf(top.remainingRWF),
        fullRepay ? `Clearing it entirely` : `Putting ${rwf(applicable)} toward it`,
        rwf(annualSave),
        netRatePct.toFixed(1)
      ]
    ),
    costOfAbsence: {
      severity: 'warning',
      amount: annualSave,
      costStatement: tx(
        'Every year this cash sits idle next to {0}, ~{1} flows to the bank in interest you could stop paying.',
        [loanName, rwf(annualSave)]
      ),
      action: { label: tx('Review your loans'), to: 'liabilities' },
    },
    sourceRefs,
    dataAsOf: inputsAsOf(state, cashIds, now),
    now,
  });
}
