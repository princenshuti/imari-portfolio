/**
 * English — canonical source for all translation keys.
 *
 * Keep this file the single source of truth. Other locales mirror its
 * structure. Missing keys in fr/rw fall back to en at runtime (see
 * I18nContext.t()), so adding a string here works immediately and other
 * locales can be filled in incrementally.
 *
 * Convention: dotted-path keys, lowercase, scoped by surface.
 *   nav.dashboard   landing.hero.headline   onboarding.cta_skip
 */
export default {
  // Sidebar navigation + group labels
  nav: {
    group_overview: 'Overview',
    group_wealth:   'Wealth',
    group_money:    'Money & Markets',
    group_tools:    'Tools',
    dashboard:   'Dashboard',
    assets:      'Assets',
    liabilities: 'Liabilities',
    cashflow:    'Cash Flow',
    goals:       'Goals',
    accounts:    'Accounts',
    trends:      'Trends',
    tax:         'Tax Report',
    advisor:     'AI Advisor',
    settings:    'Settings',
    home_label:  'Go to Dashboard',
    expand:      'Expand sidebar',
    collapse:    'Collapse sidebar',
    net_worth:   'True net worth',
    assets_short:'Assets',
    debt:        'Debt',
    synced:      'Synced to cloud',
    saved_local: 'Saved locally',
  },

  // Currency selector
  currency: {
    label:   'Display currency',
    tooltip: 'Display only — your stored values stay in their original currency.',
  },

  // Common buttons / actions reused across views
  common: {
    cancel:  'Cancel',
    save:    'Save',
    delete:  'Delete',
    edit:    'Edit',
    add:     'Add',
    close:   'Close',
    retry:   'Retry',
    back:    'Back',
    next:    'Next',
    confirm: 'Confirm',
    loading: 'Loading…',
  },

  // Landing page (marketing, public)
  landing: {
    nav: {
      why:      'Why Imari',
      features: 'Features',
      security: 'Security',
      signin:   'Sign in',
    },
    hero: {
      eyebrow:        'Personal wealth tracker · Built for Rwanda',
      headline_1:     'Stop guessing',
      headline_2:     "what you're worth.",
      sub:            'If your money is spread across banks, MoMo, USD cash, land and a few investments, you are estimating your net worth in your head — and usually getting it wrong. Imari ends the guesswork: every account and every asset in one live picture, in RWF and USD, based on the values you enter — so you can see where you stand today and whether you are ahead of last quarter.',
      cta_primary:    "Get started — it's free",
      cta_secondary:  'I already have an account',
      trust:          'Free to start. No card, no bank passwords — encrypted in transit and at rest.',
    },
    preview: {
      label: 'Net worth',
      delta_period: 'this quarter',
      savings_rate: 'Savings rate',
      goal_house:   'Goal · House',
    },
    problem: {
      eyebrow: 'The problem',
      title:   'Tracking wealth in Rwanda is broken.',
      sub:     "Spreadsheets go stale the day you close them. Banking apps each show one slice. Generic finance tools don't know what MoMo is, don't speak RWF, and can't tell you what RRA expects in April. So you are left doing the hardest job yourself — and guessing.",
      pain_1_title: 'Your wealth is scattered',
      pain_1_desc:  'Three banks, two MoMo wallets, USD cash, a land title, a bond from last year. Nothing shows them in one place — so the only net-worth figure you have is a guess.',
      pain_2_title: 'The math never adds up',
      pain_2_desc:  'Converting RWF and USD in your head is a coin toss. So is the question "am I better off than last quarter?" Both deserve a real number, not a feeling.',
      pain_3_title: 'Tax season is chaos',
      pain_3_desc:  'When RRA asks, you rebuild twelve months from receipts, SMS and screenshots — every single year. There is a far calmer way to keep records.',
    },
    solution: {
      eyebrow: 'The solution',
      title:   'One app for your whole financial picture.',
      sub:     'Imari brings every account, asset, debt and goal into a single dashboard — multi-currency, multi-asset, and built around the banks, wallets and rules you already use in Rwanda.',
    },
    security: {
      eyebrow: 'Built for trust',
      title:   'Your money is private. Your data stays yours.',
      sub:     'Imari holds the kind of information your bank holds — so we protect it the same way: encryption in transit and at rest, strict per-account isolation, and the discipline of never collecting more than the app actually needs.',
    },
    how: {
      eyebrow: 'How it works',
      title:   'From zero to a full picture, in one afternoon.',
    },
    footer: {
      title_1: "Know what you're worth.",
      title_2: 'Starting today.',
      sub:     'Free to start — no card, no bank credentials. Just the first complete, honest picture of your money, built in Rwanda for the way money actually moves here.',
      cta_create: 'Create your account',
      cta_signin: 'Sign in',
      powered_by: 'Powered by',
    },
  },

  // Login / signup / password reset
  login: {
    welcome_signin:  'Welcome to Imari.',
    welcome_signup:  'Create your account.',
    welcome_forgot:  'Reset your password.',
    sub_signin:      'Sign in or create an account to access your portfolio.',
    sub_signup:      'Imari encrypts your password and stores it securely on Supabase.',
    sub_forgot:      "Enter your email and we'll send you a link to reset your password.",
    sub_invite:      "You've been invited as a {role}. Sign in or create an account with {email} to join the portfolio.",
    email_label:     'Email',
    password_label:  'Password',
    password_short:  'At least 8 characters',
    forgot_link:     'Forgot password?',
    submit_signin:   'Sign in →',
    submit_signup:   'Create account →',
    submit_forgot:   'Send reset link →',
    submit_loading:  'Please wait…',
    no_account:      "Don't have an account?",
    has_account:     'Already have an account?',
    remember:        'Remember your password?',
    create_one:      'Create one',
    do_signin:       'Sign in',
    back_home:       '← Back to home',
    reset_sent:      'If an account exists for that email, a reset link has been sent. Check your inbox.',
    check_email:     'Check your email for a confirmation link to finish signup.',
    powered_by:      'Powered by',
  },

  // First-run name capture + onboarding wizard
  onboarding: {
    name_title:    'Welcome — what should I call you?',
    name_greeting: 'Muraho.',
    name_sub:      'Welcome to your personal wealth portal. What should I call you?',
    name_placeholder: 'Your name',
    name_continue: 'Continue →',
    name_privacy:  'Your data stays in this browser. Nothing leaves until you choose to back it up.',
    welcome:       'Murakaza neza, {name}.',
    sub:           'Add what you own to start tracking your wealth. Pick one or more from below — each opens a quick form pre-filled with sensible Rwandan defaults.',
    cta_sample:    '↻ Load sample portfolio',
    cta_skip:      "I'll add more later →",
    privacy:       'Your data is private. Nothing leaves your account unless you choose to export it.',
  },

  // Settings — appearance + locale picker
  settings: {
    appearance_title: 'Appearance',
    theme_label:      'Theme',
    theme_auto:       'Auto',
    theme_light:      'Light',
    theme_dark:       'Dark',
    locale_label:     'Language',
    locale_hint:      'Switches the language of the landing page, sidebar, login, and onboarding. App interior is English-only for now.',
  },
};
