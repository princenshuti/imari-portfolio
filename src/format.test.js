import { describe, it, expect } from 'vitest';
import { fmt, fmtNum } from './data.js';
import { rwf } from './engine/insights/_shared.js';

describe('fmt — floors, never rounds up', () => {
  it('compact millions floor (118.9M → 118M, not 119M)', () => {
    expect(fmt(118_900_000, 'RWF', { compact: true })).toBe('RWF 118M');
  });
  it('compact millions with one decimal floor', () => {
    expect(fmt(4_099_000, 'RWF', { compact: true })).toBe('RWF 4.0M');
  });
  it('compact thousands floor (8,750 → 8k, not 9k)', () => {
    expect(fmt(8_750, 'RWF', { compact: true })).toBe('RWF 8k');
  });
  it('non-compact floors the fractional part', () => {
    expect(fmt(1234.9, 'RWF')).toBe('RWF 1,234');
  });
  it('a loss floors away from zero — never understated (−118.9M → −119M)', () => {
    expect(fmt(-118_900_000, 'RWF', { compact: true })).toBe('-RWF 119M');
  });
});

describe('fmtNum — floors numbers/rates, never rounds up', () => {
  it('floors a USD exchange rate (1380.567 → 1,380.56)', () => {
    expect(fmtNum(1380.567, 2)).toBe('1,380.56');
  });
  it('floors a 4-dp spread', () => {
    expect(fmtNum(1380.56789, 4)).toBe('1,380.5678');
  });
  it('negatives floor toward −∞ (−0.567 → −0.57)', () => {
    expect(fmtNum(-0.567, 2)).toBe('-0.57');
  });
  it('whole numbers stay clean', () => {
    expect(fmtNum(6, 2)).toBe('6');
  });
});

describe('rwf (engine copy) — floors, never rounds up', () => {
  it('millions and thousands floor', () => {
    expect(rwf(118_900_000)).toBe('RWF 118M');
    expect(rwf(8_750)).toBe('RWF 8k');
  });
});
