import { useEffect, useState } from 'react';
import { useT } from '../contexts/I18nContext.jsx';

// Inline SVG icon set — Heroicons-style outline at 24x24
function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'wallet': return (<svg {...common}><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Zm0 0a2 2 0 0 1 2-2h12"/><circle cx="17" cy="13" r="1.2" fill="currentColor"/></svg>);
    case 'cube': return (<svg {...common}><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="m4 7 8 4 8-4"/><path d="M12 21V11"/></svg>);
    case 'target': return (<svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>);
    case 'flow': return (<svg {...common}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>);
    case 'spark': return (<svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.5"/></svg>);
    case 'doc': return (<svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>);
    case 'arrow': return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>);
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
    default: return null;
  }
}

// ── The Cost-of-Absence section — Imari's signature idea ──────────────────
const COST_HEAD = {
  eyebrow: 'The cost of looking away',
  title: 'Your money is doing something today. Imari tells you what.',
  sub: 'Most apps store your numbers. Imari surfaces what ignoring them costs you — in francs, days and risk — drawn only from your own data. Never invented fear, only what is already true.',
};
const COSTS = [
  { sev: 'critical', stat: 'RWF 12,000', label: 'Late-levy penalty, avoided', body: 'An RRA deadline you would have missed — surfaced six days early, before the penalty starts.' },
  { sev: 'warning', stat: 'RWF 35,000 / mo', label: 'Idle cash, not earning', body: 'RWF 4.2M resting in MoMo while BNR T-bills reference ~10%. A running counter of what you forgo.' },
  { sev: 'info', stat: '−2% in real terms', label: 'Net worth "flat" in RWF', body: 'After inflation and the franc\'s slide, standing still is quietly going backwards. Imari shows the real number.' },
  { sev: 'warning', stat: '38% of income', label: 'Your pension at 60', body: 'Below a comfortable 60% replacement. Imari shows the gap — and what an extra RWF 10k/month to Ejo Heza closes.' },
];

// ── Feature set — everything Imari now does ───────────────────────────────
const FEATURES = [
  { icon: 'spark', accent: 'var(--brand)', title: 'An insight engine, not a ledger',
    desc: 'Runway, idle cash, concentration, tax exposure, real-vs-nominal drift — computed from your data and ranked by what it costs you to ignore. Deterministic and tested, then phrased by AI.' },
  { icon: 'sms', accent: 'var(--gold)', title: 'MoMo on autopilot',
    desc: 'MTN and Airtel confirmation SMS parsed straight into your ledger — amount, who, balance, fee. Stop typing every transaction; your net worth stops being wrong.' },
  { icon: 'chat', accent: 'var(--sky)', title: 'Add money from WhatsApp',
    desc: 'Text “spent 25k fuel” and it is logged, categorised, ready to confirm. A once-a-day nudge keeps your money watched — in the app you already live in.' },
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
  'MTN MoMo & Airtel Money', 'BNR live FX rates', 'RRA tax rules (Rw law)',
  'RSSB & Ejo Heza pensions', 'UPI land titles', 'RSE shares & T-bonds',
  'Kinyarwanda', 'Français', 'English',
];

// ── Trust & honesty ───────────────────────────────────────────────────────
const TRUST = [
  { icon: 'refresh', title: 'Every number is dated',
    desc: 'Imari shows how fresh each figure is and flags what has gone stale. A confidently-wrong number erodes trust faster than no number — so we never hide the date.' },
  { icon: 'lock', title: 'Encrypted in transit and at rest',
    desc: 'Every connection runs over TLS. Your portfolio lives in Postgres, encrypted on disk and isolated by row-level security — reachable only through your signed-in account.' },
  { icon: 'key-off', title: 'No bank passwords. Not ever.',
    desc: 'Imari never asks for your bank or MoMo login. You hold the data; the app does the math. There are no banking credentials here to phish, leak or steal.' },
  { icon: 'eye', title: 'Read-only when you share',
    desc: 'Invite a spouse, family member or accountant as a viewer. They see the numbers; they cannot change them. Revoke access in a single click, any time.' },
];

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'One email, one password, eight seconds. Your private portfolio is provisioned on the spot — free core, always.' },
  { n: '02', title: 'Add what you own', desc: 'Accounts, assets, debts and goals, in RWF or USD. The first hour gives you the full picture; MoMo and WhatsApp keep it current after that.' },
  { n: '03', title: 'Let Imari watch it', desc: 'Daily snapshots, FX updates, tax estimates and the insight engine run quietly. You check in when you want to know — and Imari taps you when it matters.' },
];

