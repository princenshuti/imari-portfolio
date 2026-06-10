import { describe, it, expect } from 'vitest';
import { NOW, asset, cf, goal, mkState, snapshots } from '../_testutils.js';

import runwayMonths from './runwayMonths.js';
import idleCashYieldGap from './idleCashYieldGap.js';
import concentrationRisk from './concentrationRisk.js';
import realVsNominalNetWorth from './realVsNominalNetWorth.js';
import taxDeadlineExposure from './taxDeadlineExposure.js';
import goalPaceGap from './goalPaceGap.js';
import incomeGeneratingShare from './incomeGeneratingShare.js';
import topMoverAttribution from './topMoverAttribution.js';
import landRevaluationStale from './landRevaluationStale.js';
import debtVsIdleCash from './debtVsIdleCash.js';
import { runInsights } from './index.js';

const ctx = { now: NOW };

// Every produced insight must carry these — an insight without them fails CI.
function expectWellFormed(ins) {
  expect(ins).toBeTruthy();
  expect(Array.isArray(ins.sourceRefs)).toBe(true);
  expect(ins.sourceRefs.length).toBeGreaterThan(0);
  expect(typeof ins.dataAsOf).toBe('string');
  expect(ins.dataAsOf.length).toBeGreaterThan(0);
}

describe('runwayMonths', () => {
  const expense = cf({ type: 'expense', recurring: 'monthly', amount: 500_000 });

  it('warns when runway is under 3 months', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 1_000_000 }); // 2 months
    const ins = runwayMonths(mkState({ assets: [a], cashflows: [expense] }), ctx);
    expectWellFormed(ins);
    expect(ins.costOfAbsence.severity).toBe('warning');
    expect(ins.sourceRefs).toContain(a.id);
  });

  it('escalates to critical under 1 month', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 200_000 }); // 0.4 months
    const ins = runwayMonths(mkState({ assets: [a], cashflows: [expense] }), ctx);
    expect(ins.costOfAbsence.severity).toBe('critical');
  });

  it('returns null when healthy (>= 3 months)', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 3_000_000 }); // 6 months
    expect(runwayMonths(mkState({ assets: [a], cashflows: [expense] }), ctx)).toBeNull();
  });

  it('boundary: exactly 3 months is not a cost', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 1_500_000 }); // exactly 3
    expect(runwayMonths(mkState({ assets: [a], cashflows: [expense] }), ctx)).toBeNull();
  });

  it('returns null with no expense data', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 100_000 });
    expect(runwayMonths(mkState({ assets: [a], cashflows: [] }), ctx)).toBeNull();
  });
});

describe('idleCashYieldGap', () => {
  it('flags idle cash above the floor', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 2_000_000 });
    const ins = idleCashYieldGap(mkState({ assets: [a] }), ctx);
    expectWellFormed(ins);
    expect(ins.costOfAbsence.severity).toBe('warning');
    expect(ins.costOfAbsence.amount).toBeGreaterThan(0);
  });

  it('returns null below the idle-cash floor', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 100_000 });
    expect(idleCashYieldGap(mkState({ assets: [a] }), ctx)).toBeNull();
  });

  it('boundary: savings at exactly the yield threshold is not idle', () => {
    const a = asset({ kind: 'savings', currentValue: 2_000_000, yieldPct: 2 });
    expect(idleCashYieldGap(mkState({ assets: [a] }), ctx)).toBeNull();
  });

  it('savings just below threshold IS idle', () => {
    const a = asset({ kind: 'savings', currentValue: 2_000_000, yieldPct: 1.9 });
    expect(idleCashYieldGap(mkState({ assets: [a] }), ctx)).toBeTruthy();
  });
});

describe('concentrationRisk', () => {
  it('flags a holding over 25% (critical when >40%)', () => {
    const big = asset({ id: 'big', kind: 'realestate-land', currentValue: 3_000_000 });
    const small = asset({ id: 'small', kind: 'momo-cash', currentValue: 1_000_000 });
    const ins = concentrationRisk(mkState({ assets: [big, small] }), ctx);
    expectWellFormed(ins);
    expect(ins.costOfAbsence.severity).toBe('critical'); // 75%
  });

  it('boundary: exactly 25% each is not flagged', () => {
    const assets = ['realestate-land', 'vehicle', 'momo-cash', 'crypto'].map((kind, i) =>
      asset({ id: `c${i}`, kind, currentValue: 1_000_000 }));
    expect(concentrationRisk(mkState({ assets }), ctx)).toBeNull();
  });

  it('returns null with no assets', () => {
    expect(concentrationRisk(mkState({ assets: [] }), ctx)).toBeNull();
  });
});

