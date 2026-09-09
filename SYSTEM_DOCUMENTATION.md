# Imari Platform — System Documentation

**Repository:** [princenshuti/imari-portfolio](https://github.com/princenshuti/imari-portfolio)
**Live:** https://imali.princenshuti.com/ (cPanel, deployed via Git Version Control)
**Staging preview:** https://princenshuti.github.io/imari-portfolio/ (local build pushed to verify before promoting)
**Last updated:** 2026-06-11

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
- **`family_habit_logs`** / **`family_notes`** (migration 006) — the Family module's row-level tables: one row per (week, habit) tick and one row per note key. Kept *out* of the portfolio JSON blob on purpose so two members editing the same week never clobber each other through the compare-and-swap save. RLS = membership **and** the `family` entitlement feature; `updated_by` is forced to `auth.uid()`.

RLS policy `user_has_portfolio_access()` gates all reads/writes by membership. Foreign keys cascade on portfolio delete.

---

## 3. Features (shipped to production)

All features below are implemented end-to-end (CRUD + persistence + UI) and live on the deployed site. The code has no `TODO`/`coming soon` placeholders in user-facing paths.

> **Testing status:** calculation logic (reducer, `src/engine/*`, import/search services) is covered by a Vitest suite (`npm test`); UI paths are manually verified and protected by the CI build (a Vite build failure blocks deploy). See [§5 Testing](#5-testing).

### Authentication & onboarding
- Email/password sign-up and sign-in — [Login.jsx](src/views/Login.jsx)
- Password reset via recovery magic link — [ResetPassword.jsx](src/views/ResetPassword.jsx)
- First-login name prompt — [NamePrompt.jsx](src/components/NamePrompt.jsx)
- Auto-creates an empty portfolio on first login — [cloud.js:72](src/cloud.js)
- Invite links (`?invite=...`) auto-accepted post-login — [App.jsx:314](src/App.jsx)

### Dashboard — independent widget system (2026-06)
- **17 independent widgets**, each individually movable and hideable: Net worth hero, Portfolio Model (live), Key Metrics, Asset Allocation, Financial Ratios, Cash Flow (6M), Cash Flow by Category, Alerts, Monthly Income, Liquidity Position, Retirement Readiness, Idle Cash, Personal Macro, Category Performance, vs. Benchmarks, Goals Progress, Markets Watchlist.
- **Arrange mode** collapses every widget to a labeled handle strip; drag-to-reorder runs on Motion `Reorder` spring physics (FLIP — other widgets move aside live), works on touch, and persists per swap. Saved layouts from the pre-split scheme migrate automatically via legacy-id expansion.
- **Portfolio Model — Live**: a quant-desk widget computed only from the user's own data — allocation bars that re-spring as values change, counting group values, net monthly flow, the engine's +1Y projection with low–high band (same `projectNetWorth` math as Fast Forward), savings rate, active signal count, and a provenance line (T-bill / CPI reference rates).
- Net worth (gross assets − liabilities), cost basis, gain/loss; composition donut by asset class
- AI insight card — sends portfolio snapshot to Claude, renders markdown
- 60-day synthetic history seeded on first run for chart continuity
- Milestone celebrations when net worth crosses thresholds

### Motion & interaction design (2026-06)
- One shared motion vocabulary ([components/motion.jsx](src/components/motion.jsx)): a single easing curve + spring (stiffness 300, damping 26) across the entire app — `Reveal`, `Stagger`/`StaggerItem`, `CountUp`, `BarFill`.
- App-wide coverage: spring modal/dialog entrances, toast enter/exit/stack-reflow (`AnimatePresence`), Motion-driven page transitions, sliding sidebar active indicator (`layoutId`), mobile sheet springs, staggered list entrances in every data view, FLIP re-sort on the Trends watchlist, tactile button press.
- Accessibility: a root `MotionConfig reducedMotion="user"` makes every animation respect the OS prefers-reduced-motion setting automatically; counters render final values instantly for reduced-motion users.

### Landing page (pre-auth brand surface)
- Every displayed figure derives from the same engine `REFERENCE` rates the product computes with (T-bill, CPI) — the marketing page cannot drift from the app. The FX pulse card shows the genuinely live BNR rate and only earns its "live" badge when real data has arrived.
- Scroll-triggered reveals (IntersectionObserver), count-up hero dashboard mock, lazy 3D advisor scene (skipped under reduced-motion / data-saver / 2G), EN/FR/RW language switcher, theme toggle shared with the app.

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
- Recurring (monthly / quarterly / annually) or one-time
- One-time entries linked to an account adjust that account's `currentValue`
- Savings-rate computation, filters by date & category
- Bank/MoMo statement import (CSV/Excel) with keyword + user-rule + batched-AI categorisation — [bankImport.js](src/services/bankImport.js)
- Receipt photo → pre-filled expense draft (vision OCR via `ai-proxy`, B13)
- Recurring-subscription audit: per-line monthly equivalents with annual cost framing — [recurringAudit.js](src/engine/insights/recurringAudit.js)
- 30-day balance forecast from recurring entries + future one-offs, with named crunch day — [forecast.js](src/engine/forecast.js)
- Monthly budget envelopes per expense category, paced against month progress; Dashboard widget — [budgets.js](src/engine/budgets.js)

### Categorisation rules
- User-defined "description contains X → category Y" rules, managed in Settings
- Applied to import drafts before the AI pass (user's word wins; AI only sees the rest) — [catRules.js](src/engine/catRules.js)

### Retirement readiness
- RSSB / Ejo Heza pension projection on the statutory contribution schedule, replacement-ratio readiness with Cost-of-Absence framing — [retirement/](src/engine/retirement/), [Retirement.jsx](src/views/Retirement.jsx)

### Year in Review
- Trailing-12-month reflection over daily snapshots: start→end change, high/low watermarks, month-by-month closes, best/toughest month; synthetic seed history flagged — [yearReview.js](src/engine/yearReview.js)

### Monthly Report
- Auto-generated, printable month report: totals with prior-month deltas, category breakdown, largest one-offs, budget outcomes, net-worth motion; CSV export — [monthlyReport.js](src/engine/monthlyReport.js)

### Global search
- TopBar search (⌘K / Ctrl-K) across assets, liabilities, goals, cash-flow entries, and app views — [search.js](src/services/search.js)

### Education layer
- Plain-language glossary (real vs nominal, CGT, concentration risk, runway, …) surfaced as click-to-open explainer chips under insight cards and in Settings — [glossary.js](src/glossary.js)

### Insight Engine (advisory rules)
16 deterministic, individually-tested rules in [src/engine/insights/](src/engine/insights/) — pure functions of (state, now, refs); every insight carries a quantified Cost-of-Absence, real source refs, and a `dataAsOf`. The engine decides WHAT; the AI explains HOW.
- Cash & debt: `debt-vs-idle-cash` (repay the expensive loan before buying T-bills — suppresses the competing T-bill pitch for the same money), `idle-cash-yield-gap`, `runway-months`
- Foresight: `obligation-smoothing` (monthly set-aside for an uncovered upcoming lump), `maturity-reinvestment`, `tax-deadline-exposure`, `goal-pace-gap` (absurd-slippage capped at honest "out of reach" copy)
- Risk: `fx-debt-exposure` (modeled 5% depreciation scenario, silent without income data), `concentration-risk`, `receivable-overdue`
- Wealth quality: `rental-yield-gap`, `real-vs-nominal`, `income-generating-share`, `land-revaluation-stale`, `pension-contribution-gap`, `top-mover-attribution`
- Honesty discipline: rules go silent when data is insufficient; scenarios are labelled modeled; emergency buffers are never recommended for spending.

### AI advisor + Advice Center
- The Advisor view opens with **Today's recommendations** — the engine's ranked insights, each with its number, deep-link action, and a "Discuss" button that hands it to the chat. The sidebar Advisor item shows a live recommendation-count badge.
- Multi-turn chat grounded in the user's portfolio snapshot **and provenance-tagged market conditions** (BNR FX buy/sell with rate dates, CPI, repo rate, RSE, T-bill reference); the prompt forbids recomputing totals or quoting market figures from memory.
- Markdown rendering; history capped at 80 messages; input capped to protect tokens
- Routed through `ai-proxy` Edge Function (Anthropic key never reaches the browser)

### Progressive features
- The menu starts at four core items (Dashboard, Assets, Advisor, Settings) and grows with the user's data: first expense reveals Cash Flow + Reports, first debt reveals Liabilities, a salary/pension reveals Retirement, etc. — [features.js](src/features.js)
- Settings → Features: explicit force-on/off per module with an "auto" indicator and reset. Hidden is never blocked — routes, search, and deep links still resolve.
- Gated modules (`gated: <feature>` in `FEATURE_MODULES`) read the portfolio's entitlement instead of data, ignore the Settings toggle, and are hidden from the Settings list. First user: the Family module.

### Family module (Sprint 1, 2026-09)
Household planning shared by every member of a portfolio — the 2026 standalone family dashboard folded into Imari as a nav group.
- **Family Home** ([Family.jsx](src/views/Family.jsx)) — money cockpit read from the engine (net worth, runway, debt remaining, largest loan end date), this week's score, the 17 annual milestones (tick = done-date), five shared planning notes with debounced autosave, and the top-5 active goals with progress.
- **Scorecard** ([FamilyScorecard.jsx](src/views/FamilyScorecard.jsx)) — 33 habits in 7 areas per week (Monday-keyed, local dates), rating + streak, month cards with week drill-down, yearly heatmap and per-area averages, weekly reflection note, and a one-off importer for the old dashboard's localStorage JSON.
- Engine: [family/habits.js](src/family/habits.js) — stable habit ids, week math, scoring, roll-ups and the legacy mapper (unit-tested). Data: [family/cloud.js](src/family/cloud.js) (scoped upserts, chunked import, realtime channel) and [family/useFamily.js](src/family/useFamily.js) (optimistic writes with rollback, live rows from the other member).
- Gate: entitlement feature `family` (service-role insert — snippet at the foot of `supabase-migration-006.sql`). Both views are lazy chunks; nothing family-related loads for non-entitled users beyond one `entitlements` read.
- Viewers see everything read-only (inputs disabled) and RLS refuses their writes regardless.

### Family module — Sprint 2 (2026-09): calendar, household, insurance, documents, wish list
- **Data**: one generic row-level table `family_items` (migration 007; kinds `event | task | policy | document | wish`, typed columns kind/title/due_date/amount/status + ≤8 KB jsonb `data`). Field specs, validation (`normalizeItem`), the derived calendar, wish affordability and insurance-gap detection are pure and tested in [family/planning.js](src/family/planning.js). Access: [family/items.js](src/family/items.js) + [family/useItems.js](src/family/useItems.js) (optimistic, realtime). Shared editor/chrome: [family/ui.jsx](src/family/ui.jsx).
- **Calendar** ([FamilyCalendar.jsx](src/views/FamilyCalendar.jsx)) — derived, not maintained: family events (yearly repeats), open tasks, policy renewals, document expiries, wish targets, goal deadlines, loan end dates, next occurrence of recurring expense cashflows, and Rwanda statutory dates that follow from owned assets (RRA fixed-asset tax 31 Mar, vehicle road levy 31 Dec). ICS feed via edge function `family-ics` (`--no-verify-jwt`): a 256-bit capability token per portfolio in `family_calendar_tokens` (editors create/rotate/disable in the app), service-role read, entitlement re-checked, RFC 5545 escaping, per-token rate limit.
- **Household** ([Household.jsx](src/views/Household.jsx)) — shared tasks with owner + repeat (completing a repeating task schedules the next one) and the recurring bills already in Cash Flow with next due date.
- **Insurance** ([Insurance.jsx](src/views/Insurance.jsx)) — policies with premium/frequency/cover/renewal/linked asset; uninsured vehicles/houses surfaced as a cost-of-absence card; one-click push of the premium into Cash Flow as a recurring expense (idempotent via `data.cashflow_id`).
- **Documents** ([Documents.jsx](src/views/Documents.jsx)) — metadata in `family_items`, files in the PRIVATE bucket `family-docs` (10 MB, PDF/JPG/PNG/WebP) under `<portfolio>/<item>/<file>`; storage policies resolve the portfolio from the path through `family_doc_access()` (safe cast, never errors into allow); files open via 60-second signed URLs; only a 4-character reference hint may be stored, never a full ID number.
- **Wish list** ([Wishlist.jsx](src/views/Wishlist.jsx)) — priority-ranked wishes with an affordability verdict (liquid − 3-month buffer vs cost; months-to-afford from the 6-month savings pace) and “Make it a goal” (creates a liquid-funded Goal, idempotent via `data.goal_id`).
- Family Home gained a “Next two weeks” card from the same derived calendar.
### Family module — Sprint 3 (2026-09): advisor context + tools, family insights, Sunday review
- **Advisor grounding** — when the household is entitled, [App.jsx](src/App.jsx) loads one family bundle ([family/useFamilyBundle.js](src/family/useFamilyBundle.js)) and the floating advisor adds a compact `<FAMILY_DATA>` block ([family/context.js](src/family/context.js) `familySummary`, < 1.5 KB, same helpers as the screens; the portfolio JSON budget drops from 6200 to 4600 chars to stay under the 8000-char proxy cap).
- **Advisor tools** — `ai-proxy` owns three tool definitions (`family_add_item`, `family_tick_habits`, `family_update_plan`) behind `toolset: 'family'`; the browser only executes allow-listed names through the same RLS-scoped functions the forms use (`runFamilyTool` → `normalizeItem`/habit ids/plan fields), so the model gains no authority a form lacks. Multi-turn: `completeChatTools` in [ai.js](src/ai.js) runs ≤ 3 rounds; the proxy validates tool_use/tool_result blocks (ids, names, sizes). No delete tool by design. Actions are echoed as "✓ …" lines in the chat.
- **Family insight rules** — `FAMILY_RULES` (renewal/expiry due, uninsured vehicle/house, scorecard slipping late in the week) run inside the shared engine only when `ctx.family` is present ([engine/insights/index.js](src/engine/insights/index.js)); family item ids and the `family-scorecard` pseudo-ref are accepted by the stale-ref guard.
- **Sunday review** — edge function `family-weekly-review` (`--no-verify-jwt`; auth = `x-review-secret` for the scheduler across all entitled households, or a user JWT for that editor's own portfolio, 10-minute dedupe). Computes facts server-side (scorecard by section, next 7 days, liquid/debt/runway from the portfolio jsonb + fx), Claude Haiku narrates 120–180 words (fallback text if the key is missing), stored as `family_notes` key `review:<monday>` (Family Home "Sunday review" card, live via realtime, "Write it now" button). Delivery: n8n workflow **Imari · Family Sunday Review** (id `1QkwwBVatcD7h8jS`, Sunday 18:00 Africa/Kigali, error workflow `P5KmDb1UvpuUlXRz`) → HTTP POST → Split Out → Gmail to member emails. Secrets: `FAMILY_REVIEW_SECRET`, `APP_URL` (Supabase); the same secret sits in the n8n HTTP node header — rotate both together.
- **Family data layer is lazy (2026-09).** `App.jsx` mounts a render-nothing `FamilyBridge` (React.lazy) only for entitled households; it hands the engine and the advisor the family rules, id set, summary and tool runner, so nothing under `src/family/` is in the main chunk (389 KB vs 418 KB when it was static). `runFamilyTool` is idempotent for `family_add_item` (same kind/title/date → “Already exists”), and the advisor prompt states that ✓ lines are completed actions — a follow-up question once re-created a task.
- **Dependencies (2026-09-08):** `npm audit fix` closed all 19 Dependabot alerts (vite 6.4.3, postcss 8.5.28, @babel/core 7.29.7, browserslist 4.28.9, fast-uri, brace-expansion, nanoid — build tooling only); production output was byte-identical.
### Security & operations audit (2026-09-09)
- **Cross-user isolation, verified empirically**: impersonating two real users and `anon` at the database (rolled-back transaction) — the second user sees 0 rows of the first user's portfolio, members, invitations, entitlements, family tables, calendar token and document objects; inserts into another portfolio's family_items, self-granting an entitlement and updating another portfolio are all refused by RLS; `anon` sees nothing (including exchange_rates, which are authenticated-only). RLS is enabled on every public table.
- **Input hygiene**: `reducer.scrub()` is the single choke point for user-typed fields (control chars stripped; 300-char labels, 4 000-char notes/bio, data URIs kept ≤ 4 MB, prototype keys dropped); family tables enforce their own DB checks (migration 006/007); migration 008 adds per-column size caps on the portfolio document (assets 12 MB, cashflows 6 MB, profile/snapshots 2 MB, others ≤ 1 MB), a 120-char portfolio name cap and an e-mail format constraint on invitations. AI replies are HTML-escaped before markdown-lite rendering; the two `dangerouslySetInnerHTML` sinks only ever receive `renderMD()` output.
- **Rate limits**: ai-proxy 12 req/min/user; send-invitation 5 e-mails/10 min/user + owner-only + invite cap; family-weekly-review 3 req/10 min/user on the in-app path (+10-min dedupe) and shared-secret on the scheduler path; family-ics 60 req/5 min/token; Supabase Auth (dashboard): 100 e-mails/h, 150 token refreshes/5 min/IP, 100 verifications/5 min/IP, 30 anonymous/h, 100 sign-ins/5 min/IP. Note: function limiters are per-instance memory — strict enough to stop bill bombs, not a substitute for a table-backed limiter if abuse appears.
- **Auth policy (dashboard, read 2026-09-09)**: e-mail OTP / reset / magic links expire after 3600 s; invitations after 14 days (DB); access tokens 3600 s with refresh-token rotation; min password 8 chars with lower/upper/digit/symbol; secure e-mail change, secure password change and require-current-password ON; leaked-password check OFF (Pro plan only); session time-box/inactivity are Pro-only. Recommended tightening: OTP expiry 1800 s.
- **Error handling**: React ErrorBoundary with reload; every Family screen shows load/save errors inline and rolls back optimistic writes; edge functions always answer JSON `{error}` with the right status; n8n workflows carry the shared error workflow `P5KmDb1UvpuUlXRz`; new: `window` `error` / `unhandledrejection` listeners surface a toast so nothing fails silently.
- **Why invitations never sent**: `send-invitation` refused to run without `RESEND_API_KEY` + `FROM_EMAIL`, which were never set. Fix: a second transport — n8n workflow **Imari · Transactional e-mail (Gmail)** (id `zGrAB4vnsWemYuh7`, webhook `/webhook/imari-email`, gated by `onlyRunIf` on header `x-email-secret`, Gmail credential `LmmJhjVFDXjWI1Qv`); Supabase secrets `EMAIL_WEBHOOK_URL` + `EMAIL_WEBHOOK_SECRET`. Resend still takes precedence when configured. The function now also validates the invitee e-mail and rejects expired invitations.
- **APIs configured (inventory)**: edge functions ai-proxy, bnr-rates (pg_cron 06:15 daily, rates fresh), send-invitation, family-ics, family-weekly-review; secrets ANTHROPIC_KEY, FAMILY_REVIEW_SECRET, APP_URL, EMAIL_WEBHOOK_URL/SECRET; n8n workflows `1QkwwBVatcD7h8jS` (Sunday review) and `zGrAB4vnsWemYuh7` (e-mail relay); external: BNR rates, Anthropic, Gmail (via n8n), Google/Apple Calendar (ICS). Not configured: Resend, WhatsApp, Web3/anonymous auth (disabled), captcha.
- **PWA shell is network-first (2026-09).** `index.html` left the Workbox precache and navigations use `NetworkFirst` (3 s timeout, cache fallback offline). Before this, every first load after a deploy served the previous build and users had to hard-reload to see new screens.

### Trends & market data
- Live crypto prices (CoinGecko) and FX (open.er-api.com fallback)
- BNR official rates (buy/avg/sell per currency) from the `bnr-rates` Edge Function, scheduled daily by pg_cron **and self-healing**: if the newest stored rate is older than 24h, any client visit re-triggers the function (idempotent 10-day upsert) — a dead cron can no longer cause silent indefinite staleness ([market.js](src/services/market.js))
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

1. Browser loads `index.html` from cPanel at the document root of `imali.princenshuti.com`.
2. Vite bundle boots React; [App.jsx](src/App.jsx) calls `supabase.auth.getSession()`.
3. If a session exists, [`loadOrCreatePortfolio`](src/cloud.js) queries `portfolios` joined with `portfolio_members` for the current user.
4. The returned portfolio JSON is dispatched as `replaceAll`, hydrating the reducer.
5. A realtime channel is opened on the portfolio row; remote edits dispatch `replaceAll` again.
6. The view named by `window.location.hash` is lazy-loaded inside `<Suspense>`.

### 4.2 Editing an asset

1. User opens **Assets**, clicks *Add*; `AssetEditor` modal opens.
2. On submit, `dispatch({ type: 'upsertAsset', asset })` runs the reducer ([App.jsx:104](src/App.jsx)).
3. If the asset is account-shaped (e.g. savings, mobile money), `currentValue` is recomputed from `purchasePrice + linkedCashflows`.
4. A debounced `useEffect` queues `savePortfolio(portfolioId, state, lastSeenUpdatedAt)` — saves are serialized per tab and **compare-and-swap on `updated_at`**: the UPDATE only lands if this tab has seen the row's current version. On conflict the client never overwrites; it re-fetches the authoritative row, adopts it, and shows "Another session saved newer changes." This is what stopped stale background tabs from silently reverting edits (the last-writer-wins bug, fixed 2026-06).
5. Other connected sessions receive a realtime payload and re-render (the payload's `updated_at` refreshes their concurrency token).

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

### 4.5 Deploy — staging vs production

**Staging (automatic).** Every push to `main` triggers [.github/workflows/pages.yml](.github/workflows/pages.yml): `npm ci` → `npm test` → `npm run i18n:audit` → `vite build --base=/imari-portfolio/` → publish to GitHub Pages at https://princenshuti.github.io/imari-portfolio/. Supabase URL/anon key come from repo secrets; the Anthropic key never does — it lives only as a Supabase Function secret.

**Production (deliberate, manual).** imali.princenshuti.com on cPanel. Promotion paths, in order of reliability:
1. `npm run deploy` locally — builds with base `/` and uploads `dist/` over FTPS ([scripts/deploy.mjs](scripts/deploy.mjs), credentials in gitignored `.env.deploy`). **Known issue (2026-06): the host's FTPS passive data connections time out from both CI and local — the cPanel HTTPS API (token in `.env.deploy`) is the working alternative.**
2. The Actions-tab "Deploy to cPanel" workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) — same FTP timeout issue.
3. cPanel Git Version Control + [.cpanel.yml](.cpanel.yml) — requires committing `dist/` to a deploy branch and clicking "Deploy HEAD" in cPanel.

Production deploys are never a side effect of a push — that was changed deliberately after a half-finished commit nearly shipped.

---

## 5. Testing

| Layer | Status |
|---|---|
| Unit tests | ✅ Vitest (`npm test`) — reducer money math, every `src/engine/*` module (insights, forecast, budgets, year review, monthly report, categorisation rules, retirement, projection, freshness), formatting helpers, statement import, search, glossary integrity. |
| Integration tests | None configured. |
| Type checking | None (project is plain JS, not TS). |
| Linting | Not enforced in CI. |
| i18n audit | ✅ `npm run i18n:audit` — locale completeness (en/fr/rw) + hardcoded-string gate on chrome files. |
| Build verification | ✅ `vite build` runs on every push to `main`; a failure blocks the deploy. |
| Runtime checks | React `StrictMode` is enabled in dev. |
| Manual QA | Each feature has been exercised against the deployed site. |

Convention: calculation logic lives in `src/engine/` with colocated `*.test.js`; no money math ships untested (R1). A contract test for `ai-proxy` remains the highest-leverage gap.

---

## 6. Configuration

### Frontend build-time (GitHub Actions secrets)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Supabase Edge Function secrets (server-only)
- `ANTHROPIC_KEY` — used by `ai-proxy`; never exposed to the browser.
- `RESEND_API_KEY` — used by `send-invitation`; from [resend.com](https://resend.com).
- `FROM_EMAIL` — verified sender, e.g. `Imari <invites@yourdomain.com>`.
- `APP_URL` — public app origin used to build accept links, e.g. `https://imali.princenshuti.com/`. Must match the deployed cPanel origin (no trailing slash is stripped at line 31 of `supabase/functions/send-invitation/index.ts`).

Deploy the function with:
```bash
supabase functions deploy send-invitation
supabase secrets set RESEND_API_KEY=re_... FROM_EMAIL='Imari <invites@yourdomain.com>' APP_URL='https://imali.princenshuti.com/'
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

### Post-migration checklist (cPanel cutover)

The cutover from GitHub Pages (`princenshuti.github.io/imari-portfolio/`) to cPanel (`imali.princenshuti.com`) changes the production origin. The frontend was updated, but three things live outside this repo and must be changed by hand once per environment:

1. **Rotate the `APP_URL` Supabase secret.** `supabase/functions/send-invitation/index.ts` builds invitation accept links from this. While the secret still points at the GH Pages URL, every invitation email goes to a dead link.
   ```bash
   supabase secrets set APP_URL='https://imali.princenshuti.com/'
   ```
2. **Add the new origin to Supabase Auth → URL Configuration → Redirect URLs.** Both `appRedirectURL()` (signup verification, password reset) and Supabase's own templated links check this allowlist. Add `https://imali.princenshuti.com/` (and keep the GH Pages URL for staging if you still verify there).
3. **Update the Supabase Auth Site URL** to `https://imali.princenshuti.com/`. This is the fallback Supabase uses when a `redirect_to` isn't in the allowlist — pointing it at the new prod avoids users landing on dead URLs.

Until all three are done, email-based auth and the invitation flow silently break on the new domain.

---

## 7. Known limits & next steps

- **UI flows have no automated tests.** 220 vitest tests cover every calculation engine, the reducer, services, and content integrity — but rendering/routing regressions are caught visually (a hooks-order crash once shipped to staging with all tests green). A headless smoke test in CI is the known gap.
- **Single Postgres row per portfolio.** Portfolio state is one JSON blob; large portfolios will eventually need a normalised schema for query efficiency.
- **No audit log.** Member edits overwrite silently — there's no per-field history beyond snapshots.
- **Anthropic rate limits are global to the function**, not per user; abuse mitigation is basic.
- **Tax report is hard-coded to 2024 RRA bands.** Needs yearly maintenance.
- ~~Advisor context truncation, session-local dismissals, per-consumer engine runs~~ — *resolved 2026-06*: a budgeted serializer ([advisorContext.js](src/services/advisorContext.js)) guarantees complete JSON inside the 8000-char cap; dismissals persist on `profile.dismissedInsights` with a 7-day TTL; [InsightsContext](src/contexts/InsightsContext.jsx) runs the engine once per state change for all consumers. The engine remains in the main bundle by design (the sidebar badge needs it at startup).
- **Supabase schema must be at migration 007** (005 = `portfolios.catrules/budgets`; 006 = Family scorecard tables + `portfolio_has_feature()`; 007 = `family_items`, `family_calendar_tokens`, `family-docs` bucket + storage policies). Family views show a load error until applied and the portfolio holds the `family` entitlement. Edge function `family-ics` must be deployed with `--no-verify-jwt`.

### Deferred to the Imari mobile app (2026-06)

These features are documented in `docs/IMARI_FEATURE_BUILD_GUIDE.md` and were partially scaffolded in the web codebase, but require capabilities a PWA can't provide. They were removed from the active web codebase and will be rebuilt as part of the mobile app:

- **§3 MoMo SMS auto-sync** — needs `READ_SMS` permission (Android), not available to browsers. Web users use the bank/MoMo statement importer (`src/services/bankImport.js`, exposed in CashFlow) as the equivalent capture path. The parser code (`src/parsers/momo/`) was deleted.
- **§4 WhatsApp Quick-Entry + nudges** — WhatsApp Business API provisioning, phone verification, and the always-on webhook lifecycle belong with the native build. The two Edge Function sources (`whatsapp-inbound`, `whatsapp-nudge`) were deleted from `supabase/functions/`.

The `whatsapp_links` table (`supabase-migration-004.sql`) is **preserved in the schema** so the mobile rebuild reuses it without a new migration. Don't drop it without coordinating with mobile work.

---

## 8. Product snapshot — investor-facing summary

A factual one-page digest for pitch material. Every claim below is verifiable in this repo or the live product; nothing is aspirational.

**What Imari is.** Rwanda's personal wealth tracker: the full net worth — Kigali plots (UPI-anchored), RSE shares, T-bonds, MoMo wallets, 16 banks, livestock, crypto, pensions — in one honest dashboard, with an insight engine that prices what ignoring your money costs you.

**The thesis (loss aversion, "Cost of Absence").** Every advisory insight is ranked by what inaction costs — in francs, days, and risk — computed deterministically from the user's own data. 16 individually-tested rules; the AI only phrases what the math already proved. Honesty discipline is a feature: figures are dated, sourced, floored (never rounded up), and rules go silent when data is thin.

**Built for Rwanda's rails, not adapted to them.** BNR official FX (daily, self-healing scraper), RRA tax estimates (Fixed Asset Tax, vehicle levy, CGT, EBM VAT credit), RSSB + Ejo Heza pension projection on the statutory schedule, UPI land-title anchoring, MTN MoMo / Airtel statement import with AI categorisation, EN/FR/Kinyarwanda. This is the moat a global app can't reach.

**Product maturity.**
- ~20 views, 17 movable dashboard widgets, PWA installable + offline, realtime multi-device sync, role-based sharing (owner/editor/viewer — diaspora trustee use-case), 25+ asset classes.
- App-wide motion design system on a single physical vocabulary; OS-level reduced-motion compliance.
- 220 automated tests over all money math; i18n completeness gated in CI; build failure blocks deploy.

**Security model (privacy as positioning).** No bank passwords — ever (statement upload, not credential scraping; nothing to phish). Anthropic key lives server-side only (JWT-validated edge function proxy). Postgres row-level security on every row. Compare-and-swap concurrency so devices never silently overwrite each other. Financial data never used to train AI models.

**Monetisation surface (illustrative tiers on the landing page).** Free core (know your number) → Plus (insight engine, statement import, AI advisor, tax pack) → Family & Diaspora (multi-member, trustee access, multi-currency statements).

---

## 9. Pointers

- Live site: https://imali.princenshuti.com/
- Staging preview: https://princenshuti.github.io/imari-portfolio/
- Repo: https://github.com/princenshuti/imari-portfolio
- cPanel deployment manifest: [.cpanel.yml](.cpanel.yml)
- Deploy workflow (legacy/optional FTP path): [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- Schema: [supabase/schema/](supabase/schema/)
- Edge functions: [supabase/functions/](supabase/functions/)
