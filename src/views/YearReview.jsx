import { useMemo } from 'react';
import { fmtBase } from '../data.js';
import { buildYearReview } from '../engine/yearReview.js';
import { AreaChart } from '../components/charts.jsx';

// Surfaces src/engine/yearReview.js — the trailing 12 months of daily
// snapshots, distilled into a reflection. Honesty rules: synthetic seed
// history is flagged, and every figure traces to a recorded snapshot.
export default function YearReviewView({ state }) {
  const { profile, snapshots = [] } = state;
  const ccy = profile.displayCurrency || 'RWF';
  const review = useMemo(() => buildYearReview(snapshots), [snapshots]);

  const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  if (!review) {
    return (
      <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>
        <div className="font-serif" style={{ fontSize: 26, marginBottom: 18 }}>Year in review</div>
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>Your year is still being written</div>
          <div className="muted" style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            Imari records a net-worth snapshot every day you open it. Once a few days
            accrue, this page becomes the story of your year — every month, high and low.
            Each day you don't check in is a day missing from that story.
          </div>
        </div>
      </div>
    );
  }

  const up = review.change >= 0;
  const accent = up ? 'var(--up)' : 'var(--down)';
  const barMax = Math.max(...review.months.map(m => Math.abs(m.change)), 1);

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="font-serif" style={{ fontSize: 26 }}>Year in review</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {longDate(review.start.date)} → {longDate(review.end.date)} · {review.daysTracked} snapshots
        </div>
      </div>

      {review.includesSynthetic && (
        <div role="status" style={{
          marginBottom: 14, padding: '9px 14px', borderRadius: 8, fontSize: 11.5,
          background: 'var(--gold-soft)', color: 'var(--ink-2)', lineHeight: 1.5,
        }}>
          Part of this window is seeded demo history — real daily snapshots accrue from when you started using Imari.
        </div>
      )}

      {/* Hero — the year in one number */}
      <div className="card" style={{ padding: '24px 26px', marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Net worth this year</div>
        <div className="row" style={{ gap: 14, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 6 }}>
          <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {fmtBase(review.end.netWorth, ccy, { compact: true })}
          </div>
          <div className="num" style={{ fontSize: 16, fontWeight: 700, color: accent }}>
            {up ? '▲' : '▼'} {fmtBase(Math.abs(review.change), ccy, { compact: true })}
            {review.changePct != null && ` (${up ? '+' : ''}${review.changePct.toFixed(1)}%)`}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          from {fmtBase(review.start.netWorth, ccy, { compact: true })} on {longDate(review.start.date)}
        </div>
      </div>

      {/* Watermarks + best/worst months */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Highest point', value: review.high.netWorth, sub: shortDate(review.high.date), color: 'var(--up)' },
          { label: 'Lowest point', value: review.low.netWorth, sub: shortDate(review.low.date), color: 'var(--down)' },
          review.bestMonth && { label: 'Best month', value: review.bestMonth.change, sub: review.bestMonth.label, color: 'var(--up)', signed: true },
          review.worstMonth && { label: 'Toughest month', value: review.worstMonth.change, sub: review.worstMonth.label, color: review.worstMonth.change < 0 ? 'var(--down)' : 'var(--ink-3)', signed: true },
        ].filter(Boolean).map(c => (
          <div key={c.label} className="card" style={{ padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{c.label}</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: c.color, marginTop: 4 }}>
              {c.signed && c.value >= 0 ? '+' : ''}{fmtBase(c.value, ccy, { compact: true })}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Month-by-month change bars */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Month by month</div>
        <div
          role="img"
          aria-label={`Month-by-month net worth change: ${review.months.map(m => `${m.label} ${m.change >= 0 ? 'up' : 'down'} ${fmtBase(Math.abs(m.change), ccy, { compact: true })}`).join(', ')}`}
          style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 130 }}
        >
          {review.months.map(m => {
            const positive = m.change >= 0;
            const h = (Math.abs(m.change) / barMax) * 96;
            const tip = `${m.label}: ${positive ? '+' : ''}${fmtBase(m.change, ccy, { compact: true })} · closed at ${fmtBase(m.endNetWorth, ccy, { compact: true })}`;
            return (
              <div key={m.ym} title={tip} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0 }}>
                <div style={{
                  width: '100%', maxWidth: 38, height: Math.max(h, 2), borderRadius: '3px 3px 0 0',
                  background: positive ? 'var(--up)' : 'var(--down)', opacity: 0.78,
                  transition: 'height 240ms cubic-bezier(0.23,1,0.32,1)',
                }} />
                <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ fontSize: 10, marginTop: 10 }}>
          Each bar is the change in net worth across that month's recorded snapshots. Hover for exact values.
        </div>
      </div>

      {/* The full-year line */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>The whole year</div>
        <AreaChart
          data={review.months.map(m => m.endNetWorth)}
          labels={review.months.map(m => m.label)}
          w={640} h={130} responsive
          stroke={accent} accent={accent}
          formatValue={(v) => fmtBase(v, ccy, { compact: true })}
          ariaLabel={`Net worth month-end values over the past year, ${up ? 'up' : 'down'} ${fmtBase(Math.abs(review.change), ccy, { compact: true })} overall.`}
        />
      </div>
    </div>
  );
}
