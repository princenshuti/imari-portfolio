import { useEffect, useRef, useState } from 'react';
import { useT, SUPPORTED_LOCALES } from '../contexts/I18nContext.jsx';
import { useMarket } from '../contexts/MarketContext.jsx';
import { REFERENCE } from '../engine/insights/refs.js';
import { fmtNum } from '../data.js';
import { MaxventuresWordmark } from '../components/ImariMark.jsx';

// Inline SVG icon set — Heroicons-style outline at 24x24
function Icon({ name }) {
  // Decorative — every icon sits next to its own text label.
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false' };
  switch (name) {
    case 'wallet': return (<svg {...common}><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Zm0 0a2 2 0 0 1 2-2h12"/><circle cx="17" cy="13" r="1.2" fill="currentColor"/></svg>);
    case 'cube': return (<svg {...common}><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="m4 7 8 4 8-4"/><path d="M12 21V11"/></svg>);
    case 'target': return (<svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>);
    case 'flow': return (<svg {...common}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>);
    case 'spark': return (<svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.5"/></svg>);
    case 'doc': return (<svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>);
    case 'arrow': return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 5l7 7-7 7"/></svg>);
    case 'shield': return (<svg {...common}><path d="M12 3 4 6v6c0 4.5 3.2 8.5 8 9 4.8-.5 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2.2 2.2L15 10.5"/></svg>);
    case 'lock': return (<svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.1" fill="currentColor"/></svg>);
    case 'key-off': return (<svg {...common}><path d="M3 3l18 18"/><circle cx="8" cy="14" r="3.5"/><path d="m10.5 11.5 7-7M14 8l2 2M16 6l2 2"/></svg>);
    case 'download': return (<svg {...common}><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>);
    case 'eye': return (<svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>);
    case 'scatter': return (<svg {...common}><circle cx="6" cy="7" r="1.5"/><circle cx="14" cy="5" r="1.5"/><circle cx="9" cy="13" r="1.5"/><circle cx="18" cy="11" r="1.5"/><circle cx="13" cy="18" r="1.5"/><circle cx="5" cy="17" r="1.5"/></svg>);
    case 'calc': return (<svg {...common}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 19h2M12 19h2"/></svg>);
    case 'clock': return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case 'scales': return (<svg {...common}><path d="M12 3v18M5 21h14M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7Zm14 0-3 7a4 4 0 0 0 6 0l-3-7Z"/></svg>);
    case 'sms': return (<svg {...common}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>);
    case 'chat': return (<svg {...common}><path d="M7.5 8h9M7.5 12h6"/><path d="M5 4h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/></svg>);
    case 'umbrella': return (<svg {...common}><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z"/><path d="M12 12v6a2.5 2.5 0 0 0 5 0"/></svg>);
    case 'forecast': return (<svg {...common}><path d="M3 3v18h18"/><path d="m6 15 4-5 3 3 5-7"/><path d="M18 6h3v3"/></svg>);
    case 'coins': return (<svg {...common}><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3"/><path d="M3 12v5c0 1.7 2.7 3 6 3"/><circle cx="16" cy="15" r="5"/></svg>);
    case 'map': return (<svg {...common}><path d="m9 4 6 2 6-2v14l-6 2-6-2-6 2V6l6-2Z"/><path d="M9 4v14M15 6v14"/></svg>);
    case 'globe': return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>);
    case 'refresh': return (<svg {...common}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>);
    case 'sheet': return (<svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/></svg>);
    case 'sun': return (<svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>);
    case 'moon': return (<svg {...common}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/></svg>);
    default: return null;
  }
}

// ── The Cost-of-Absence section — Imari's signature idea ──────────────────
const COST_HEAD = {
  eyebrow: 'The cost of looking away',
  title: 'Your money is doing something today. Imari tells you what.',
  sub: 'Most apps store your numbers. Imari surfaces what ignoring them costs you — in francs, days and risk — drawn only from your own data. Never invented fear, only what is already true.',
};
// Illustrative scenarios, but every rate comes from the same REFERENCE the
// insight engine computes with — so the landing can never drift from the
// product. (RWF 4.2M × tBillYieldPct / 12 ≈ 35k/mo at the 10% reference.)
const IDLE_EXAMPLE_RWF = 4_200_000;
const idlePerMonth = Math.round(IDLE_EXAMPLE_RWF * REFERENCE.tBillYieldPct / 100 / 12 / 1000);
// Flat nominal net worth after one year of CPI: real ≈ −cpi/(1+cpi).
const flatRealPct = (REFERENCE.cpiYoYPct / (1 + REFERENCE.cpiYoYPct / 100)).toFixed(1);
const COSTS = [
  { sev: 'critical', stat: 'RWF 12,000', label: 'Late-levy penalty, avoided', body: 'An RRA deadline you would have missed — surfaced six days early, before the penalty starts.' },
  { sev: 'warning', stat: `RWF ${idlePerMonth},000 / mo`, label: 'Idle cash, not earning', body: `RWF 4.2M resting in MoMo while BNR T-bills reference ~${REFERENCE.tBillYieldPct}%. A running counter of what you forgo.` },
  { sev: 'info', stat: `−${flatRealPct}% in real terms`, label: 'Net worth "flat" in RWF', body: `Flat in francs still shrinks after ${REFERENCE.cpiYoYPct}% inflation. Imari shows the real number, not the comfortable one.` },
  { sev: 'warning', stat: '38% of income', label: 'Your pension at 60', body: 'Below a comfortable 60% replacement. Imari shows the gap — and what an extra RWF 10k/month to Ejo Heza closes.' },
];

// ── Feature set — everything Imari now does ───────────────────────────────
const FEATURES = [
  { icon: 'spark', accent: 'var(--brand)', title: 'An insight engine, not a ledger',
    desc: 'Runway, idle cash, concentration, tax exposure, real-vs-nominal drift — computed from your data and ranked by what it costs you to ignore. Computed and tested, to the franc.' },
  { icon: 'sheet', accent: 'var(--gold)', title: 'MoMo & bank statements, imported',
    desc: 'Upload your MTN MoMo or Airtel Money statement — or a bank CSV from BK, Equity, I&M — and Imari parses every line, auto-categorises and lets you confirm in seconds.' },
  { icon: 'umbrella', accent: 'var(--brand)', title: 'Your pension, finally counted',
    desc: 'RSSB and Ejo Heza folded into your net worth, with a readiness score and the share of income you are on track to replace at 60.' },
  { icon: 'forecast', accent: 'var(--plum)', title: 'Fast-forward your net worth',
    desc: 'Project 1, 5, 10 and 20 years with a low–high band you can trust. See the cost of today\'s habits — and what one more RWF 50k a month changes.' },
  { icon: 'coins', accent: 'var(--gold)', title: 'Idle cash has a price tag',
    desc: 'A live counter of the yield you forgo versus BNR Treasury bills, with a hand-off to a CMA-licensed broker. No trades, no money moved — the decision is always yours.' },
  { icon: 'doc', accent: 'var(--clay)', title: 'RRA, handled all year',
    desc: 'Fixed Asset Tax, Vehicle Road Levy, Capital Gains and Withholding — plus EBM VAT input credit reconciled from certified invoices. A clean pack, ready by 31 March.' },
  { icon: 'map', accent: 'var(--brand)', title: 'Land anchored to its UPI',
    desc: 'Tie a plot to its Unique Parcel Identifier and e-title. Imari prompts a revaluation when the value drifts and tracks Fixed Asset Tax per parcel.' },
  { icon: 'sheet', accent: 'var(--sky)', title: 'A balance sheet in one click',
    desc: 'A dated, lender-ready statement of net worth — print to PDF or export a clean CSV for your accountant. The total always matches your dashboard, to the franc.' },
  { icon: 'target', accent: 'var(--clay)', title: 'Goals, debts and a lockbox',
    desc: 'Track loans beside the house you are saving for. Lock a goal to a real BNR T-bill auction — commitment with an instrument behind it, not motivational fluff.' },
  { icon: 'globe', accent: 'var(--plum)', title: 'Built for the diaspora',
    desc: 'Watching your Rwanda assets from abroad? Read-only trustee access, a twice-monthly “State of Your Assets” statement, and first-class USD / EUR / GBP display.' },
];

// ── The moat — uniquely Rwandan rails ─────────────────────────────────────
const RWANDA_HEAD = {
  eyebrow: 'Built for Rwanda, not adapted to it',
  title: 'The rails a global app cannot reach',
  sub: 'Imari speaks to the institutions you actually use. That is the moat — and why the numbers are right.',
};
const RWANDA = [
  { icon: 'sms', name: 'MTN MoMo & Airtel Money', line: 'Statements parsed line by line and auto-categorised.' },
  { icon: 'refresh', name: 'BNR reference rates', line: 'Official FX, refreshed daily — never a guessed rate.' },
  { icon: 'doc', name: 'RRA tax rules', line: 'Levies, capital gains and withholding under Rwandan law.' },
  { icon: 'umbrella', name: 'RSSB & Ejo Heza', line: 'Both pensions counted inside your net worth.' },
  { icon: 'map', name: 'UPI land titles', line: 'Every plot anchored to its Unique Parcel Identifier.' },
  { icon: 'flow', name: 'RSE shares & T-bonds', line: 'Local instruments priced as first-class assets.' },
];

// Marquee strip under the hero — the "client logos" of a Rwandan wealth
// tracker are the rails it is wired into.
const RAILS = ['MTN MoMo', 'Airtel Money', 'BNR', 'RRA', 'RSSB', 'Ejo Heza', 'RSE', 'UPI'];

// ── AI Advisor showcase — mirrors the real Advisor view ───────────────────
const ADVISOR_HEAD = {
  eyebrow: 'AI-ready advisory',
  title: 'Every number computed. Every answer explained.',
  sub: 'Imari computes every figure — concentration, runway, tax, idle cash — from your data and today\'s BNR market pulse. The AI never invents a number; it explains the ones the engine already proved, and answers what you ask next.',
};
const ADVISOR_CHIPS = [
  'Build a 12-month plan to grow my net worth 25%.',
  'If I save RWF 200k/month, when do I hit 50M?',
  'What\'s my approximate annual RRA tax exposure?',
];

// ── Trust & honesty ───────────────────────────────────────────────────────
// Security copy describes outcomes, never mechanisms — no stack, vendor or
// architecture names here; that is both marketing policy and attack-surface
// hygiene.
const TRUST = [
  { icon: 'key-off', title: 'No bank passwords. Not ever.',
    desc: 'Imari never asks for your bank or MoMo login. There are no banking credentials here to phish, leak or steal — the most secure password is the one we never have.' },
  { icon: 'lock', title: 'Encrypted in transit and at rest',
    desc: 'Your data is encrypted on every connection and on every disk it touches, and isolated to your account alone. Nobody — not other users, not our team — browses your portfolio.' },
  { icon: 'refresh', title: 'Every number is dated',
    desc: 'Imari shows how fresh each figure is and flags what has gone stale. A confidently-wrong number erodes trust faster than no number — so we never hide the date.' },
  { icon: 'eye', title: 'You share on your terms',
    desc: 'Invite a spouse, family member or accountant as a read-only viewer. They see the numbers; they cannot change them. Revoke access in a single click, any time.' },
  { icon: 'chat', wide: true, title: 'AI with a closed door',
    desc: 'Conversations with your advisor stay between you and Imari. Your financial data is never used to train AI models, and never sold. Full stop.' },
];

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'One email, one password, eight seconds. Your private portfolio is provisioned on the spot — free core, always.' },
  { n: '02', title: 'Add what you own', desc: 'Accounts, assets, debts and goals, in RWF or USD. The first hour gives you the full picture; bank and MoMo statement imports keep it current after that.' },
  { n: '03', title: 'Let Imari watch it', desc: 'Daily snapshots, FX updates, tax estimates and the insight engine run quietly. You check in when you want to know — and Imari taps you when it matters.' },
];

// Severity accents are fixed (not theme tokens): the landing is always a
// midnight surface, so these pastels are tuned for it (all ≥ 7:1).
const SEV = {
  critical: { color: '#F2A096', label: 'Critical' },
  warning: { color: '#EAC96E', label: 'Warning' },
  info: { color: '#9CC2EC', label: 'Heads up' },
};

// Count-up for the mock net-worth figure. Resolves instantly under
// prefers-reduced-motion — the number must never be unreadable.
function useCountUp(target, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Miniature live replica of the real Dashboard (labels match Dashboard.jsx):
// net worth + delta pill, self-drawing chart with cost basis, KPI tiles.
const MOCK_LINE = 'M0,128 L24,120 L48,125 L72,106 L96,99 L120,105 L144,90 L168,95 L192,76 L216,83 L240,68 L264,75 L288,60 L312,66 L336,54 L360,60 L384,46 L408,53 L432,38 L456,45 L480,29 L504,37 L528,22 L548,28 L560,20';
// Tiles reconcile with each other: expenses ≈ RWF 1.1M/mo, so 8.4M cash is
// 7.6 months of runway and Investable = 8.4M − (3 × 1.1M buffer) ≈ 5.1M.
const MOCK_KPIS = [
  ['Cash in hand', 'RWF 8.4M', '7.6 months of expenses'],
  ['Tax estimate', 'RWF 412K', 'next deadline in 21 days'],
  ['Investable', 'RWF 5.1M', 'liquid minus 3-month buffer'],
];

function DashboardMock() {
  const nw = useCountUp(204);
  return (
    <div className="landing-mock">
      <div className="landing-mock-head">
        <div>
          <div className="landing-mock-label">{'Net worth'}</div>
          <div className="landing-mock-amount font-serif">RWF {nw}M</div>
          {/* 30 ÷ (204 − 30) = +17.2% — keep the arithmetic honest even in a mock */}
          <span className="landing-mock-delta num">▲ +RWF 30M (+17.2%) past 3M</span>
        </div>
        <div className="landing-mock-ranges num">
          {['1M', '3M', '6M', '1Y'].map(r => (
            <span key={r} className={r === '3M' ? 'is-active' : ''}>{r}</span>
          ))}
        </div>
      </div>
      <svg className="landing-mock-chart" viewBox="0 0 560 170" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lm-fill" x1="0" y1="0" x2="0" y2="1">
            {/* stop-color can't take var() as an attribute — set it via style
                so the fill follows the landing theme's brand green. */}
            <stop offset="0%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.30 }} />
            <stop offset="100%" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path className="landing-mock-area" d={`${MOCK_LINE} L560,170 L0,170 Z`} fill="url(#lm-fill)" />
        <path className="landing-mock-basis" d="M0,150 L560,116" />
        <path className="landing-mock-line" pathLength="1" d={MOCK_LINE} />
        <circle className="landing-mock-peak" cx="528" cy="22" r="3.5" />
      </svg>
      <div className="landing-mock-kpis">
        {MOCK_KPIS.map(([label, val, sub], i) => (
          <div key={label} className="landing-mock-kpi" style={{ '--reveal-delay': `${900 + i * 110}ms` }}>
            <div className="landing-mock-kpi-label">{label}</div>
            <div className="landing-mock-kpi-val num">{val}</div>
            <div className="landing-mock-kpi-sub">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The Advisor exchange, as it looks in the product: market pulse, a question,
// an engine-computed answer the AI phrased. The ✦ mark is the product's own
// AI glyph (see Advisor.jsx) — kept for authenticity.
function AdvisorMock() {
  // Same provenance as the real Advisor pulse (Advisor.jsx): live BNR buy/sell
  // when fetched, engine REFERENCE rates otherwise — never a hardcoded "live".
  const { market } = useMarket();
  const bnrUSD = market?.bnrRates?.USD;
  const pulse = [
    bnrUSD
      ? { label: 'USD/RWF (BNR)', value: `${fmtNum(bnrUSD.buy, 0)} / ${fmtNum(bnrUSD.sell, 0)}`, sub: `buy / sell · ${bnrUSD.date}`, live: true }
      : { label: 'USD/RWF', value: `≈ ${fmtNum(market?.usdRwf ?? 1300, 0)}`, sub: 'reference · BNR live loads shortly', live: false },
    { label: 'T-bill yield', value: `${REFERENCE.tBillYieldPct}%`, sub: 'BNR auction · reference', live: false },
    { label: 'Inflation (CPI)', value: `${REFERENCE.cpiYoYPct}%`, sub: 'NISR · reference', live: false },
  ];
  return (
    <div className="landing-advisor-mock" aria-hidden>
      <div className="landing-pulse">
        {pulse.map((p, i) => (
          <div key={p.label} className="landing-pulse-card" style={{ '--reveal-delay': `${i * 90}ms` }}>
            <div className="landing-pulse-top">
              <span className="landing-pulse-label">{p.label}</span>
              <span className={`landing-pulse-pill ${p.live ? 'is-live' : ''}`}>{p.live ? 'live' : 'ref'}</span>
            </div>
            <div className="landing-pulse-val num">{p.value}</div>
            <div className="landing-pulse-sub">{p.sub}</div>
          </div>
        ))}
      </div>
      <div className="landing-advisor-q">
        Am I too concentrated in any single asset?
      </div>
      <div className="landing-advisor-a">
        <span className="landing-advisor-sev">{'Warning'}</span>
        <div className="landing-advisor-headline font-serif">42% of your assets sit in one holding</div>
        <p>
          Your equity position is 42% of total assets — above the 25% concentration guide.
          A single shock would move 42% of your wealth at once; diversifying spreads that risk.
        </p>
        <div className="landing-advisor-cost num">{'Cost of absence: a 15% drawdown ≈ −RWF 12.8M'}</div>
        <span className="landing-advisor-action"><span aria-hidden>✦</span>{' Discuss this'}</span>
      </div>
      <div className="landing-advisor-note">
        Every figure computed by the engine — the AI only phrases it. Not professional advice.
      </div>
    </div>
  );
}

// 3D advisor showcase — Spline scene, loaded ONLY when the card scrolls near
// the viewport, and skipped entirely under reduced motion or data-saver.
// Costs ~0 KB until then: the runtime is a dynamic import, never in the
// main bundle, and the scene streams from Spline's CDN.
const SPLINE_SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';

function SplineShowcase() {
  const hostRef = useRef(null);
  const [SplineComp, setSplineComp] = useState(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')))
    ) {
      setSkipped(true);
      return undefined;
    }
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSkipped(true);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        import('@splinetool/react-spline')
          .then(m => setSplineComp(() => m.default))
          .catch(() => setSkipped(true));
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Decorative finale — when the environment can't afford it, it simply isn't there.
  if (skipped) return null;

  return (
    <section className="landing-section landing-section--spline">
      <div className="landing-spline-card" ref={hostRef}>
        <div className="landing-spline-copy">
          <span className="landing-section-eyebrow">{'Meet your advisor'}</span>
          <h2 className="font-serif landing-section-title">{'A money mind that never sleeps.'}</h2>
          <p className="landing-section-sub">
            {'Drag the scene. The advisor behind Imari watches your numbers the same way — always on, never tired, never guessing.'}
          </p>
        </div>
        <div className="landing-spline-stage" aria-hidden>
          {SplineComp
            ? <SplineComp scene={SPLINE_SCENE} />
            : <div className="landing-spline-poster" />}
        </div>
      </div>
    </section>
  );
}

export default function Landing({ onSignIn }) {
  const { t, locale, setLocale } = useT();
  const [scrolled, setScrolled] = useState(false);
  // Theme: the SAME key as the rest of the app (imari:theme), so a choice
  // made here follows the user through #login and every signed-in page.
  // With no explicit choice saved, the OS preference decides.
  const [theme, setTheme] = useState(() => {
    try {
      const pref = localStorage.getItem('imari:theme');
      if (pref === 'light' || pref === 'dark') return pref;
    } catch { /* private mode */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('imari:theme', next); } catch { /* private mode */ }
  };
  // Track live OS theme changes until the user makes an explicit choice;
  // also retire the old landing-only key from earlier builds.
  useEffect(() => {
    try { localStorage.removeItem('imari:landing-theme'); } catch { /* ignore */ }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      try {
        const pref = localStorage.getItem('imari:theme');
        if (pref === 'light' || pref === 'dark') return;
      } catch { /* fall through to OS value */ }
      setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-triggered reveal for [data-reveal] tiles (Cost cards, Rwanda rails).
  // The CSS animation is gated on .is-in; without an observer it used to play
  // on mount, below the fold, where nobody saw it. If IO is unavailable the
  // class is added immediately so content can never strand hidden.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!els.length) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach(el => el.classList.add('is-in'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Hash is the single source of truth — App listens on hashchange.
  const goLogin = (mode = 'signin') => { window.location.hash = mode === 'signup' ? 'signup' : 'login'; };
  const goSignup = () => goLogin('signup');
  const goTop = (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className={`landing-root landing-root--${theme}`}>
      {/* Nav */}
      <nav className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`} data-noprint>
        <div className="landing-nav-inner">
          <a href="#" onClick={goTop} className="landing-brand" aria-label="Imari home">
            <span className="landing-brand-mark" aria-hidden>●</span>
            <span className="landing-brand-name font-serif">Imari</span>
          </a>
          <div className="landing-nav-actions">
            <a href="#cost" className="landing-link">{COST_HEAD.eyebrow}</a>
            <a href="#advisor" className="landing-link">{'AI Advisor'}</a>
            <a href="#features" className="landing-link">{t('landing.nav.features')}</a>
            <a href="#security" className="landing-link">{t('landing.nav.security')}</a>
            <select
              value={locale}
              onChange={e => setLocale(e.target.value)}
              className="landing-lang"
              aria-label={t('landing.nav.language')}
              title={t('landing.nav.language')}
            >
              {SUPPORTED_LOCALES.map(loc => (
                <option key={loc.code} value={loc.code}>{loc.nativeName}</option>
              ))}
            </select>
            <button
              onClick={toggleTheme}
              className="landing-theme-toggle"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button onClick={() => goLogin('signin')} className="btn btn-primary landing-cta-sm">{t('landing.nav.signin')}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="landing-hero">
        <div className="landing-hero-inner">
          <span className="landing-eyebrow">
            <span className="landing-dot" aria-hidden /> {t('landing.hero.eyebrow')}
          </span>
          <h1 className="landing-headline font-serif">
            {t('landing.hero.headline_1')}<br />
            <em className="landing-headline-em">{t('landing.hero.headline_2')}</em>
          </h1>
          <p className="landing-sub">{t('landing.hero.sub')}</p>
          <div className="landing-hero-ctas">
            <button onClick={goSignup} className="btn btn-primary landing-cta">
              {t('landing.hero.cta_primary')} <Icon name="arrow" />
            </button>
            <button onClick={() => goLogin('signin')} className="btn btn-ghost landing-cta-ghost">
              {t('landing.hero.cta_secondary')}
            </button>
          </div>
          <div className="landing-trust">
            <Icon name="shield" />
            <span>{t('landing.hero.trust')}</span>
          </div>
        </div>

        {/* Live miniature of the real dashboard — built in code so it moves:
            the chart draws, the number counts, the insight chip arrives. */}
        <div className="landing-preview" aria-hidden>
          <div className="landing-frame">
            <div className="landing-frame-bar">
              {['#E0635C', '#E5BC55', '#3FB889'].map(c => (
                <span key={c} className="landing-frame-dot" style={{ background: c }} />
              ))}
              <span className="num landing-frame-url">{'Imari · Dashboard'}</span>
            </div>
            <DashboardMock />
          </div>
          <div className="landing-preview-costchip">
            <span className="landing-preview-costglyph">!</span>
            {/* 5M × tBillYieldPct / 12 — same reference the engine computes with */}
            <span>{`RWF 5M idle — ~RWF ${Math.round(5_000_000 * REFERENCE.tBillYieldPct / 100 / 12 / 1000)}K/mo forgone vs T-bills`}</span>
          </div>
        </div>
      </header>

      {/* Rails marquee — institutional credibility, before any pitch */}
      <div className="landing-rails">
        <span className="landing-rails-label">{'Wired into the rails you already use'}</span>
        <div className="landing-rails-items">
          <div className="landing-rails-track">
            {[0, 1].map(dup => (
              <div key={dup} className="landing-rails-set" aria-hidden={dup === 1}>
                {RAILS.map(r => <span key={r} className="landing-rails-item num">{r}</span>)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost of Absence — the signature idea */}
      <section id="cost" className="landing-section landing-section--cost">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{COST_HEAD.eyebrow}</span>
          <h2 className="font-serif landing-section-title">{COST_HEAD.title}</h2>
          <p className="landing-section-sub">{COST_HEAD.sub}</p>
        </div>
        <div className="landing-costs">
          {COSTS.map((c, i) => {
            const s = SEV[c.sev];
            return (
              <article key={c.label} data-reveal className="landing-cost landing-reveal" style={{ '--reveal-delay': `${Math.min(i * 60, 220)}ms`, '--cost-accent': s.color }}>
                <span className="landing-cost-sev">
                  <span className="landing-cost-sev-dot" aria-hidden />
                  {s.label}
                </span>
                <div className="landing-cost-stat num">{c.stat}</div>
                <div className="landing-cost-label">{c.label}</div>
                <p className="landing-cost-desc">{c.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* AI Advisor — the brain behind the numbers */}
      <section id="advisor" className="landing-section landing-section--advisor">
        <div className="landing-advisor">
          <div className="landing-advisor-copy">
            <span className="landing-section-eyebrow">{ADVISOR_HEAD.eyebrow}</span>
            <h2 className="font-serif landing-section-title">{ADVISOR_HEAD.title}</h2>
            <p className="landing-section-sub">{ADVISOR_HEAD.sub}</p>
            <div className="landing-advisor-chiplist">
              {ADVISOR_CHIPS.map(q => (
                <span key={q} className="landing-advisor-chip">
                  <span className="landing-advisor-spark" aria-hidden>✦</span> {q}
                </span>
              ))}
            </div>
          </div>
          <AdvisorMock />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{t('landing.solution.eyebrow')}</span>
          <h2 className="font-serif landing-section-title">{t('landing.solution.title')}</h2>
          <p className="landing-section-sub">{t('landing.solution.sub')}</p>
        </div>
        <div className="landing-features">
          {FEATURES.map((f, i) => {
            // Bento rhythm: the two flagships open wide, the last two close wide.
            const wide = i <= 1 || i >= FEATURES.length - 2;
            return (
              <article key={f.title} className={`landing-feature${wide ? ' landing-feature--wide' : ''}`} style={{ '--feature-accent': f.accent, '--feature-delay': `${Math.min(i * 30, 210)}ms` }}>
                <div className="landing-feature-icon" style={{ color: f.accent }}><Icon name={f.icon} /></div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Built for Rwanda */}
      <section id="rwanda" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{RWANDA_HEAD.eyebrow}</span>
          <h2 className="font-serif landing-section-title">{RWANDA_HEAD.title}</h2>
          <p className="landing-section-sub">{RWANDA_HEAD.sub}</p>
        </div>
        <div className="landing-rwanda">
          {RWANDA.map((r, i) => (
            <article key={r.name} data-reveal className="landing-rwanda-tile landing-reveal" style={{ '--reveal-delay': `${Math.min(i * 35, 200)}ms` }}>
              <div className="landing-rwanda-icon"><Icon name={r.icon} /></div>
              <div>
                <h3 className="landing-rwanda-name">{r.name}</h3>
                <p className="landing-rwanda-line">{r.line}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="landing-rwanda-langs">
          {'Kinyarwanda · Français · English — landing, sign-in and navigation today; the full app interior is on its way.'}
        </p>
      </section>

      {/* Security & honesty */}
      <section id="security" className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{t('landing.security.eyebrow')}</span>
          <h2 className="font-serif landing-section-title">{t('landing.security.title')}</h2>
          <p className="landing-section-sub">{t('landing.security.sub')}</p>
        </div>
        <div className="landing-trust-grid">
          {TRUST.map(tr => (
            <article key={tr.title} className={`landing-trust-card${tr.wide ? ' landing-trust-card--wide' : ''}`}>
              <div className="landing-trust-icon"><Icon name={tr.icon} /></div>
              <div>
                <h3 className="landing-trust-title">{tr.title}</h3>
                <p className="landing-trust-desc">{tr.desc}</p>
              </div>
            </article>
          ))}
          <article className="landing-trust-card landing-trust-card--featured">
            <div className="landing-trust-icon"><Icon name="scales" /></div>
            <div>
              <h3 className="landing-trust-title">{'Estimates, not market quotes'}</h3>
              <p className="landing-trust-desc">
                {'Imari does the math on what you enter. For property, vehicles, livestock and unlisted assets, valuations stay as '}
                <strong>{'your estimates'}</strong>
                {' — every figure floored, never rounded up, so a number on screen never overstates reality. Depreciation follows RRA rules; BNR rates handle FX. We are honest about what can be known precisely, and what cannot.'}
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{t('landing.how.eyebrow')}</span>
          <h2 className="font-serif landing-section-title">{t('landing.how.title')}</h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map(s => (
            <li key={s.n} className="landing-step">
              <span className="landing-step-num font-serif">{s.n}</span>
              <h3 className="landing-step-title">{s.title}</h3>
              <p className="landing-step-desc">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3D finale — lazy, below the fold, absent on constrained devices */}
      <SplineShowcase />

      {/* Footer CTA */}
      <section className="landing-footer-cta">
        <div className="landing-footer-card">
          <h2 className="font-serif landing-footer-title">
            {t('landing.footer.title_1')}<br />{t('landing.footer.title_2')}
          </h2>
          <p className="landing-footer-sub">{t('landing.footer.sub')}</p>
          <div className="landing-hero-ctas" style={{ justifyContent: 'center' }}>
            <button onClick={goSignup} className="btn btn-primary landing-cta">
              {t('landing.footer.cta_create')} <Icon name="arrow" />
            </button>
            <button onClick={() => goLogin('signin')} className="btn btn-ghost landing-cta-ghost">
              {t('landing.footer.cta_signin')}
            </button>
          </div>
        </div>
        <footer className="landing-footer">
          <div className="landing-footer-brand">
            <span className="landing-brand-mark" aria-hidden>●</span>
            <span className="font-serif">Imari</span>
          </div>
          <div className="landing-footer-meta">
            <span>{t('landing.footer.powered_by')}</span>
            <MaxventuresWordmark fontSize={11} />
          </div>
        </footer>
      </section>
    </div>
  );
}
