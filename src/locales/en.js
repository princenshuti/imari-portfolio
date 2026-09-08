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
    group_reports:  'Reports',
    group_tools:    'Tools',
    group_family:   'Family',
    dashboard:   'Dashboard',
    assets:      'Assets',
    liabilities: 'Liabilities',
    cashflow:    'Cash Flow',
    goals:       'Goals',
    accounts:    'Accounts',
    trends:      'Trends',
    tax:         'Tax Report',
    balancesheet:'Balance Sheet',
    projections: 'Fast Forward',
    retirement:  'Retirement',
    yearreview:  'Year in Review',
    reports:     'Monthly Report',
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
    // Mobile-tab short labels (the bottom bar is narrow; some labels diverge from desktop)
    tabs_home:     'Home',
    tabs_balance:  'Balance',
    tabs_forecast: 'Forecast',
    tabs_pension:  'Pension',
    tabs_review:   'Review',
    tabs_report:   'Report',
    tabs_family:   'Family',
    family:        'Family Home',
    scorecard:     'Scorecard',
    calendar:      'Calendar',
    household:     'Household',
    insurance:     'Insurance',
    documents:     'Documents',
    wishlist:      'Wish list',
    tabs_wishes:   'Wishes',
  },

  // TopBar — role pill + avatar fallback
  search: {
    label:       'Search your portfolio',
    placeholder: 'Search…  ⌘K',
    no_results:  'Nothing matches — try an asset, debt, goal, or entry name.',
  },
  topbar: {
    badge_viewer: 'View-only',
    badge_editor: 'Editor',
    you_fallback: 'You',
  },

  // Mobile bottom navigation
  mobile_nav: {
    label:      'Mobile navigation',
    close_menu: 'Close menu',
    more:       'More',
    more_open:  'More navigation options',
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
      language: 'Language',
    },
    hero: {
      eyebrow:        'AI-powered wealth intelligence · Built for Rwanda',
      headline_1:     'Stop guessing',
      headline_2:     "what you're worth.",
      sub:            'Imari puts a private AI advisor on top of your full financial picture — every account, asset and debt in one place. It knows your numbers, tells you what idle money is quietly costing you, and answers any question in plain language. You stay in control; it never touches your money.',
      cta_primary:    'Start free — meet your advisor',
      cta_secondary:  'I already have an account',
      trust:          'Bank-grade encryption. No bank passwords — ever. Your data is never used to train AI.',
    },
    preview: {
      label: 'Net worth',
      delta_period: 'this quarter',
      savings_rate: 'Savings rate',
      goal_house:   'Goal · House',
      spark_alt:    'Illustration: a rising net-worth sparkline',
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
      title:   'Private enough to hold your whole net worth.',
      sub:     "Imari holds the kind of information your bank holds — so it's protected the way a bank protects it. Without us ever needing the keys to your accounts.",
    },
    how: {
      eyebrow: 'How it works',
      title:   'From zero to a full picture, in your first hour.',
    },
    footer: {
      title_1: 'The picture is already there.',
      title_2: "You're just not seeing it.",
      sub:     'Free to start — no card, no bank credentials. Just the first complete, honest view of your money, with an AI advisor who has already read it.',
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
    sub_signup:      'Your password is encrypted and never visible to anyone — including us.',
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
