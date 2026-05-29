// Shared fixtures for engine tests. Not a *.test.js file, so Vitest won't try to
// run it as a suite. All assets use RWF + explicit currentValue so valuation is
// deterministic (no time-derived suggestValue drift).

export const NOW = new Date('2025-06-01T00:00:00.000Z');
export const NOW_ISO = NOW.toISOString();

let seq = 0;
const nextId = (p) => `${p}-${++seq}`;

export function asset(o = {}) {
  return {
    id: o.id || nextId('a'),
    kind: 'momo-cash',
    name: 'Asset',
    currency: 'RWF',
    purchasePrice: 0,
    purchaseDate: '2024-01-01',
    currentValue: 0,
    updatedAt: NOW_ISO,
    ...o,
  };
}

export function cf(o = {}) {
  return {
    id: o.id || nextId('cf'),
    type: 'expense',
    amount: 0,
    currency: 'RWF',
    recurring: 'monthly',
    date: '2025-01-01',
    ...o,
  };
}

export function goal(o = {}) {
  return {
    id: o.id || nextId('g'),
    title: 'Goal',
    category: 'investment',
    targetAmount: 0,
    currency: 'RWF',
    deadline: '',
    fundingType: 'net-worth',
    achieved: false,
    ...o,
  };
}

export function mkState(o = {}) {
  return {
    profile: { name: 'Test', displayCurrency: 'RWF', createdAt: NOW_ISO },
    assets: [],
    liabilities: [],
    goals: [],
    cashflows: [],
    snapshots: [],
    fx: {},
    ...o,
  };
}

/** Build a snapshot list spanning the given days, with first/last net worth. */
export function snapshots(firstNW, lastNW, { startDate = '2025-03-01', endDate = '2025-06-01' } = {}) {
  return [
    { date: startDate, netWorth: firstNW, costBasis: firstNW },
    { date: endDate, netWorth: lastNW, costBasis: lastNW },
  ];
}
