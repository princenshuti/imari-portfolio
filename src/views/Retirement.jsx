import { useState, useMemo } from 'react';
import { fmtBase } from '../data.js';
import { projectPension, RETIREMENT_CONFIG, RSSB_RATE_SCHEDULE, statutoryRate } from '../engine/retirement/index.js';

// Surfaces src/engine/retirement/index.js. Inputs persist to profile.retirement
// so re-opening the view shows the user's last setup. Modeled, never a guarantee.
export default function RetirementView({ state, dispatch }) {
  const { profile } = state;
  const ccy = profile.displayCurrency || 'RWF';
  const saved = profile.retirement || {};

  const [currentAge, setCurrentAge] = useState(saved.currentAge ?? '');
  const [retirementAge, setRetirementAge] = useState(saved.retirementAge ?? 60);
  const [annualSalary, setAnnualSalary] = useState(saved.annualSalary ?? '');
  const [contributionsToDate, setContributionsToDate] = useState(saved.contributionsToDate ?? '');
  const [monthlyContribution, setMonthlyContribution] = useState(saved.monthlyContribution ?? '');
  const [employerMatch, setEmployerMatch] = useState(saved.employerMatch ?? '');
  const [realReturnPct, setRealReturnPct] = useState(saved.realReturnPct ?? RETIREMENT_CONFIG.defaultRealReturnPct);

  const input = useMemo(() => ({
    currentAge: +currentAge || null,
    retirementAge: +retirementAge || 60,
    annualSalary: +annualSalary || 0,
    contributionsToDate: +contributionsToDate || 0,
    monthlyContribution: +monthlyContribution || 0,
    employerMatch: +employerMatch || 0,
    realReturnPct: +realReturnPct || RETIREMENT_CONFIG.defaultRealReturnPct,
  }), [currentAge, retirementAge, annualSalary, contributionsToDate, monthlyContribution, employerMatch, realReturnPct]);

  const result = useMemo(() => projectPension(input), [input]);

  const persist = () => {
    dispatch({ type: 'setProfile', patch: { retirement: input } });
  };

  // Statutory rate context — what the user actually pays today
  const thisYear = new Date().getFullYear();
  const currentStatRate = statutoryRate(thisYear);
  const nextStep = RSSB_RATE_SCHEDULE.find(s => s.fromYear > thisYear);

  const numInput = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, width: '100%' };

  // Readiness severity → Cost-of-Absence framing
  const readiness = result?.readiness;
  let coa = null;
  if (readiness != null && input.currentAge) {
    if (readiness < 50) {
      coa = { sev: 'critical', headline: 'Your pension is on track to cover less than half of a comfortable retirement.',
        body: `Replacing ${result.replacementRatio?.toFixed(0)}% of income at ${input.retirementAge} (target: ${RETIREMENT_CONFIG.replacementTargetPct}%). Add monthly Ejo Heza to close the gap.` };
    } else if (readiness < 80) {
      coa = { sev: 'warning', headline: 'Pension is on track but below the comfort threshold.',
        body: `Replacing ${result.replacementRatio?.toFixed(0)}% — adding even RWF 10k/month between now and ${input.retirementAge} compounds materially.` };
    } else {
      coa = { sev: 'info', headline: 'Pension is on track to a comfortable replacement.',
        body: `On the modeled assumptions, you replace ${result.replacementRatio?.toFixed(0)}% of working income.` };
    }
  }

  const sevColor = (sev) => sev === 'critical' ? 'var(--down)' : sev === 'warning' ? 'var(--gold)' : 'var(--sky)';

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>A modeled projection grounded in the statutory schedule — never a guarantee.</div>

      {/* Statutory context strip */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline' }}>
        <div>
          <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Statutory rate {thisYear}</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}>{currentStatRate}%</div>
        </div>
        {nextStep && (
          <div>
            <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Next step</div>
            <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{nextStep.totalRatePct}% from {nextStep.fromYear}</div>
          </div>
        )}
        <div className="muted" style={{ fontSize: 11, marginLeft: 'auto', maxWidth: 340 }}>
          Source: {RETIREMENT_CONFIG.asOf}. Replacement target: {RETIREMENT_CONFIG.replacementTargetPct}%. Drawdown over {RETIREMENT_CONFIG.yearsInRetirement} years.
        </div>
      </div>

      {/* Inputs */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 10 }}>
          <div className="font-serif" style={{ fontSize: 16 }}>Your situation</div>
          <button onClick={persist} className="btn btn-ghost btn-sm" type="button" aria-label="Save retirement inputs to your profile">Save inputs</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Current age</span>
            <input type="number" min="16" max="90" value={currentAge} onChange={e => setCurrentAge(e.target.value)} style={numInput} />
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Retirement age</span>
            <select value={retirementAge} onChange={e => setRetirementAge(+e.target.value)} style={numInput}>
              {RETIREMENT_CONFIG.retirementAges.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Annual salary ({ccy})</span>
            <input type="number" min="0" value={annualSalary} onChange={e => setAnnualSalary(e.target.value)} style={numInput} />
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Contributions to date ({ccy})</span>
            <input type="number" min="0" value={contributionsToDate} onChange={e => setContributionsToDate(e.target.value)} style={numInput} />
            <span className="muted" style={{ fontSize: 10 }}>Total in RSSB + Ejo Heza today</span>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Monthly contribution ({ccy})</span>
            <input type="number" min="0" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} style={numInput} />
            <span className="muted" style={{ fontSize: 10 }}>Your share — RSSB + voluntary</span>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Employer match ({ccy}/mo)</span>
            <input type="number" min="0" value={employerMatch} onChange={e => setEmployerMatch(e.target.value)} style={numInput} />
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Real return %/yr</span>
            <input type="number" min="0" max="15" step="0.5" value={realReturnPct} onChange={e => setRealReturnPct(e.target.value)} style={numInput} />
            <span className="muted" style={{ fontSize: 10 }}>Above-inflation pension growth</span>
          </label>
        </div>
      </div>

      {/* Results */}
      {result && input.currentAge ? (
        <>
          {coa && (
            <div role={coa.sev === 'critical' ? 'alert' : 'status'} style={{
              padding: '14px 16px', borderRadius: 12, marginBottom: 14,
              background: 'var(--bg-2)', border: `1px solid ${sevColor(coa.sev)}`,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 18, color: sevColor(coa.sev), fontWeight: 700, flexShrink: 0 }}>
                {coa.sev === 'critical' ? '⚠' : coa.sev === 'warning' ? '!' : 'i'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{coa.headline}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{coa.body}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Years to retirement</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{result.years}</div>
            </div>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Projected pot at {input.retirementAge}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)', marginTop: 4 }}>{fmtBase(result.projectedPot, ccy, { compact: true })}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>In today's purchasing power (real return)</div>
            </div>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Monthly pension</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{fmtBase(result.monthlyPension, ccy, { compact: true })}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>Annuitised over {RETIREMENT_CONFIG.yearsInRetirement} years</div>
            </div>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Replacement ratio</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: result.replacementRatio >= RETIREMENT_CONFIG.replacementTargetPct ? 'var(--up)' : 'var(--down)', marginTop: 4 }}>
                {result.replacementRatio != null ? `${result.replacementRatio.toFixed(0)}%` : '—'}
              </div>
              <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>vs target {RETIREMENT_CONFIG.replacementTargetPct}%</div>
            </div>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Readiness score</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: readiness >= 80 ? 'var(--up)' : readiness >= 50 ? 'var(--gold)' : 'var(--down)', marginTop: 4 }}>
                {readiness != null ? `${readiness}` : '—'}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-3)' }}>/100</span>
              </div>
              <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>Floored to never overstate</div>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: '20px 22px', textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>Enter your current age to see a projection.</div>
        </div>
      )}

      <div className="muted" style={{ fontSize: 10.5, marginTop: 16, lineHeight: 1.5, maxWidth: 680 }}>
        Modeled estimate using the RSSB statutory rate schedule and your inputs. The replacement ratio compares the annuitised pension against your current annual salary — actual returns and policy may differ. Not professional financial advice.
      </div>
    </div>
  );
}
