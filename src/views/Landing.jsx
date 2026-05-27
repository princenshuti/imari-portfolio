import { useEffect, useState } from 'react';
import { useT } from '../contexts/I18nContext.jsx';

// Inline SVG icon set — Heroicons outline at 24x24
function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'wallet': return (
      <svg {...common}><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Zm0 0a2 2 0 0 1 2-2h12"/><circle cx="17" cy="13" r="1.2" fill="currentColor"/></svg>
    );
    case 'cube': return (
      <svg {...common}><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="m4 7 8 4 8-4"/><path d="M12 21V11"/></svg>
    );
    case 'target': return (
      <svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
    );
    case 'flow': return (
      <svg {...common}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
    );
    case 'spark': return (
      <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.5"/></svg>
    );
    case 'doc': return (
      <svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>
    );
    case 'arrow': return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    );
    case 'shield': return (
      <svg {...common}><path d="M12 3 4 6v6c0 4.5 3.2 8.5 8 9 4.8-.5 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2.2 2.2L15 10.5"/></svg>
    );
    case 'lock': return (
      <svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.1" fill="currentColor"/></svg>
    );
    case 'key-off': return (
      <svg {...common}><path d="M3 3l18 18"/><circle cx="8" cy="14" r="3.5"/><path d="m10.5 11.5 7-7M14 8l2 2M16 6l2 2"/></svg>
    );
    case 'download': return (
      <svg {...common}><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>
    );
    case 'eye': return (
      <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
    );
    case 'scatter': return (
      <svg {...common}><circle cx="6" cy="7" r="1.5"/><circle cx="14" cy="5" r="1.5"/><circle cx="9" cy="13" r="1.5"/><circle cx="18" cy="11" r="1.5"/><circle cx="13" cy="18" r="1.5"/><circle cx="5" cy="17" r="1.5"/></svg>
    );
    case 'calc': return (
      <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 19h2M12 19h2"/></svg>
    );
    case 'clock': return (
      <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
    );
    case 'scales': return (
      <svg {...common}><path d="M12 3v18M5 21h14M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7Zm14 0-3 7a4 4 0 0 0 6 0l-3-7Z"/></svg>
    );
    default: return null;
  }
}

const PAINS = [
  { icon: 'scatter', title: 'Your wealth is scattered',
    desc: 'Three banks, two MoMo wallets, USD cash, a land title, a bond from last year. Nothing shows them in one place — so the only net-worth figure you have is a guess.' },
  { icon: 'calc',    title: 'The math never adds up',
    desc: 'Converting RWF and USD in your head is a coin toss. So is the question “am I better off than last quarter?” Both deserve a real number, not a feeling.' },
  { icon: 'clock',   title: 'Tax season is chaos',
    desc: 'When RRA asks, you rebuild twelve months from receipts, SMS and screenshots — every single year. There is a far calmer way to keep records.' },
];

const FEATURES = [
  { icon: 'wallet', accent: 'var(--brand)', title: 'Every account, one live balance',
    desc: 'Bank, MoMo, USD, cash — all visible at once. Log income or an expense and the linked balance updates itself. No reconciliation, no stale spreadsheet.' },
  { icon: 'cube',   accent: 'var(--gold)',  title: 'Beyond accounts — everything you own',
    desc: 'Land, bonds, shares, livestock, vehicles, receivables. Your estimated values, converted to RWF or USD at official BNR rates — so the totals stay consistent across currencies.' },
  { icon: 'target', accent: 'var(--clay)',  title: 'Debts cleared, goals reached',
    desc: 'Loans tracked beside the house you are saving for. Straight math on what you owe and how close you really are — not motivational fluff.' },
  { icon: 'flow',   accent: 'var(--sky)',   title: 'See where your money goes',
    desc: 'Income against expenses, savings rate, month by month. Not a budget that nags you — a mirror that shows you the truth.' },
  { icon: 'spark',  accent: 'var(--brand)', title: 'An advisor that knows your numbers',
    desc: 'Ask anything. The AI advisor reads your own portfolio first, then answers in context — grounded in your actual money, not generic web advice.' },
  { icon: 'doc',    accent: 'var(--plum)',  title: 'RRA-ready, all year round',
    desc: 'Imari calculates your RRA obligations as you go — Fixed Asset Tax (0.1% on property above RWF 3M), Vehicle Road Levy (per Law 013/2025), Capital Gains Tax (5% on realised gains) and Withholding Tax (15% on investment income). Export a clean year-end summary, ready to file by 31 March.' },
];

const TRUST = [
  { icon: 'lock',     title: 'Encrypted in transit and at rest',
    desc: 'Every connection runs over TLS. Your portfolio is stored in Supabase Postgres, encrypted on disk and isolated by row-level security — reachable only through your signed-in account.' },
  { icon: 'key-off',  title: 'No bank passwords. Not ever.',
    desc: 'Imari never asks for your bank or MoMo login. You enter balances; the app does the math. There are no banking credentials here to phish, leak or steal.' },
  { icon: 'download', title: 'Your data, your control',
    desc: 'Export everything to Excel any time. Delete your account and your data goes with it. We never sell it, share it, or run analytics on what you store.' },
  { icon: 'eye',      title: 'Read-only when you share',
    desc: 'Invite a spouse, family member or accountant as a viewer. They see the numbers; they cannot edit them. Revoke access in one click, any time.' },
];

