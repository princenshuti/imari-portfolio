import { describe, it, expect } from 'vitest';
import { GLOSSARY, TERMS_BY_INSIGHT, glossaryFor } from './glossary.js';

describe('glossary content', () => {
  it('every entry has a term, a one-liner, and a body', () => {
    for (const [id, e] of Object.entries(GLOSSARY)) {
      expect(e.term, id).toBeTruthy();
      expect(e.short?.length, id).toBeGreaterThan(10);
      expect(e.body?.length, id).toBeGreaterThan(40);
    }
  });

  it('every insight mapping points at existing glossary entries', () => {
    for (const [insightId, termIds] of Object.entries(TERMS_BY_INSIGHT)) {
      for (const tid of termIds) {
        expect(GLOSSARY[tid], `${insightId} → ${tid}`).toBeDefined();
      }
    }
  });

  it('glossaryFor returns hydrated entries and tolerates unknown ids', () => {
    const r = glossaryFor('concentration-risk');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toHaveProperty('term');
    expect(r[0]).toHaveProperty('body');
    expect(glossaryFor('not-a-rule')).toEqual([]);
  });
});
