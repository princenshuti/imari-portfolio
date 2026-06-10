// pensionContributionGap — salary income is recorded but retirement tracking
// is empty. At the statutory RSSB rate, a known slice of that salary should
// be flowing to a pension; until the user sets up the Retirement view, their
// biggest long-horizon asset is invisible to them and to Imari.

import { makeInsight, inputsAsOf, rwf } from './_shared.js';
import { toBase } from '../../data.js';
import { monthlyEquivalent } from '../recurrence.js';
import { statutoryRate } from '../retirement/index.js';

export default function pensionContributionGap(state, { now = new Date() } = {}) {
  const salaries = (state.cashflows || []).filter(cf =>
    cf.type === 'income' && cf.category === 'salary' && cf.recurring && cf.recurring !== 'once');
  if (salaries.length === 0) return null;

  const salaryMonthly = salaries.reduce((s, cf) =>
    s + monthlyEquivalent(toBase(cf.amount || 0, cf.currency || 'RWF'), cf.recurring), 0);
  if (!(salaryMonthly > 0)) return null;

  // Retirement already set up (any contribution or age recorded) → the
  // Retirement view and its dashboard tile own readiness; stay silent.
  const r = state.profile?.retirement;
  const tracked = r && (r.currentAge || (r.monthlyContribution || 0) > 0 || (r.contributionsToDate || 0) > 0);
  if (tracked) return null;

  const ratePct = statutoryRate(now.getFullYear());
  const statutoryMonthly = salaryMonthly * ratePct / 100;
  const ids = salaries.map(cf => cf.id);

  return makeInsight({
    id: 'pension-contribution-gap',
    type: 'foresight',
    category: 'retirement',
    headline: 'Your pension is invisible to your net worth',
    body: `You record ${rwf(salaryMonthly)}/month in salary, so at the ${ratePct}% statutory RSSB rate roughly ${rwf(statutoryMonthly)}/month should be accruing toward your retirement — but the Retirement view has no inputs yet. Two minutes of setup shows whether you're on track for 60, and what an Ejo Heza top-up changes.`,
    costOfAbsence: {
      severity: 'info',
      amount: statutoryMonthly,
      costStatement: `~${rwf(statutoryMonthly)}/month of retirement wealth is accruing unseen — untracked savings can't be steered.`,
      action: { label: 'Set up Retirement', to: 'retirement' },
    },
    sourceRefs: ids,
    dataAsOf: inputsAsOf(state, [], now),
    now,
  });
}