describe('realVsNominalNetWorth', () => {
  const a = asset({ kind: 'momo-cash', currentValue: 10_000_000 });

  it('surfaces inflation erosion when net worth is flat nominally', () => {
    const ins = realVsNominalNetWorth(
      mkState({ assets: [a], snapshots: snapshots(10_000_000, 10_000_000) }), ctx);
    expectWellFormed(ins);
    expect(ins.category).toBe('networth');
  });

  it('returns null with fewer than 2 snapshots', () => {
    expect(realVsNominalNetWorth(mkState({ assets: [a], snapshots: [] }), ctx)).toBeNull();
  });

  it('returns null when the window is too short', () => {
    const snaps = snapshots(10_000_000, 10_000_000, { startDate: '2025-05-28', endDate: '2025-06-01' });
    expect(realVsNominalNetWorth(mkState({ assets: [a], snapshots: snaps }), ctx)).toBeNull();
  });

  it('returns null when CPI reference is zero', () => {
    const noInflation = { ...ctx, refs: { cpiYoYPct: 0 } };
    expect(realVsNominalNetWorth(
      mkState({ assets: [a], snapshots: snapshots(10_000_000, 10_000_000) }), noInflation)).toBeNull();
  });
});

describe('taxDeadlineExposure', () => {
  it('flags an upcoming vehicle levy with a penalty', () => {
    const v = asset({ kind: 'vehicle', vehicleCategory: 'car', currentValue: 18_000_000 });
    const now = new Date('2025-12-01T00:00:00Z'); // ~30 days to 31 Dec
    const ins = taxDeadlineExposure(mkState({ assets: [v] }), { now });
    expectWellFormed(ins);
    expect(ins.costOfAbsence.severity).toBe('warning');
    expect(ins.costOfAbsence.amount).toBe(5_000); // 50k levy × 10% first bracket
  });

  it('escalates to critical within 14 days', () => {
    const v = asset({ kind: 'vehicle', vehicleCategory: 'car', currentValue: 18_000_000 });
    const ins = taxDeadlineExposure(mkState({ assets: [v] }), { now: new Date('2025-12-20T00:00:00Z') });
    expect(ins.costOfAbsence.severity).toBe('critical');
  });

  it('computes Fixed Asset Tax for property near the March deadline', () => {
    const land = asset({ kind: 'realestate-land', currentValue: 100_000_000 });
    const ins = taxDeadlineExposure(mkState({ assets: [land] }), { now: new Date('2025-03-01T00:00:00Z') });
    expectWellFormed(ins);
    expect(ins.category).toBe('tax');
  });

  it('returns null with no taxable assets', () => {
    const a = asset({ kind: 'momo-cash', currentValue: 1_000_000 });
    expect(taxDeadlineExposure(mkState({ assets: [a] }), ctx)).toBeNull();
  });

  it('returns null when the deadline is beyond the horizon', () => {
    const v = asset({ kind: 'vehicle', vehicleCategory: 'car', currentValue: 18_000_000 });
    // June → 31 Dec is ~213 days, past the 120-day horizon
    expect(taxDeadlineExposure(mkState({ assets: [v] }), { now: new Date('2025-06-01T00:00:00Z') })).toBeNull();
  });
});

