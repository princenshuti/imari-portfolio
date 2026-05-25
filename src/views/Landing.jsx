import { useEffect, useState } from 'react';

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
    default: return null;
  }
}

const PAINS = [
  { icon: 'scatter', title: 'Scattered everywhere',
    desc: 'Three banks, two MoMo wallets, USD cash, a land title, that bond from last year. No tool shows them together — so you guess.' },
  { icon: 'calc',    title: 'The math is always off',
    desc: 'Mental FX between RWF and USD is a coin toss. So is the gut feel of "am I better off this quarter than last?" Both deserve real numbers.' },
  { icon: 'clock',   title: 'Tax season is chaos',
    desc: 'When RRA asks, you reconstruct twelve months from receipts and screenshots. There’s a calmer way to do this.' },
];

const FEATURES = [
  { icon: 'wallet', accent: 'var(--brand)', title: 'Every account, one balance',
    desc: 'Bank, MoMo, USD, cash — visible at once. Log income or an expense and the linked balance updates itself. No reconciliation tax.' },
  { icon: 'cube',   accent: 'var(--gold)',  title: 'Beyond accounts: what you really own',
    desc: 'Land, bonds, livestock, vehicles, receivables. In RWF, USD or both — with BNR official rates baked in so the totals are honest.' },
  { icon: 'target', accent: 'var(--clay)',  title: 'Debts paid, goals chased',
    desc: 'Loans tracked alongside the house you’re saving for. Honest math on what you owe and how close you actually are — not motivational fluff.' },
  { icon: 'flow',   accent: 'var(--sky)',   title: 'Where your money actually goes',
    desc: 'Income vs expenses, savings rate, month by month. Not a budget that nags you — a mirror that shows you.' },
  { icon: 'spark',  accent: 'var(--brand)', title: 'An advisor that knows your numbers',
    desc: 'Ask anything. Claude reads your portfolio first, then answers in context. No generic web advice — answers grounded in your actual money.' },
  { icon: 'doc',    accent: 'var(--plum)',  title: 'RRA-ready, all year',
    desc: 'Imali estimates your tax as you earn, not the week before deadline. Export a clean report when April comes — no scrambling.' },
];

const TRUST = [
  { icon: 'lock',     title: 'Encrypted, end to end',
    desc: 'TLS in transit. Postgres with row-level security at rest. Your portfolio sits under your account on Supabase — no one else, including us, can read it without your sign-in.' },
  { icon: 'key-off',  title: 'No bank passwords, ever',
    desc: 'Imali never asks for your bank or MoMo credentials. You enter balances; we do the math. There’s nothing to phish, nothing to leak, nothing to steal.' },
  { icon: 'download', title: 'Your data, your control',
    desc: 'Export everything to Excel any time. Delete your account and your data goes with it. We don’t sell, share, or run analytics on what you store here.' },
  { icon: 'eye',      title: 'Read-only when you share',
    desc: 'Invite your spouse, family or accountant as viewers. They see the numbers, they can’t edit. Revoke access in one click whenever you want.' },
];

const STEPS = [
  { n: '01', title: 'Create your account',     desc: 'One email, one password, eight seconds. Your encrypted portfolio is provisioned on the spot.' },
  { n: '02', title: 'Pour in what you own',    desc: 'Accounts, assets, debts, goals — RWF, USD, or both. The first hour gives you the picture; the rest builds itself.' },
  { n: '03', title: 'Let Imali do the rest',   desc: 'Daily snapshots, FX updates, tax estimates, advisor insights — running quietly in the background. You just look in when you want to know.' },
];

