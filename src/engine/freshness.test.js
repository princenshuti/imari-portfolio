import { describe, it, expect } from 'vitest';
import {
  THRESHOLDS_MS, assetAsOf, netWorthAsOf, freshnessChip,
  humanizeAge, staleAssets, staleNetWorthInsight,
} from './freshness.js';
import { NOW, NOW_ISO, asset, mkState } from './_testutils.js';

const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe('assetAsOf', () => {
  it('prefers updatedAt, then createdAt, else null', () => {
    expect(assetAsOf({ updatedAt: 'u', createdAt: 'c' })).toBe('u');
    expect(assetAsOf({ createdAt: 'c' })).toBe('c');
    expect(assetAsOf({})).toBeNull();
  });
});

describe('netWorthAsOf', () => {
  it('returns the oldest asset stamp', () => {
    const state = mkState({ assets: [
      asset({ updatedAt: daysAgo(5) }),
      asset({ updatedAt: daysAgo(40) }),
    ] });
    expect(netWorthAsOf(state)).toBe(daysAgo(40));
  });

  it('falls back to profile.createdAt when no asset is stamped', () => {
    const state = mkState({ assets: [asset({ updatedAt: undefined, createdAt: undefined })] });
    expect(netWorthAsOf(state)).toBe(NOW_ISO);
  });
});

describe('humanizeAge', () => {
  it('buckets sensibly', () => {
    expect(humanizeAge(0)).toBe('today');
    expect(humanizeAge(5 * 86400000)).toBe('5 days ago');
    expect(humanizeAge(21 * 86400000)).toBe('3 weeks ago');
    expect(humanizeAge(60 * 86400000)).toBe('2 months ago');
  });
});

describe('freshnessChip', () => {
  it('returns null without an asOf', () => {
    expect(freshnessChip(null, { now: NOW })).toBeNull();
  });

  it('is fresh below the threshold and stale above it', () => {
    const fresh = freshnessChip(daysAgo(3), { now: NOW, thresholdMs: THRESHOLDS_MS.asset });
    expect(fresh.isStale).toBe(false);
    expect(fresh.label).toMatch(/^as of /);

    const stale = freshnessChip(daysAgo(40), { now: NOW, thresholdMs: THRESHOLDS_MS.asset });
    expect(stale.isStale).toBe(true);
  });
});

describe('staleAssets', () => {
  it('returns only assets older than the threshold', () => {
    const fresh = asset({ id: 'fresh', updatedAt: daysAgo(2) });
    const old = asset({ id: 'old', updatedAt: daysAgo(45) });
    const result = staleAssets(mkState({ assets: [fresh, old] }), { now: NOW });
    expect(result.map(a => a.id)).toEqual(['old']);
  });
});

describe('staleNetWorthInsight', () => {
  it('returns null when inputs are fresh', () => {
    const state = mkState({ assets: [asset({ updatedAt: daysAgo(2) })] });
    expect(staleNetWorthInsight(state, { now: NOW })).toBeNull();
  });

  it('boundary: exactly 30 days is still fresh', () => {
    const state = mkState({ assets: [asset({ updatedAt: daysAgo(30) })] });
    expect(staleNetWorthInsight(state, { now: NOW })).toBeNull();
  });

  it('fires (warning) when net worth is over 60 days old', () => {
    const a = asset({ id: 'stale', updatedAt: daysAgo(90) });
    const ins = staleNetWorthInsight(mkState({ assets: [a] }), { now: NOW });
    expect(ins).toBeTruthy();
    expect(ins.costOfAbsence.severity).toBe('warning');
    expect(ins.sourceRefs).toContain('stale');
    expect(ins.costOfAbsence.costStatement).toMatch(/update/i);
    expect(typeof ins.dataAsOf).toBe('string');
  });
});
