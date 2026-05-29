import { describe, it, expect } from 'vitest';
import { projectPension, statutoryRate, readinessScore, RETIREMENT_CONFIG } from './index.js';

describe('statutoryRate (6%→12%→20% ramp)', () => {
  it('picks the right step at each boundary', () => {
    expect(statutoryRate(2024)).toBe(6);
    expect(statutoryRate(2025)).toBe(12);
    expect(statutoryRate(2029)).toBe(12);
    expect(statutoryRate(2030)).toBe(20);
    expect(statutoryRate(2035)).toBe(20);
  });
});

describe('readinessScore', () => {
  it('scales replacement ratio against the target, clamped 0–100', () => {
    expect(readinessScore(60, 60)).toBe(100);
    expect(readinessScore(30, 60)).toBe(50);
    expect(readinessScore(120, 60)).toBe(100);
    expect(readinessScore(null)).toBeNull();
  });
});

describe('projectPension', () => {
  it('returns null without an age', () => {
    expect(projectPension({ monthlyContribution: 50_000 })).toBeNull();
  });

  it('boundary: at age 60 with retirementAge 60, pot equals contributions to date (no growth window)', () => {
    const p = projectPension({ currentAge: 60, retirementAge: 60, contributionsToDate: 5_000_000, monthlyContribution: 50_000 });
    expect(p.years).toBe(0);
    expect(Math.round(p.projectedPot)).toBe(5_000_000);
  });

  it('boundary: age 65 path grows the pot beyond contributions', () => {
    const p = projectPension({ currentAge: 40, retirementAge: 65, contributionsToDate: 5_000_000, monthlyContribution: 50_000 });
    expect(p.years).toBe(25);
    expect(p.projectedPot).toBeGreaterThan(5_000_000 + 50_000 * 25 * 12 * 0.5);
  });

  it('computes replacement ratio + readiness when salary is known', () => {
    const p = projectPension({ currentAge: 35, retirementAge: 60, contributionsToDate: 2_000_000, monthlyContribution: 80_000, annualSalary: 6_000_000 });
    expect(p.replacementRatio).toBeGreaterThan(0);
    expect(p.readiness).toBeGreaterThanOrEqual(0);
    expect(p.readiness).toBeLessThanOrEqual(100);
  });

  it('omits replacement ratio when salary is unknown', () => {
    const p = projectPension({ currentAge: 35, monthlyContribution: 80_000 });
    expect(p.replacementRatio).toBeNull();
    expect(p.readiness).toBeNull();
  });
});