export default function Landing({ onSignIn }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goLogin = () => {
    window.location.hash = 'login';
    onSignIn?.();
  };

  return (
    <div className="landing-root">
      {/* Nav */}
      <nav className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`} data-noprint>
        <div className="landing-nav-inner">
          <a href="#" className="landing-brand" aria-label="Imali home">
            <span className="landing-brand-mark" aria-hidden>●</span>
            <span className="landing-brand-name font-serif">Imali</span>
          </a>
          <div className="landing-nav-actions">
            <a href="#why" className="landing-link">Why Imali</a>
            <a href="#features" className="landing-link">Features</a>
            <a href="#security" className="landing-link">Security</a>
            <button onClick={goLogin} className="btn btn-primary landing-cta-sm">Sign in</button>
          </div>
        </div>
      </nav>

      {/* Hero — the conviction moment */}
      <header className="landing-hero">
        <div className="landing-hero-inner">
          <span className="landing-eyebrow">
            <span className="landing-dot" aria-hidden /> Wealth tracking · Built for Rwanda
          </span>
          <h1 className="landing-headline font-serif">
            Stop guessing<br />
            <em className="landing-headline-em">what you’re worth.</em>
          </h1>
          <p className="landing-sub">
            Bank, MoMo, USD, land, bonds — most people guess. Imali tracks every franc and every asset you own,
            and tells you exactly where you stand. Today. This quarter. And where you’re heading.
          </p>
          <div className="landing-hero-ctas">
            <button onClick={goLogin} className="btn btn-primary landing-cta">
              Get started — it’s free <Icon name="arrow" />
            </button>
            <button onClick={goLogin} className="btn btn-ghost landing-cta-ghost">
              I already have an account
            </button>
          </div>
          <div className="landing-trust">
            <Icon name="shield" />
            <span>Bank-grade encryption. Your data, your account, your control.</span>
          </div>
        </div>

        {/* Floating preview card */}
        <div className="landing-preview" aria-hidden>
          <div className="landing-preview-card">
            <div className="landing-preview-label">Net worth</div>
            <div className="landing-preview-amount num">
              <span className="landing-preview-ccy">RWF</span>
              <span>24,830,000</span>
            </div>
            <div className="landing-preview-delta">
              <span className="pill pill-up">↑ 8.4%</span>
              <span className="landing-preview-period">this quarter</span>
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
              <span className="landing-preview-mini-label">Savings rate</span>
              <span className="num landing-preview-mini-val">32%</span>
            </div>
            <div className="landing-preview-mini-row">
              <span className="landing-preview-mini-label">Goal · House</span>
              <span className="num landing-preview-mini-val t-brand">68%</span>
            </div>
          </div>
        </div>
      </header>

      {/* Problem — name the pain */}
      <section id="why" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">The problem</span>
          <h2 className="font-serif landing-section-title">Tracking wealth in Rwanda is broken.</h2>
          <p className="landing-section-sub">
            Spreadsheets go stale. Banking apps show one slice. Generic finance tools don’t know what MoMo is,
            don’t speak RWF, and can’t tell you what RRA expects in April.
          </p>
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
          <span className="landing-section-eyebrow">The solution</span>
          <h2 className="font-serif landing-section-title">The full picture, finally.</h2>
          <p className="landing-section-sub">
            Six tools, one rhythm. Built around how money actually works in Rwanda — multi-currency, multi-asset,
            and aware of the institutions you already use.
          </p>
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
          <span className="landing-section-eyebrow">Built for trust</span>
          <h2 className="font-serif landing-section-title">Your money is private. Your data is yours.</h2>
          <p className="landing-section-sub">
            Imali holds the kind of information your bank holds. We treat it that way — with encryption,
            isolation, and the simple discipline of never asking for more than we need.
          </p>
        </div>

        <div className="landing-trust-grid">
          {TRUST.map(t => (
            <article key={t.title} className="landing-trust-card">
              <div className="landing-trust-icon"><Icon name={t.icon} /></div>
              <div>
                <h3 className="landing-trust-title">{t.title}</h3>
                <p className="landing-trust-desc">{t.desc}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="landing-trust-foot">
          <Icon name="shield" />
          <span>
            Built on <strong>Supabase</strong> (Postgres + row-level security) and protected end-to-end with TLS.
            We never see your password — auth tokens are issued by Supabase, not stored by us.
          </span>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <span className="landing-section-eyebrow">How it works</span>
          <h2 className="font-serif landing-section-title">From zero to a full picture, in an afternoon.</h2>
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
            Know what you’re worth.<br />Starting today.
          </h2>
          <p className="landing-footer-sub">
            Free to start. No card. No bank credentials. Just the first complete picture
            of your money — built in Rwanda, for the way money actually moves here.
          </p>
          <div className="landing-hero-ctas" style={{ justifyContent: 'center' }}>
            <button onClick={goLogin} className="btn btn-primary landing-cta">
              Create your account <Icon name="arrow" />
            </button>
            <button onClick={goLogin} className="btn btn-ghost landing-cta-ghost">
              Sign in
            </button>
          </div>
        </div>

        <footer className="landing-footer">
          <div className="landing-footer-brand">
            <span className="landing-brand-mark" aria-hidden>●</span>
            <span className="font-serif">Imali</span>
          </div>
          <div className="landing-footer-meta">
            <span>Powered by</span>
            <img src={`${import.meta.env.BASE_URL}maxventures-logo.png`} alt="Maxventures" className="landing-footer-logo" />
          </div>
        </footer>
      </section>
    </div>
  );
}
