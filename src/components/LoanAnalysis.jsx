/**
 * LoanAnalysis — inline expander revealing the math of a liability.
 *
 * Closes UX review #33 (amortisation schedule + projected interest + payoff
 * calculator) in a way that stays inside the existing liability row layout —
 * no modal, no separate page, no library. Native <details> handles open/close
 * keyboard accessibly; React only manages the optional "extra payment" input.
 *
 * Math lives in services/finance.js so this component stays presentational.
 */
import { useMemo, useState } from 'react';
import { fmt, fmtBase } from '../data.js';
import { monthlyPayment, totalInterest, effectiveAPR, monthsToPayoff, amortizationRows } from '../services/finance.js';

function monthsBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start), b = new Date(end);
  return Math.max(0, Math.round((b - a) / (30.4375 * 24 * 3600 * 1000)));
}

function addMonths(date, m) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
}

export default function LoanAnalysis({ liability, displayCurrency }) {
  const [extra, setExtra] = useState('');
  const cur = liability.currency || 'RWF';
  const rate = Number(liability.interestRate) || 0;

  // Term: prefer remaining months (today → endDate); fall back to original term.
  const today = new Date();
  const totalTerm = monthsBetween(liability.startDate, liability.endDate);
  const remainingTerm = liability.endDate
    ? Math.max(0, monthsBetween(today.toISOString().slice(0, 10), liability.endDate))
    : totalTerm;

  // Amortise the *remaining* balance over the *remaining* term — the only view
  // that's actually useful to the user today.
  const principal = Number(liability.remainingAmount) || 0;
  const term = remainingTerm || totalTerm;

  const base = useMemo(() => {
    const pmt   = monthlyPayment(principal, rate, term);
    const totI  = totalInterest(principal, rate, term);
    const apr   = effectiveAPR(rate);
    return { pmt, totI, apr };
  }, [principal, rate, term]);

  const extraNum = Number(extra) || 0;
  const proj = useMemo(() => {
    if (extraNum <= 0) return null;
    const newPmt = base.pmt + extraNum;
    const newMonths = monthsToPayoff(principal, rate, newPmt);
    if (!newMonths) return null;
    const newInterest = Math.max(0, newPmt * newMonths - principal);
    return {
      months:        newMonths,
      monthsSaved:   term - newMonths,
      interest:      newInterest,
      interestSaved: base.totI - newInterest,
      payoffDate:    addMonths(today, newMonths),
    };
  }, [extraNum, base.pmt, base.totI, principal, rate, term]);

  const rows = useMemo(() => amortizationRows(principal, rate, term, extraNum, 6), [principal, rate, term, extraNum]);

  if (principal <= 0 || term <= 0) return null;

  return (
    <details className="loan-analysis">
      <summary>
        <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>
          Monthly payment <strong className="num" style={{ color: 'var(--ink)' }}>{fmt(base.pmt, cur, { compact: true })}</strong>
          {'  ·  '}
          Effective APR <strong style={{ color: 'var(--ink)' }}>{base.apr.toFixed(2)}%</strong>
          {'  ·  '}
          Total interest <strong className="num" style={{ color: 'var(--down)' }}>{fmt(base.totI, cur, { compact: true })}</strong>
        </span>
        <span className="loan-analysis-toggle" aria-hidden="true">›</span>
      </summary>

      <div style={{ padding: '12px 0 4px', display: 'grid', gap: 14 }}>
        {/* Payoff calculator */}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor={`extra-${liability.id}`} style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            Pay extra
          </label>
          <input
            id={`extra-${liability.id}`}
            type="number" inputMode="decimal" min="0" step="any"
            value={extra} onChange={e => setExtra(e.target.value)}
            placeholder="0"
            style={{
              width: 100, padding: '5px 8px', borderRadius: 6,
              border: '1px solid var(--line-strong)', background: 'var(--paper-2)',
              fontSize: 12.5, fontFamily: 'var(--mono, monospace)', color: 'var(--ink)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{cur}/month</span>
          {proj && (
            <span style={{ fontSize: 11.5, color: 'var(--up)', marginLeft: 'auto' }}>
              Payoff in <strong>{proj.months}mo</strong>
              {proj.monthsSaved > 0 && ` (saves ${proj.monthsSaved}mo, ${fmt(proj.interestSaved, cur, { compact: true })} interest)`}
            </span>
          )}
          {extraNum > 0 && !proj && (
            <span style={{ fontSize: 11, color: 'var(--down)', marginLeft: 'auto' }}>
              Payment too small to cover interest — increase
            </span>
          )}
        </div>

        {/* Schedule preview */}
        <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 9.5 }}>
              <th style={{ textAlign: 'left',  padding: '4px 0' }}>Month</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Payment</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Interest</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Principal</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Balance</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map(r => (
              <tr key={r.month} style={{ borderTop: '0.5px solid var(--line-soft)' }}>
                <td style={{ padding: '4px 0', color: 'var(--ink-3)' }}>{r.month}</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{fmt(r.payment, cur, { compact: true })}</td>
                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--down)' }}>{fmt(r.interest, cur, { compact: true })}</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{fmt(r.principal, cur, { compact: true })}</td>
                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--ink-2)' }}>{fmt(r.balance, cur, { compact: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted" style={{ fontSize: 10, marginTop: -4 }}>
          First 6 months shown — {term} total. Math is illustrative; your actual schedule may differ if the lender uses a different compounding convention.
        </div>
      </div>
    </details>
  );
}
