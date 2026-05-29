/**
 * MetricWidget — one-glance KPI card with a Cost-of-Absence hook and deep link
 * (B6–B9). Shared shell so Cash-in-Hand, Tax Estimate, Debt and Investable are
 * one component, not four bespoke ones. Numbers come from the Insight Engine /
 * dashboard stats; the hook answers "what does ignoring this cost me?".
 */
import FreshnessChip from './FreshnessChip.jsx';

const SEV_COLOR = {
  critical: 'var(--down)', warning: 'var(--gold)', info: 'var(--sky)', good: 'var(--up)',
};
const SEV_GLYPH = { critical: '⚠', warning: '!', info: 'i', good: '✓' };

export default function MetricWidget({
  title, value, subtext, severity, costHook, deepLink, asOf, now, onNav, delay = 0,
}) {
  const clickable = !!deepLink;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={clickable ? () => onNav?.(deepLink) : undefined}
      aria-label={clickable ? `${title}: ${value}. ${subtext || ''}${costHook ? '. ' + costHook : ''}` : undefined}
      className={`dash-kpi-tile${clickable ? ' is-interactive' : ''}`}
      style={{
        padding: '16px 18px', borderRadius: 'var(--r-md)',
        background: 'var(--paper)', border: '0.5px solid var(--line)',
        boxShadow: 'var(--shadow-1)', textAlign: 'left', fontFamily: 'inherit',
        width: '100%', display: 'block',
        animation: 'imari-slideUp 240ms cubic-bezier(0.23,1,0.32,1) both',
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
        {asOf && <FreshnessChip asOf={asOf} type="netWorth" now={now} />}
      </div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
      {subtext && <div className="muted" style={{ fontSize: 10.5, marginTop: 5, lineHeight: 1.4 }}>{subtext}</div>}
      {costHook && (
        <div className="row" style={{ marginTop: 9, gap: 7, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{
            flexShrink: 0, width: 16, height: 16, borderRadius: 5, marginTop: 1,
            background: SEV_COLOR[severity] || 'var(--ink-3)', color: 'var(--brand-ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, fontFamily: severity === 'critical' ? 'inherit' : 'Geist Mono, monospace',
          }}>{SEV_GLYPH[severity] || '•'}</span>
          <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--ink-2)' }}>{costHook}</span>
        </div>
      )}
    </Tag>
  );
}