describe('goalPaceGap', () => {
  const inFuture = (days) => new Date(NOW.getTime() + days * 86400000).toISOString().slice(0, 10);
  const liquid = asset({ kind: 'momo-cash', currentValue: 1_000_000 });
  const income = cf({ type: 'income', recurring: 'monthly', amount: 1_000_000 });

  it('flags a goal slipping behind pace', () => {
    const expense = cf({ type: 'expense', recurring: 'monthly', amount: 700_000 }); // available 300k/mo
    const g = goal({ fundingType: 'liquid', targetAmount: 10_000_000, deadline: inFuture(304) }); // ~10mo, needs 900k/mo
    const ins = goalPaceGap(mkState({ assets: [liquid], goals: [g], cashflows: [income, expense] }), ctx);
    expectWellFormed(ins);
    expect(ins.sourceRefs).toContain(g.id);
  });

  it('flags an overdue goal', () => {
    const g = goal({ fundingType: 'liquid', targetAmount: 10_000_000, deadline: inFuture(-30) });
    const ins = goalPaceGap(mkState({ assets: [liquid], goals: [g], cashflows: [income] }), ctx);
    expectWellFormed(ins);
    expect(ins.headline).toMatch(/past its deadline/i);
  });

  it('caps absurd slippage at honest "out of reach" copy (no 2406-year claims)', () => {
    // Income 1M vs expense 999,990 → net saving 10 RWF/mo against a 10M goal:
    // raw slippage is ~80,000 years. The insight must not quote it.
    const expense = cf({ type: 'expense', recurring: 'monthly', amount: 999_990 });
    const g = goal({ fundingType: 'liquid', targetAmount: 10_000_000, deadline: inFuture(304) });
    const ins = goalPaceGap(mkState({ assets: [liquid], goals: [g], cashflows: [income, expense] }), ctx);
    expectWellFormed(ins);
    expect(ins.headline).toMatch(/out of reach/i);
    expect(ins.headline).not.toMatch(/years/i);
    expect(ins.costOfAbsence.costStatement).not.toMatch(/\d{3,} (months|years)/);
  });

  it('boundary: on-pace goal (available >= required) is not flagged', () => {
    const expense = cf({ type: 'expense', recurring: 'monthly', amount: 0 }); // available 1M/mo
    const g = goal({ fundingType: 'liquid', targetAmount: 4_000_000, deadline: inFuture(304) }); // needs ~300k/mo
    expect(goalPaceGap(mkState({ assets: [liquid], goals: [g], cashflows: [income, expense] }), ctx)).toBeNull();
  });

  it('returns null with no goals', () => {
    expect(goalPaceGap(mkState({ assets: [liquid], cashflows: [income] }), ctx)).toBeNull();
  });
});

describe('incomeGeneratingShare', () => {
  it('warns when income-generating share is low', () => {
    const idle = asset({ id: 'idle', kind: 'momo-cash', currentValue: 6_000_000 });
    const earner = asset({ id: 'bond', kind: 'bond', currentValue: 1_000_000 }); // ~14%
    const ins = incomeGeneratingShare(mkState({ assets: [idle, earner] }), ctx);
    expectWellFormed(ins);
    expect(ins.costOfAbsence.severity).toBe('warning');
  });

  it('boundary: exactly 40% share is not flagged', () => {
    const idle = asset({ kind: 'momo-cash', currentValue: 6_000_000 });
    const earner = asset({ kind: 'bond', currentValue: 4_000_000 }); // exactly 40%
    expect(incomeGeneratingShare(mkState({ assets: [idle, earner] }), ctx)).toBeNull();
  });

  it('returns null when everything earns income', () => {
    const earner = asset({ kind: 'bond', currentValue: 5_000_000 });
    expect(incomeGeneratingShare(mkState({ assets: [earner] }), ctx)).toBeNull();
  });
});

describe('topMoverAttribution', () => {
  it('attaches a cost hook to a material loss', () => {
    const a = asset({ kind: 'realestate-land', purchasePrice: 10_000_000, currentValue: 9_000_000 });
    const ins = topMoverAttribution(mkState({ assets: [a] }), ctx);
    expectWellFormed(ins);
    expect(ins.costOfAbsence).toBeTruthy();
    expect(ins.costOfAbsence.severity).toBe('info');
  });

  it('reports a gainer with no cost hook', () => {
    const a = asset({ kind: 'realestate-land', purchasePrice: 1_000_000, currentValue: 2_000_000 });
    const ins = topMoverAttribution(mkState({ assets: [a] }), ctx);
    expectWellFormed(ins);
    expect(ins.costOfAbsence).toBeFalsy();
  });

  it('returns null when nothing has moved', () => {
    const a = asset({ kind: 'realestate-land', purchasePrice: 1_000_000, currentValue: 1_000_000 });
    expect(topMoverAttribution(mkState({ assets: [a] }), ctx)).toBeNull();
  });

  it('returns null with no assets', () => {
    expect(topMoverAttribution(mkState({ assets: [] }), ctx)).toBeNull();
  });
});

