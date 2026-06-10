import { useState, useMemo } from 'react';
import { fmtBase, fromBase } from '../data.js';
import { buildMonthlyReport } from '../engine/monthlyReport.js';
import { downloadCSV } from '../services/download.js';

// F7 — auto-generated monthly report, same printable shape as BalanceSheet.
// Every number is derived from entered data; the month picker walks history.
export default function ReportsView({ state }) {
  const { cashflows = [], snapshots = [], profile } = state;
  const ccy = profile.displayCurrency || 'RWF';
  const [monthOffset, setMonthOffset] = useState(0);

  const report = useMemo(
    () => buildMonthlyReport({ cashflows, snapshots, budgets: state.budgets || {}, monthOffset }),
    [cashflows, snapshots, state.budgets, monthOffset]
  );

  const monthLabel = new Date(report.year, report.monthIdx, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const show = (rwf) => fmtBase(rwf, ccy, { compact: false });
  const showC = (rwf) => fmtBase(rwf, ccy, { compact: true });

  const exportCSV = () => {
    const conv = (rwf) => Math.round(fromBase(rwf, ccy));
    const rows = [
      ['Imari monthly report', monthLabel, `valued in ${ccy}`],
      [],
      ['Income', conv(report.income)],
      ['Expenses', conv(report.expense)],
      ['Net', conv(report.net)],
      ['Savings rate %', report.savingsRate != null ? report.savingsRate.toFixed(1) : ''],
      [],
      ['Expenses by category'],
      ...report.expenseCategories.map(c => [c.label, conv(c.amount), `${c.share.toFixed(1)}%`]),
    ];
    if (report.netWorth) {
      rows.push([], ['Net worth start', conv(report.netWorth.start)], ['Net worth end', conv(report.netWorth.end)], ['Net worth change', conv(report.netWorth.change)]);
    }
    downloadCSV(rows, `imari-report-${report.year}-${String(report.monthIdx + 1).padStart(2, '0')}.csv`);
  };

  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 8px' };
  const hasData = report.income > 0 || report.expense > 0;

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }} data-noprint>
        <div>
          <div className="font-serif" style={{ fontSize: 26 }}>Monthly report</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Auto-generated from your entries — nothing typed, nothing invented.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => setMonthOffset(m => m + 1)} className="btn btn-ghost" style={{ padding: '7px 14px' }}>‹ Prev</button>
          <div style={{ padding: '7px 14px', borderRadius: 'var(--r-md)', background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 600 }}>{monthLabel}</div>
          <button onClick={() => setMonthOffset(m => Math.max(0, m - 1))} disabled={monthOffset === 0} className="btn btn-ghost" style={{ padding: '7px 14px' }}>Next ›</button>
          <button onClick={exportCSV} className="btn btn-ghost">↓ CSV</button>
          <button onClick={() => window.print()} className="btn btn-primary">⎙ Print / Save PDF</button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px 28px', maxWidth: 820 }}>
        <div style={{ marginBottom: 20 }}>
          <div className="font-serif" style={{ fontSize: 22 }}>Money report — {monthLabel}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {profile.name ? `${profile.name} · ` : ''}valued in {ccy}
          </div>
        </div>

        {!hasData ? (
          <div className="muted" style={{ fontSize: 13, padding: '20px 0', lineHeight: 1.6 }}>
            No entries counted toward {monthLabel}. A month with no records is a month
            you can't learn from — add cash-flow entries or import a statement.
          </div>
        ) : (
          <>
            {/* The month in four numbers */}
            <p style={sectionLabel}>The month in numbers</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Income', value: showC(report.income), color: 'var(--up)', delta: report.incomeDelta },
                { label: 'Expenses', value: showC(report.expense), color: 'var(--down)', delta: report.expenseDelta, deltaBadIfUp: true },
                { label: 'Net', value: `${report.net >= 0 ? '+' : ''}${showC(report.net)}`, color: report.net >= 0 ? 'var(--up)' : 'var(--down)' },
                { label: 'Savings rate', value: report.savingsRate != null ? `${report.savingsRate.toFixed(1)}%` : '—', color: (report.savingsRate || 0) >= 20 ? 'var(--up)' : 'var(--gold)' },
              ].map(c => (
                <div key={c.label} style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8 }}>
                  <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{c.label}</div>
                  <div className="num" style={{ fontSize: 17, fontWeight: 700, color: c.color, marginTop: 2 }}>{c.value}</div>
                  {c.delta != null && c.delta !== 0 && (
                    <div className="num" style={{ fontSize: 10, marginTop: 2, color: (c.delta > 0) === !!c.deltaBadIfUp ? 'var(--down)' : 'var(--up)' }}>
                      {c.delta > 0 ? '▲' : '▼'} {showC(Math.abs(c.delta))} vs prior month
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Where it went */}
            <p style={sectionLabel}>Where the money went</p>
            {report.expenseCategories.map(c => (
              <div key={c.category} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
                <span style={{ color: 'var(--ink-2)' }}>{c.label}</span>
                <span className="num" style={{ fontWeight: 600 }}>
                  {show(c.amount)} <span className="muted" style={{ fontSize: 10 }}>({c.share.toFixed(0)}%)</span>
                </span>
              </div>
            ))}

            {/* Largest one-offs */}
            {report.topExpenses.length > 0 && (
              <>
                <p style={{ ...sectionLabel, marginTop: 18 }}>Largest one-off expenses</p>
                {report.topExpenses.map((e, i) => (
                  <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5, gap: 12 }}>
                    <span style={{ color: 'var(--ink-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description} <span className="muted" style={{ fontSize: 10 }}>· {e.label}</span>
                    </span>
                    <span className="num" style={{ fontWeight: 600, flexShrink: 0 }}>{show(e.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {/* Budgets */}
            {report.budgets.rows.length > 0 && (
              <>
                <p style={{ ...sectionLabel, marginTop: 18 }}>Budget envelopes</p>
                {report.budgets.rows.map(r => (
                  <div key={r.category} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink-2)' }}>{r.label}</span>
                    <span className="num" style={{ fontWeight: 600, color: r.over ? 'var(--down)' : 'var(--up)' }}>
                      {showC(r.spent)} / {showC(r.budget)}{r.over ? ` · ${showC(r.spent - r.budget)} over` : ''}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Net-worth motion */}
            {report.netWorth && (
              <div className="row" style={{ justifyContent: 'space-between', padding: '14px 16px', marginTop: 18, borderRadius: 'var(--r-md)', background: 'var(--brand-softer)', border: '0.5px solid var(--brand-soft)', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span className="font-serif" style={{ fontSize: 16 }}>Net worth this month</span>
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                    {report.netWorth.startDate} → {report.netWorth.endDate}
                    {report.netWorth.includesSynthetic && ' · includes seeded history'}
                  </div>
                </div>
                <span className="num" style={{ fontSize: 18, fontWeight: 700, color: report.netWorth.change >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {report.netWorth.change >= 0 ? '+' : ''}{showC(report.netWorth.change)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
