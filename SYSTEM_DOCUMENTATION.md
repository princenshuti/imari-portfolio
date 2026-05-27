# Imari Platform — System Documentation

**Repository:** [princenshuti/imari-portfolio](https://github.com/princenshuti/imari-portfolio)
**Live:** https://princenshuti.github.io/imari-portfolio/
**Last updated:** 2026-05-25

---

## 1. Overview

**Imari by Maxventures** is a personal wealth and asset portfolio tracker built for Rwanda. It consolidates a user's full financial picture — bank accounts, equities (RSE & foreign), bonds, real estate, vehicles, crypto, mobile money — into a single dashboard with multi-currency support (RWF, USD, EUR, KES), live exchange rates from the National Bank of Rwanda (BNR), and an AI advisor grounded in the user's actual portfolio data.

The product is a client-side React SPA backed by Supabase (Postgres + Auth + Edge Functions). It is installable as a PWA and runs offline against cached data.

**Primary user:** an individual managing their own (or a shared household's) wealth.
**Hosting:** GitHub Pages, deployed via GitHub Actions on every push to `main`.

---

## 2. System Architecture

### 2.1 High-level diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React 18 SPA, served from GitHub Pages)            │
│                                                              │
│  App.jsx (useReducer state) ──► views/ ──► components/       │
│        │                                                     │
│        ├─ cloud.js   ──── auth + portfolio sync              │
│        ├─ ai.js      ──── chat / insights                    │
│        └─ services/  ──── snapshots, market data, import     │
└──────────┬─────────────────────────┬─────────────────────────┘
           │                         │
           │ JWT                     │ HTTPS (cached SW)
           ▼                         ▼
   ┌───────────────────┐    ┌────────────────────────────┐
   │  Supabase         │    │  Public market data        │
   │                   │    │  • CoinGecko (crypto)      │
   │  • Postgres       │    │  • open.er-api.com (FX)    │
   │  • Auth (JWT)     │    └────────────────────────────┘
   │  • Realtime       │
   │  • Edge Functions │ ──► Anthropic API (Claude)
   │    - ai-proxy     │ ──► BNR scraper (scheduled)
   │    - bnr-rates    │
   └───────────────────┘
```

### 2.2 Layers

| Layer | Stack | Notes |
|---|---|---|
| Frontend | React 18.3, Vite 6, JSX | No UI framework — handcrafted CSS with CSS variables. Code-split per view via `React.lazy` + `Suspense`. |
| State | `useReducer` in [App.jsx](src/App.jsx) | Single store; views receive `state` + `dispatch` as props. |
| Routing | Hash-based (`#dashboard`, `#assets`, ...) | No router library; navigation persisted in the URL fragment for back/forward support. |
| Persistence | Supabase Postgres (primary), `localStorage` (fallback) | Auto-saves on state change; realtime subscriptions push remote edits to other sessions. |
| Auth | Supabase Auth | Email/password + recovery magic links; JWT stored in browser, auto-refresh on focus. |
| Backend logic | Supabase Edge Functions (Deno/TypeScript) | `ai-proxy` validates JWT and forwards to Anthropic with server-only key; `bnr-rates` is a scheduled scraper. |
| Build / deploy | Vite → static bundle → GitHub Pages | CI in [.github/workflows/deploy.yml](.github/workflows/deploy.yml). |
| PWA | `vite-plugin-pwa` + Workbox | Stale-while-revalidate caching for FX (1h) and market data (15m). |

### 2.3 Directory layout

```
src/
├── main.jsx              # React root, StrictMode
├── App.jsx               # Reducer, auth bootstrap, view router (~700 LOC)
├── store.js              # localStorage fallback
├── cloud.js              # Supabase auth + portfolio CRUD + realtime
├── supabase.js           # Supabase client init
├── ai.js                 # Anthropic integration (via Edge Function)
├── data.js               # Asset classes, FX constants
├── excel.js              # Excel import/export (ExcelJS)
├── styles.css            # Global theme & layout
├── views/                # 10 page-level components
│   ├── Dashboard.jsx     # Net worth, charts, AI insight
│   ├── Assets.jsx        # Asset CRUD + Excel import
│   ├── Accounts.jsx      # Bank + mobile money
│   ├── Liabilities.jsx   # Debt tracking
│   ├── Goals.jsx         # Financial goals
│   ├── CashFlow.jsx      # Income/expense + recurring
│   ├── Advisor.jsx       # AI chat
│   ├── Trends.jsx        # Live prices + BNR rates
│   ├── TaxReport.jsx     # 2024 RRA estimate
│   └── Settings.jsx      # Profile, theme, members, import/export
├── components/           # Sidebar, TopBar, charts, modals
└── services/             # snapshots, marketData, bankImport

supabase/
├── functions/
│   ├── ai-proxy/         # JWT-validated Claude relay
│   └── bnr-rates/        # Scheduled FX scraper
└── schema/               # Migrations + RLS policies

.github/workflows/deploy.yml
vite.config.js
package.json
```

### 2.4 Data model

Core Postgres tables (RLS enforced on every row):

- **`portfolios`** — one row per portfolio. Holds the full state JSON (assets, liabilities, goals, cashflows, snapshots, chat).
- **`portfolio_members`** — many-to-many between users and portfolios; carries role (`owner` | `editor` | `viewer`).
- **`portfolio_invitations`** — tokenized invites, 14-day expiry, consumed on first sign-in after click.

RLS policy `user_has_portfolio_access()` gates all reads/writes by membership. Foreign keys cascade on portfolio delete.

---

## 3. Features (shipped to production)

All features below are implemented end-to-end (CRUD + persistence + UI) and live on the deployed site. The code has no `TODO`/`coming soon` placeholders in user-facing paths.

> **Testing status:** there is no automated test suite (no Jest/Vitest). "Tested" here means manually verified in production and protected by the CI build (a Vite build failure blocks deploy). See [§5 Testing](#5-testing).

### Authentication & onboarding
- Email/password sign-up and sign-in — [Login.jsx](src/views/Login.jsx)
- Password reset via recovery magic link — [ResetPassword.jsx](src/views/ResetPassword.jsx)
- First-login name prompt — [NamePrompt.jsx](src/components/NamePrompt.jsx)
- Auto-creates an empty portfolio on first login — [cloud.js:72](src/cloud.js)
- Invite links (`?invite=...`) auto-accepted post-login — [App.jsx:314](src/App.jsx)

### Dashboard
- Net worth (gross assets − liabilities), cost basis, gain/loss
- Composition donut by asset class
- Monthly income projection from yield-bearing assets
- AI insight card — sends portfolio snapshot to Claude, renders markdown
- 60-day synthetic history seeded on first run for chart continuity
- Milestone celebrations when net worth crosses thresholds

### Assets
- 25+ asset classes: cash, equities (RSE & foreign), bonds, real estate, vehicles, crypto, livestock, collectibles, etc.
- Excel import: downloadable template, parse, merge by natural key — [excel.js](src/excel.js)
- Bulk delete with multi-select
- Sort (value / gain % / cost / purchase date / name) and filter (kind, location)
- Maturity & overdue alerts
- Photo and document attachments (base64 inline)

### Accounts (bank & mobile money)
- Multi-currency, per account
- `currentValue` auto-derived from opening balance + linked cashflows — [App.jsx:81](src/App.jsx)

### Liabilities
- Principal, interest rate, term, payment schedule
- Auto-deducted from net worth

### Goals
- Target amount, category (education, housing, savings, …)
- Progress tracking and achievement marking

### Cash flow
- Income & expense entries
- Recurring (daily / weekly / monthly / annually) or one-time
- One-time entries linked to an account adjust that account's `currentValue`
- Savings-rate computation, filters by date & category

### AI advisor
- Multi-turn chat grounded in the user's portfolio snapshot (system prompt)
- Markdown rendering
- History capped at 80 messages, input capped to protect tokens
- Routed through `ai-proxy` Edge Function (Anthropic key never reaches the browser)

### Trends
- Live crypto prices (CoinGecko) and FX (open.er-api.com)
- Cached BNR rates from the `bnr-rates` scheduled function
- Personal watchlist (crypto / equities / forex symbols)

### Tax report
- 2024 Rwanda RRA estimate: income summary, capital gains, bands, exportable table — [TaxReport.jsx](src/views/TaxReport.jsx)

### Settings
- Profile (name, email, phone, bio, avatar)
- Theme: light / dark / auto, persisted to `localStorage`
- Display currency
- Member management — invite editor/viewer by email, manage roles
- Portfolio JSON import/export
- Multi-portfolio switching

### Platform-level
- PWA installable, offline against cached data
- Realtime sync across open sessions
- Hash-based deep links survive reload

---

## 4. How it works end-to-end

### 4.1 Cold start

1. Browser loads `index.html` from GitHub Pages at `/imari-portfolio/`.
2. Vite bundle boots React; [App.jsx](src/App.jsx) calls `supabase.auth.getSession()`.
3. If a session exists, [`loadOrCreatePortfolio`](src/cloud.js) queries `portfolios` joined with `portfolio_members` for the current user.
4. The returned portfolio JSON is dispatched as `replaceAll`, hydrating the reducer.
5. A realtime channel is opened on the portfolio row; remote edits dispatch `replaceAll` again.
6. The view named by `window.location.hash` is lazy-loaded inside `<Suspense>`.

### 4.2 Editing an asset

1. User opens **Assets**, clicks *Add*; `AssetEditor` modal opens.
2. On submit, `dispatch({ type: 'upsertAsset', asset })` runs the reducer ([App.jsx:104](src/App.jsx)).
3. If the asset is account-shaped (e.g. savings, mobile money), `currentValue` is recomputed from `purchasePrice + linkedCashflows`.
4. A debounced `useEffect` calls `savePortfolio(portfolioId, state)`; Supabase RLS verifies membership and writes.
5. Other connected sessions receive a realtime payload and re-render.

### 4.3 AI advisor turn

1. User sends a message in **Advisor**.
2. `completeChat()` ([ai.js](src/ai.js)) assembles a system prompt with a compact portfolio snapshot (profile, totals, FX, recent history), trims chat history to 10 messages, and caps the user message at 2000 chars.
3. If Supabase is configured, the request goes to `supabase.functions.invoke('ai-proxy', …)`.
4. The `ai-proxy` Edge Function validates the JWT, rate-limits, then calls Anthropic with the server-only `ANTHROPIC_KEY`.
5. The reply is appended to `state.chat` and persisted on the next save cycle.

### 4.4 Daily FX refresh

1. Supabase scheduler triggers `bnr-rates` once per day.
2. The function fetches BNR's published rates, normalises them, and upserts into a cached table.
3. The frontend reads cached rates on load; the service worker keeps a 1-hour stale-while-revalidate copy for offline use.

### 4.5 Deploy

1. Push to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
2. CI runs `npm ci` then `npm run build` (Vite). `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are injected from repo secrets; the Anthropic key is **not** — it lives only as a Supabase Function secret.
3. The `dist/` artifact is uploaded and published to the `github-pages` environment.

---

## 5. Testing

| Layer | Status |
|---|---|
| Unit tests | None configured. |
| Integration tests | None configured. |
| Type checking | None (project is plain JS, not TS). |
| Linting | Not enforced in CI. |
| Build verification | ✅ `vite build` runs on every push to `main`; a failure blocks the deploy. |
| Runtime checks | React `StrictMode` is enabled in dev. |
| Manual QA | Each feature has been exercised against the deployed site. |

This is the honest state of the project. Adding Vitest + a smoke test for the reducer in [App.jsx](src/App.jsx) and a contract test for `ai-proxy` would be the highest-leverage next step.

---

## 6. Configuration

### Frontend build-time (GitHub Actions secrets)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Supabase Edge Function secrets (server-only)
- `ANTHROPIC_KEY` — used by `ai-proxy`; never exposed to the browser.
- `RESEND_API_KEY` — used by `send-invitation`; from [resend.com](https://resend.com).
- `FROM_EMAIL` — verified sender, e.g. `Imari <invites@yourdomain.com>`.
- `APP_URL` — public app origin used to build accept links, e.g. `https://princenshuti.github.io/imari-portfolio/`.

Deploy the function with:
```bash
supabase functions deploy send-invitation
supabase secrets set RESEND_API_KEY=re_... FROM_EMAIL='Imari <invites@yourdomain.com>' APP_URL='https://princenshuti.github.io/imari-portfolio/'
```

### Local development
```bash
git clone https://github.com/princenshuti/imari-portfolio.git
cd imari-portfolio
cp .env.example .env.local   # fill in VITE_SUPABASE_*
npm install
npm run dev                  # http://localhost:5173
```

If `VITE_SUPABASE_URL` is empty, the app falls back to `localStorage` persistence and the AI advisor is disabled.

---

## 7. Known limits & next steps

- **No automated tests.** Regressions are caught visually or by users.
- **Single Postgres row per portfolio.** Portfolio state is one JSON blob; large portfolios will eventually need a normalised schema for query efficiency.
- **No audit log.** Member edits overwrite silently — there's no per-field history beyond snapshots.
- **Anthropic rate limits are global to the function**, not per user; abuse mitigation is basic.
- **Tax report is hard-coded to 2024 RRA bands.** Needs yearly maintenance.

---

## 8. Pointers

- Live site: https://princenshuti.github.io/imari-portfolio/
- Repo: https://github.com/princenshuti/imari-portfolio
- Deploy workflow: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- Schema: [supabase/schema/](supabase/schema/)
- Edge functions: [supabase/functions/](supabase/functions/)