const STEPS = [
  { n: '01', title: 'Create your account',   desc: 'One email, one password, eight seconds. Your private portfolio is provisioned on the spot.' },
  { n: '02', title: 'Add what you own',      desc: 'Accounts, assets, debts and goals — in RWF, USD or both. The first hour gives you the full picture; after that it maintains itself.' },
  { n: '03', title: 'Let Imari do the rest', desc: 'Daily snapshots, FX updates, tax estimates and advisor insights run quietly in the background. You just check in when you want to know.' },
];

export default function Landing({ onSignIn }) {
  const { t } = useT();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // mode: 'signup' lands on the Create-account form, 'signin' on the Sign-in form.
  // Hash is the single source of truth — App listens on hashchange and re-renders.
  // (We deliberately don't also call onSignIn() so the mode prop reaches Login on the
  // very first render with the correct value, instead of after a flip.)
  const goLogin = (mode = 'signin') => {
    window.location.hash = mode === 'signup' ? 'signup' : 'login';
  };
  const goSignup = () => goLogin('signup');

  // Brand link: scroll to top without dirtying the URL hash (which would unmount Landing).
  const goTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
            <a href="#why" className="landing-link">{t('landing.nav.why')}</a>
            <a href="#features" className="landing-link">{t('landing.nav.features')}</a>
            <a href="#security" className="landing-link">{t('landing.nav.security')}</a>
            <button onClick={() => goLogin('signin')} className="btn btn-primary landing-cta-sm">{t('landing.nav.signin')}</button>
          </div>
        </div>
      </nav>

      {/* Hero — the conviction moment */}
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

        {/* Floating preview card */}
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
                  <stop offset="0%"   stopColor="var(--brand)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,38 L20,34 L40,36 L60,28 L80,30 L100,22 L120,24 L140,18 L160,14 L180,16 L200,8"
                    fill="none" stroke="var(--brand)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M0,38 L20,34 L40,36 L60,28 L80,30 L100,22 L120,24 L140,18 L160,14 L180,16 L200,8 L200,50 L0,50 Z"
                    fill="url(#sparkFill)" />
            </svg>
            <div className="landing-preview-foot">
              <span className="landing-preview-chip"><span className="landing-preview-chip-dot" style={{ background:'var(--brand)' }} /> Cash</span>
              <span className="landing-preview-chip"><span className="landing-preview-chip-dot" style={{ background:'var(--gold)' }} /> Bonds</span>
              <span className="landing-preview-chip"><span className="landing-preview-chip-dot" style={{ background:'var(--clay)' }} /> Other</span>
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

      {/* Problem — name the pain */}
      <section id="why" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{t('landing.problem.eyebrow')}</span>
          <h2 className="font-serif landing-section-title">{t('landing.problem.title')}</h2>
          <p className="landing-section-sub">{t('landing.problem.sub')}</p>
        </div>
        <div className="landing-pains">
          {PAINS.map(p => (
            <article key={p.title} className="landing-pain">
              <div className="landing-pain-icon"><Icon name={p.icon} /></div>
              <h3 className="landing-pain-title">{p.title}</h3>
              <p className="landing-pain-desc">{p.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Solution — what's inside */}
      <section id="features" className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{t('landing.solution.eyebrow')}</span>
          <h2 className="font-serif landing-section-title">{t('landing.solution.title')}</h2>
          <p className="landing-section-sub">{t('landing.solution.sub')}</p>
        </div>

        <div className="landing-features">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="landing-feature" style={{ '--feature-accent': f.accent, '--feature-delay': `${i * 40}ms` }}>
              <div className="landing-feature-icon" style={{ color: f.accent }}>
                <Icon name={f.icon} />
              </div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Security — earn the trust */}
      <section id="security" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">{t('landing.security.eyebrow')}</span>
          <h2 className="font-serif landing-section-title">{t('landing.security.title')}</h2>
          <p className="landing-section-sub">{t('landing.security.sub')}</p>
        </div>

        <div className="landing-trust-grid">
          {/* Loop variable renamed to `tr` to avoid shadowing the `t` translator
              function from useT(). Card titles + descriptions stay in English
              for now — translating marketing prose into Kinyarwanda needs a
              native financial-vocabulary reviewer. */}
          {TRUST.map(tr => (
            <article key={tr.title} className="landing-trust-card">
              <div className="landing-trust-icon"><Icon name={tr.icon} /></div>
              <div>
                <h3 className="landing-trust-title">{tr.title}</h3>
                <p className="landing-trust-desc">{tr.desc}</p>
              </div>
            </article>
          ))}

          {/* Featured honesty card — spans both columns, addresses valuation credibility head-on */}
          <article className="landing-trust-card landing-trust-card--featured">
            <div className="landing-trust-icon"><Icon name="scales" /></div>
            <div>
              <h3 className="landing-trust-title">Estimates, not market quotes</h3>
              <p className="landing-trust-desc">
                Imari does the math on what you enter. For property, vehicles, livestock and
                unlisted assets, valuations stay as <strong>your estimates</strong> — we never
                pretend to know real-time market prices. Depreciation follows official RRA rules.
                BNR rates handle FX. We are honest about what can be known precisely, and what
                cannot.
              </p>
            </div>
          </article>
        </div>

        <div className="landing-trust-foot">
          <Icon name="shield" />
          <span>
            Built on <strong>Supabase</strong> — Postgres with row-level security, encrypted on disk,
            with TLS on every connection. Sign-in is handled by Supabase Auth: we never see or store your password.
          </span>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="landing-section landing-section-alt">
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