describe('landRevaluationStale', () => {
  const ago = (months) => new Date(NOW.getTime() - months * 30.44 * 86400000).toISOString().slice(0, 10);

  it('flags a property not revalued in over a year', () => {
    const a = asset({ kind: 'realestate-land', name: 'Kabuga plot', currentValue: 50_000_000, lastRevaluedAt: ago(18) });
    const ins = landRevaluationStale(mkState({ assets: [a] }), ctx);
    expectWellFormed(ins);
    expect(ins.costOfAbsence.severity).toBe('info');
  });

  it('boundary: revalued within 12 months is not flagged', () => {
    const a = asset({ kind: 'realestate-land', currentValue: 50_000_000, lastRevaluedAt: ago(6) });
    expect(landRevaluationStale(mkState({ assets: [a] }), ctx)).toBeNull();
  });

  it('returns null when no property has a revaluation date', () => {
    const a = asset({ kind: 'realestate-land', currentValue: 50_000_000 });
    expect(landRevaluationStale(mkState({ assets: [a] }), ctx)).toBeNull();
  });
});

describe('debtVsIdleCash', () => {
  const liab = (o = {}) => ({ id: o.id || `l-${Math.abs(JSON.stringify(o).length)}`, name: 'Bank loan', kind: 'bank-loan', currency: 'RWF', remainingAmount: 0, interestRate: 0, ...o });
  const cash = asset({ kind: 'savings', currentValue: 5_000_000, name: 'BK savings' });
  const expense = cf({ type: 'expense', recurring: 'monthly', amount: 500_000 }); // buffer = 1.5M

  it('recommends repayment when idle cash sits next to an expensive loan', () => {
    const loan = liab({ id: 'loan1', remainingAmount: 3_000_000, interestRate: 18 });
    const ins = debtVsIdleCash(mkState({ assets: [cash], liabilities: [loan], cashflows: [expense] }), ctx);
    expectWellFormed(ins);
    expect(ins.id).toBe('debt-vs-idle-cash');
    expect(ins.sourceRefs).toContain('loan1');
    // surplus = 5M − 1.5M = 3.5M, applicable = min(3.5M, 3M) = 3M,
    // net rate = 18 − 2 = 16% → saves 480k/yr
    expect(ins.costOfAbsence.amount).toBe(3_000_000 * 0.16);
  });

  it('never recommends touching the emergency buffer', () => {
    const smallCash = asset({ kind: 'savings', currentValue: 1_400_000 }); // below 1.5M buffer
    const loan = liab({ remainingAmount: 3_000_000, interestRate: 18 });
    expect(debtVsIdleCash(mkState({ assets: [smallCash], liabilities: [loan], cashflows: [expense] }), ctx)).toBeNull();
  });

  it('does not fire when the loan rate is below the safe T-bill yield', () => {
    // 8% loan < 10% T-bill — investing the cash is the better move there.
    const loan = liab({ remainingAmount: 3_000_000, interestRate: 8 });
    expect(debtVsIdleCash(mkState({ assets: [cash], liabilities: [loan], cashflows: [expense] }), ctx)).toBeNull();
  });

  it('picks the highest-rate loan when several qualify', () => {
    const cheap = liab({ id: 'cheap', remainingAmount: 9_000_000, interestRate: 12 });
    const dear  = liab({ id: 'dear',  remainingAmount: 1_000_000, interestRate: 22 });
    const ins = debtVsIdleCash(mkState({ assets: [cash], liabilities: [cheap, dear], cashflows: [expense] }), ctx);
    expect(ins.sourceRefs).toContain('dear');
    expect(ins.sourceRefs).not.toContain('cheap');
  });

  it('skips when the saving is too small to matter', () => {
    const loan = liab({ remainingAmount: 200_000, interestRate: 12 }); // ~20k/yr
    expect(debtVsIdleCash(mkState({ assets: [cash], liabilities: [loan], cashflows: [expense] }), ctx)).toBeNull();
  });

  it('runInsights suppresses the T-bill pitch when repayment wins the same cash', () => {
    const loan = liab({ id: 'loanX', remainingAmount: 3_000_000, interestRate: 18 });
    const { insights } = runInsights(mkState({ assets: [cash], liabilities: [loan], cashflows: [expense] }), ctx);
    const ids = insights.map(i => i.id);
    expect(ids).toContain('debt-vs-idle-cash');
    expect(ids).not.toContain('idle-cash-yield-gap');
  });
});
