/**
 * FreshnessChip — shows how old a derived figure's inputs are (§11).
 * A subtle pill that turns amber when the value is past its staleness threshold.
 * Fed by engine/freshness.js: pass either a chip descriptor or a raw asOf + opts.
 */
import { freshnessChip, THRESHOLDS_MS } from '../engine/freshness.js';

export default function FreshnessChip({ chip, asOf, type = 'asset', now, style }) {
  const c = chip || freshnessChip(asOf, {
    now: now || new Date(),
    thresholdMs: THRESHOLDS_MS[type] ?? THRESHOLDS_MS.asset,
  });
  if (!c) return null;

  return (
    <span
      title={`Inputs ${c.label}`}
      aria-label={`Data ${c.label}${c.isStale ? ' — stale' : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, lineHeight: 1, padding: '3px 7px',
        borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
        background: c.isStale ? 'var(--gold-soft)' : 'var(--bg-2)',
        color: c.isStale ? 'var(--gold-ink)' : 'var(--ink-3)',
        border: c.isStale ? '0.5px solid var(--gold)' : '0.5px solid var(--line)',
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ opacity: 0.8 }}>{c.isStale ? '⚠' : '◷'}</span>
      {c.label}
    </span>
  );
}