const SEV = {
  critical: { color: 'var(--down)', glyph: '⚠', label: 'Critical' },
  warning: { color: 'var(--gold)', glyph: '!', label: 'Warning' },
  info: { color: 'var(--sky)', glyph: 'i', label: 'Heads up' },
};

export default function Landing({ onSignIn }) {
  const { t } = useT();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hash is the single source of truth — App listens on hashchange.
  const goLogin = (mode = 'signin') => { window.location.hash = mode === 'signup' ? 'signup' : 'login'; };
  const goSignup = () => goLogin('signup');
  const goTop = (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="landing-root">
      {/* Nav */}
      <nav className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`} data-noprint>
        <div className="landing-nav-inner">
          <a href="#" onClick={goTop} className="landing-brand" aria-label="Imari home">
            <span className="landing-brand-mark" aria-hidden>●</span>
            <span className="landing-brand-name font-serif">Imari</span>
          </a>
          <div className="landing-nav-actions">
            <a href="#cost" className="landing-link">{COST_HEAD.eyebrow}</a>
            <a href="#features" className="landing-link">{t('landing.nav.features')}</a>
            <a href="#security" className="landing-link">{t('landing.nav.security')}</a>
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

        {/* Floating preview card with a live cost-of-absence chip */}
        <div className="landing-preview" aria-hidden>
          <div className="landing-preview-card">
            <div className="landing-preview-label">{t('landing.preview.label')}</div>
            <div className="landing-preview-amount num">
              <span className="landing-preview-ccy">RWF</span>
              <span>24,830,000</span>
            </div>
            <div className="landing-preview-delta">
              <span className="pill pill-up">↑ 8.4%</span>
              <span className="landing-preview-period">{t('landing.preview.delta_period')}</span>
            </div>
            <svg className="landing-preview-spark" viewBox="0 0 200 50" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,38 L20,34 L40,36 L60,28 L80,30 L100,22 L120,24 L140,18 L160,14 L180,16 L200,8" fill="none" stroke="var(--brand)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M0,38 L20,34 L40,36 L60,28 L80,30 L100,22 L120,24 L140,18 L160,14 L180,16 L200,8 L200,50 L0,50 Z" fill="url(#sparkFill)" />
            </svg>
            <div className="landing-preview-costchip">
              <span className="landing-preview-costglyph">!</span>
              <span>{'RWF 35k/mo idle — not earning T-bill yield'}</span>
            </div>
          </div>
          <div className="landing-preview-mini">
            <div className="landing-preview-mini-row">
              <span className="landing-preview-mini-label">{t('landing.preview.savings_rate')}</span>
              <span className="num landing-preview-mini-val">32%</span>
            </div>
            <div className="landing-preview-mini-row">
              <span className="landing-preview-mini-label">{t('landing.preview.goal_house')}</span>
              <span className="num landing-preview-mini-val t-brand">68%</span>
            </div>
          </div>
        </div>
      </header>

      {/* Cost of Absence — the signature idea */}
      <section id="cost" className="landing-section">
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
                <div className="landing-cost-badge" aria-hidden style={{ background: s.color }}>{s.glyph}</div>
                <div className="landing-cost-stat num">{c.stat}</div>
                <div className="landing-cost-label">{c.label}</div>
                <p className="landing-cost-desc">{c.body}</p>
              </article>
            );
          })}
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
          {FEATURES.map((f, i) => (
            <article key={f.title} className="landing-feature" style={{ '--feature-accent': f.accent, '--feature-delay': `${Math.min(i * 30, 210)}ms` }}>
              <div className="landing-feature-icon" style={{ color: f.accent }}><Icon name={f.icon} /></div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </article>
          ))}
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
            <span key={r} data-reveal className="landing-rwanda-pill landing-reveal" style={{ '--reveal-delay': `${Math.min(i * 35, 200)}ms` }}>{r}</span>
          ))}
        </div>
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
            <article key={tr.title} className="landing-trust-card">
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
            <img src={`${import.meta.env.BASE_URL}maxventures-logo.png`} alt="Maxventures" className="landing-footer-logo" />
          </div>
        </footer>
      </section>
    </div>
  );
}
