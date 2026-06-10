import { describe, it, expect } from 'vitest';
import { goalCurrentRWF, goalProgressPct, goalTargetRWF } from './goals.js';
import { NOW, asset, goal, mkState } from './_testutils.js';

const state = mkState({
  assets: [
    asset({ id: 'cash', kind: 'momo-cash', currentValue: 2_000_000 }),
    asset({ id: 'save', kind: 'savings', currentValue: 3_000_000 }),
    asset({ id: 'land', kind: 'realestate-land', currentValue: 45_000_000 }),
  ],
  liabilities: [{ id: 'loan', remainingAmount: 10_000_000, currency: 'RWF' }],
});

describe('goalCurrentRWF', () => {
  it('net-worth goals count assets minus liabilities', () => {
    const g = goal({ fundingType: 'net-worth' });
    expect(goalCurrentRWF(g, state, NOW)).toBe(40_000_000);
  });

  it('liquid goals count only cash/savings/MoMo', () => {
    const g = goal({ fundingType: 'liquid' });
    expect(goalCurrentRWF(g, state, NOW)).toBe(5_000_000);
  });

  it('linked goals sum only the linked assets, ignoring dead IDs', () => {
    const g = goal({ fundingType: 'linked', linkedAssetIds: ['save', 'gone'] });
    expect(goalCurrentRWF(g, state, NOW)).toBe(3_000_000);
  });

  it('defaults to net-worth for legacy goals with no fundingType', () => {
    const g = goal(); delete g.fundingType;
    expect(goalCurrentRWF(g, state, NOW)).toBe(40_000_000);
  });
});

describe('goalProgressPct', () => {
  it('respects fundingType — same target, different progress', () => {
    const target = { targetAmount: 10_000_000 };
    expect(goalProgressPct(goal({ ...target, fundingType: 'liquid' }), state, NOW)).toBe(50);
    expect(goalProgressPct(goal({ ...target, fundingType: 'net-worth' }), state, NOW)).toBe(100); // capped
  });

  it('returns 0 when the target is unset or zero', () => {
    expect(goalProgressPct(goal({ targetAmount: 0 }), state, NOW)).toBe(0);
  });

  it('converts non-RWF targets before comparing', () => {
    const g = goal({ targetAmount: 10_000_000, currency: 'RWF', fundingType: 'liquid' });
    expect(goalTargetRWF(g)).toBe(10_000_000);
  });
});
