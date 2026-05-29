/**
 * CostOfAbsence — the loss-aversion card (§1).
 *
 * Every instance answers one question: "what does this cost me if I ignore it?"
 * — grounded in the user's own data. Honest loss aversion: the engine only
 * produces these from real numbers (see engine/insights), never fabricated fear.
 *
 * Props:
 *   severity      'critical' | 'warning' | 'info'  → color token + glyph + a11y name
 *   headline      short human headline (optional)
 *   costStatement the concrete loss, rendered in bold (required)
 *   action        { label, to }  → primary button, deep-links via hash route
 *   asOf          ISO string for the freshness chip (optional)
 *   onAction(to)  navigate handler (falls back to setting window.location.hash)
 *   onDismiss()   optional dismiss handler → renders an accessible × control
 */
import FreshnessChip from './FreshnessChip.jsx';

const SEVERITY = {
  critical: { color: 'var(--down)', glyph: '⚠', label: 'Critical' },
  warning:  { color: 'var(--gold)', glyph: '!', label: 'Warning' },
  info:     { color: 'var(--sky)',  glyph: 'i', label: 'Heads up' },
};

export default function CostOfAbsence({
  severity = 'info', headline, costStatement, action, asOf,
  onAction, onDismiss, now, style,
}) {
  if (!costStatement) return null; // never render an empty / sourceless card
  const s = SEVERITY[severity] || SEVERITY.info;

  const navigate = (to) => {
    if (!to) return;
    if (onAction) onAction(to);
    else window.location.hash = to;
  };

  return (
    <div
      role={severity === 'critical' ? 'alert' : 'status'}
      className="cost-of-absence-card"
      style={{
        position: 'relative',
        display: 'flex', gap: 14, alignItems: 'flex-start',
        padding: '16px 18px', marginBottom: 16,
        borderRadius: 'var(--r-lg)',
        background: `color-mix(in oklab, ${s.color} 8%, var(--paper))`,
        border: `0.5px solid color-mix(in oklab, ${s.color} 32%, transparent)`,
        borderLeft: `3px solid ${s.color}`,
        boxShadow: 'var(--shadow-1)',
        animation: 'imari-slideUp 240ms cubic-bezier(0.23,1,0.32,1) both',
        ...style,
      }}
    >
      {/* Severity badge — color + glyph + screen-reader name */}
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 10,
          background: s.color, color: 'var(--brand-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: severity === 'info' ? 17 : 18, fontWeight: 700,
          fontFamily: severity === 'critical' ? 'inherit' : 'Geist Mono, monospace',
          lineHeight: 1,
        }}
      >
        {s.glyph}
      </div>
      <span className="sr-only">{s.label}:</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {headline && (
          <div className="font-serif" style={{ fontSize: 16, lineHeight: 1.2, marginBottom: 4, color: 'var(--ink)' }}>
            {headline}
          </div>
        )}
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 600 }}>
          {costStatement}
        </p>

        <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {action?.label && (
            <button
              type="button"
              onClick={() => navigate(action.to)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--r-pill)', border: 0,
                background: s.color, color: 'var(--brand-ink)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                transition: 'opacity 140ms ease-out, transform 140ms ease-out',
              }}
            >
              {action.label} →
            </button>
          )}
          {asOf && <FreshnessChip asOf={asOf} type="netWorth" now={now} />}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss this alert"
          style={{
            flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
            border: 0, background: 'transparent', cursor: 'pointer',
            color: 'var(--ink-3)', fontSize: 16, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 140ms ease-out',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
