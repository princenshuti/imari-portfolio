# Imari — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Product** | Imari by Maxventures — personal wealth & asset tracker (Rwanda-first) |
| **Document version** | 1.0 |
| **Author** | Nshuti Prince (Maxventures Ltd.) |
| **Last updated** | 2026-05-28 |
| **Status** | Baselined against the production build on `main` |
| **Live** | https://princenshuti.github.io/imari-portfolio/ |
| **Repo** | https://github.com/princenshuti/imari-portfolio |

> This PRD documents the **as-built** product and defines requirements for ongoing development. Requirement IDs are stable references for issues, tests, and traceability.

---

## 1. Problem statement

Financially-active Rwandans hold wealth across fragmented silos — bank accounts, mobile money, RSE & foreign equities, government bonds, real estate, vehicles, livestock, crypto and business equity — denominated in multiple currencies. No single tool gives them an honest, consolidated, RWF-aware net-worth view, and none compute Rwanda-specific tax exposure (RRA Fixed Asset Tax, the new Vehicle Road Maintenance Levy, Capital Gains Tax). Generic foreign apps ignore the BNR FX reality, RSE/NISR data, and local money rails.

## 2. Objectives & success metrics

### Objectives
- **O1.** Give a user a trustworthy, reconciled net-worth figure across all pages and currencies.
- **O2.** Make Rwanda-specific tax exposure visible and deadline-aware.
- **O3.** Provide decision support (alerts, ratios, AI advisor) grounded in the user's real data.
- **O4.** Enable safe household/advisor sharing.
- **O5.** Be fast, installable, and usable offline on modest devices and networks.

### Success metrics (KPIs)
| Metric | Target |
|---|---|
| Time-to-first-net-worth (signup → dashboard populated) | < 5 min |
| Activation: % of new users with ≥3 assets in week 1 | ≥ 60% |
| Cross-page number consistency defects | 0 (P0 if found) |
| Dashboard interactive (cached, mid-tier mobile) | < 2.5 s LCP |
| 4-week retention | ≥ 35% |
| AI advisor: % sessions using it | ≥ 25% |
| Tax Report views in Jan–Mar (RRA season) | ≥ 50% of MAU |
| Crash-free / error-free sessions | ≥ 99% |

---

## 3. Target users & personas
See companion doc *Product Use Cases & Features* §2. Summary: Kigali professional (P1), diaspora investor (P2), SME owner/landlord (P3), household CFO (P4), tax-conscious owner (P5). Roles: **Owner / Editor / Viewer**.

---

## 4. Scope

### In scope (shipped)
Authentication & onboarding; Dashboard; Assets; Accounts; Liabilities; Cash Flow; Goals; Trends; Tax Report; AI Advisor; Settings (incl. members, FX, backup, i18n); PWA/offline; real-time sync; RBAC.

### Out of scope (non-goals)
Money movement / trade execution; live RSE/BNR/NISR market quotes; automated bank-account aggregation; tax *filing*; PDF/OFX/MT940 statement parsing; native iOS/Android binaries (PWA only).

---

## 5. Functional requirements

> Convention: `FR-<MODULE>-<n>`. "Must" = required in current release; "Should" = expected; "May" = optional/future.

### 5.1 Authentication & onboarding (AUTH)
- **FR-AUTH-1 (Must)** Support email/password sign-up and sign-in via Supabase Auth.
- **FR-AUTH-2 (Must)** Support password reset via recovery magic link.
- **FR-AUTH-3 (Must)** Prompt first-time users for a display name and auto-create an empty portfolio.
- **FR-AUTH-4 (Must)** Accept `?invite=…` links and bind the user to the invited portfolio + role on first sign-in.
- **FR-AUTH-5 (Must)** Provide an onboarding wizard with ≥9 Rwanda asset templates, a sample-portfolio loader, and a skip option; templates open a pre-filled editor (no silent creation).
- **FR-AUTH-6 (Should)** Fall back to `localStorage` persistence when Supabase is unconfigured (AI disabled in that mode).

### 5.2 Dashboard (DASH)
- **FR-DASH-1 (Must)** Display net worth = gross assets − liabilities, in the display currency.
- **FR-DASH-2 (Must)** All headline figures (sidebar, hero, KPI strip) must derive from a single source of truth and never disagree within a render.
- **FR-DASH-3 (Must)** Show a KPI strip; when liabilities = 0, replace the redundant tile with a distinct metric (Liquid balance).
- **FR-DASH-4 (Must)** Render a 24-month net-worth area chart with hover crosshair + value tooltip.
- **FR-DASH-5 (Must)** Show asset-allocation donut, financial ratios (liquidity, income-generating, debt-to-asset, debt-to-income), category performance, top movers, and a benchmark comparison.
- **FR-DASH-6 (Must)** Surface alerts (concentration > 25%, overdue receivables, bonds < 90 days to maturity, losses < −20%, maintenance assets); collapse to a "healthy" banner when none.
- **FR-DASH-7 (Should)** Provide an AI insight card with auto-generation, 24h TTL, and manual regenerate.
- **FR-DASH-8 (Should)** Provide an "Arrange" mode to reorder/hide sections, persisted per browser.
- **FR-DASH-9 (Should)** Celebrate net-worth milestones on threshold crossing.

### 5.3 Assets (ASSET)
- **FR-ASSET-1 (Must)** Support the 14 asset classes defined in `data.js` across 11 groups, each with its valuation rule.
- **FR-ASSET-2 (Must)** Provide class-aware suggested valuation with one-click apply and manual override.
- **FR-ASSET-3 (Must)** CRUD assets with conditional fields per class (incl. UPI, property category, size m², vehicle category/levy, shares/units/last price, yield, maturity, location hierarchy, income generation, photos ≤3, documents ≤5 @ ≤2MB).
- **FR-ASSET-4 (Must)** Provide search, 9-way sort, type & location filters, and clear-filters.
- **FR-ASSET-5 (Must)** Support inline current-value edit and multi-select bulk delete with destructive confirmation.
- **FR-ASSET-6 (Must)** Provide Excel template download, import (merge by natural key) with preview and skipped-row reporting, and export.
- **FR-ASSET-7 (Should)** Provide full keyboard navigation of the asset table.

### 5.4 Accounts (ACCT)
- **FR-ACCT-1 (Must)** Manage bank & mobile-money accounts (multi-currency) as a lens over the Cash & savings asset group.
- **FR-ACCT-2 (Must)** Mask account numbers consistently and show institution, yield, currency, and last-activity.
- **FR-ACCT-3 (Should)** Derive a balance hint from linked one-time cashflows.

### 5.5 Liabilities (LIAB)
- **FR-LIAB-1 (Must)** CRUD 7 liability types with rate, original/remaining amount, term, lender.
- **FR-LIAB-2 (Must)** Deduct liabilities from net worth and show true net worth.
- **FR-LIAB-3 (Must)** Show payoff progress and a maturity/overdue countdown.
- **FR-LIAB-4 (Should)** Provide an amortization analysis (PMT, total interest, effective APR, payoff with extra payments).

### 5.6 Cash Flow (CF)
- **FR-CF-1 (Must)** CRUD income/expense entries with category, currency, date, and frequency (once/monthly/quarterly/annually).
- **FR-CF-2 (Must)** Pro-rate recurring entries into monthly figures for KPIs and charts.
- **FR-CF-3 (Must)** Compute savings rate and show income-vs-expense bars (6M/12M) + expense-by-category donut.
- **FR-CF-4 (Must)** Only "Once" entries linked to an account adjust that account's balance.
- **FR-CF-5 (Should)** Provide a bank/MoMo statement-import wizard (CSV/TSV/Excel) with Rwanda-merchant auto-categorization, fee splitting, confidence flagging, and a batched AI pass for low-confidence rows; require resolving flagged rows or explicit "import as-is."
- **FR-CF-6 (Should)** Support receipt image attachment (compressed, with lightbox).
- **FR-CF-7 (Should)** Warn when fewer than 3 months of data are present.

### 5.7 Goals (GOAL)
- **FR-GOAL-1 (Must)** CRUD goals with category, target, deadline, and funding source (net worth / liquid only / specific assets).
- **FR-GOAL-2 (Must)** Show progress vs target with milestone ticks (25/50/75%) and a status pill (on track/slipping/overdue/done).
- **FR-GOAL-3 (Should)** Compute required monthly contribution to hit the goal by deadline.
- **FR-GOAL-4 (Should)** Offer ≥9 Rwanda-tuned goal templates.

### 5.8 Trends (TREND)
- **FR-TREND-1 (Must)** Display market indicators grouped by domain with **Live / Reference / Modeled** provenance badges and source attribution.
- **FR-TREND-2 (Must)** Fetch live FX, gold, and crypto; degrade gracefully to reference values when APIs are unreachable.
- **FR-TREND-3 (Must)** Read the same FX overrides the rest of the app uses (no divergent rates between Trends and Dashboard).
- **FR-TREND-4 (Should)** Provide a personal watchlist and a "How is this computed?" disclosure for modeled indicators.
- **FR-TREND-5 (Should)** Show Kigali real-estate indicative price/m² by neighbourhood.

### 5.9 Tax Report (TAX)
- **FR-TAX-1 (Must)** Compute Fixed Asset Tax per property with category rates, residential RWF 3M exemption, and agricultural ≤2 ha exemption.
- **FR-TAX-2 (Must)** Compute the Vehicle Road Maintenance Levy per vehicle (Law 013/2025) with exemptions.
- **FR-TAX-3 (Must)** Estimate Capital Gains Tax (5%; bonds exempt) and 15% withholding on investment income.
- **FR-TAX-4 (Must)** Show the next obligation/deadline and a missing-data audit with deep links to fix.
- **FR-TAX-5 (Should)** Provide a late-payment penalty estimator and Print/Save-PDF.
- **FR-TAX-6 (Must)** Display a disclaimer (estimates, not filing) with RRA citations and contact.

### 5.10 AI Advisor (AI)
- **FR-AI-1 (Must)** Provide multi-turn chat grounded in a compact portfolio snapshot.
- **FR-AI-2 (Must)** Route all model calls through the `ai-proxy` Edge Function; the Anthropic key must never reach the browser.
- **FR-AI-3 (Must)** Enforce a model allowlist, per-user rate limit, input length caps, and prompt-injection hardening server-side.
- **FR-AI-4 (Should)** Offer portfolio-tailored prompt templates, asset-name highlighting, and bookmarking of insights.
- **FR-AI-5 (Must)** Show a persistent "not professional advice" disclaimer.

### 5.11 Settings (SET)
- **FR-SET-1 (Must)** Manage profile (name, currency, avatar, bio, phone, location) and theme (auto/light/dark).
- **FR-SET-2 (Must)** Switch locale (en/fr/rw), persisted and synced.
- **FR-SET-3 (Must)** Owner-gated member management: invite Editor/Viewer, manage pending invites (copy/resend/revoke), change/remove roles.
- **FR-SET-4 (Must)** Show daily-synced BNR rates with manual fallback overrides.
- **FR-SET-5 (Must)** Provide JSON backup/restore and net-worth milestone management.
- **FR-SET-6 (Must)** Provide a danger zone (reset-to-sample, delete-all) gated by typed `DELETE` confirmation.
- **FR-SET-7 (Should)** Allow a personal Anthropic key (browser-only) when no shared key is configured.

### 5.12 Platform (PLAT)
- **FR-PLAT-1 (Must)** Persist to Supabase Postgres with `localStorage` fallback; debounced auto-save.
- **FR-PLAT-2 (Must)** Sync edits across open sessions in real time.
- **FR-PLAT-3 (Must)** Be installable as a PWA and render cached data offline.
- **FR-PLAT-4 (Must)** Use hash-based routing with deep links that survive reload.
- **FR-PLAT-5 (Must)** Enforce access via Postgres RLS keyed on portfolio membership.

---

## 6. Non-functional requirements

### Performance (NFR-PERF)
- **NFR-PERF-1** Dashboard LCP < 2.5 s on a mid-tier mobile over 3G-fast, against cached data.
- **NFR-PERF-2** Per-view JS chunk (code-split) gzipped < 60 KB (Dashboard currently ~14 KB).
- **NFR-PERF-3** Animations limited to transform/opacity; UI transitions ≤ 300 ms; respect `prefers-reduced-motion`.

### Security & privacy (NFR-SEC)
- **NFR-SEC-1** Secrets (Anthropic, Resend) live only server-side as Supabase Function secrets; never bundled.
- **NFR-SEC-2** All data access gated by RLS membership checks; foreign keys cascade on portfolio delete.
- **NFR-SEC-3** AI proxy authenticates JWT, rate-limits (≤12 req/min/user), allowlists models, caps token usage, and sanitizes message roles.
- **NFR-SEC-4** No bank credentials are ever requested or stored (manual entry + statement files only).
- **NFR-SEC-5** TLS for all transport; JWT auto-refresh on focus.

### Accessibility (NFR-A11Y)
- **NFR-A11Y-1** WCAG 2.1 AA color contrast for text and UI.
- **NFR-A11Y-2** Gain/loss conveyed by color **and** ▲/▼ glyph.
- **NFR-A11Y-3** Accessible names on icon-only controls; charts expose `aria-label`/`role="img"`.
- **NFR-A11Y-4** Full keyboard navigation incl. the asset table; visible focus rings; skip-to-content.

### Internationalization (NFR-I18N)
- **NFR-I18N-1** Support English, French, Kinyarwanda for app chrome and onboarding; RWF default with RWF/USD/EUR/KES.
- **NFR-I18N-2** Tax/marketing-trust prose may remain English pending native financial-vocabulary review.

### Reliability & availability (NFR-REL)
- **NFR-REL-1** Graceful degradation when market APIs or Supabase are unreachable (cached/reference values, localStorage).
- **NFR-REL-2** ErrorBoundary prevents full-app crashes; failed AI calls return a generic message with a correlation id.

### Maintainability (NFR-MAINT)
- **NFR-MAINT-1** Single navigation source of truth (`nav.js`); shared design tokens in `styles.css`.
- **NFR-MAINT-2** CI build (`vite build`) must pass to deploy; build failure blocks release.

---

## 7. Data model

**Postgres tables (RLS-enforced):**
- **`portfolios`** — one row per portfolio; holds the full state JSON (assets, liabilities, goals, cashflows, snapshots, chat, profile, fx).
- **`portfolio_members`** — user↔portfolio with role (`owner | editor | viewer`).
- **`portfolio_invitations`** — tokenized invites, 14-day expiry, consumed on first sign-in.

**Core client entities (within state JSON):**
- **Asset** — `id, kind, name, currency, purchasePrice, purchaseDate, currentValue, + class-specific fields, location, incomeGenerates/Amount/Frequency, photos[], documents[]`.
- **Liability** — `id, kind, name, lender, currency, interestRate, originalAmount, remainingAmount, startDate, endDate, notes`.
- **Cashflow** — `id, type, category, amount, currency, date, recurring, account?, notes, receipt?`.
- **Goal** — `id, category, title, targetAmount, currency, deadline, fundingType, assetIds[], createdAt, achieved`.
- **Snapshot** — `{ date, netWorth, costBasis }` (daily history; 60-day synthetic seed on first run).
- **Profile** — `name, displayCurrency, locale, avatar, bio, phone, location, watchlist[], milestones[], savedInsights[]`.

> **Known constraint:** portfolio state is a single JSON blob per row; large portfolios will eventually need a normalized schema (see §11).

---

## 8. System architecture (summary)

- **Frontend:** React 18 + Vite 6 SPA, handcrafted CSS tokens, code-split views via `React.lazy`/`Suspense`, hash routing, `useReducer` store.
- **Backend:** Supabase Postgres + Auth + Realtime + Edge Functions (Deno/TS).
- **Edge Functions:** `ai-proxy` (JWT-validated Claude relay), `bnr-rates` (scheduled FX scraper), `send-invitation` (Resend email).
- **External data:** CoinGecko (crypto), ExchangeRate-API (FX), metals.live (gold), BNR (rates).
- **Hosting/CI:** GitHub Pages via GitHub Actions on push to `main`; PWA via vite-plugin-pwa + Workbox.

---

## 9. Integrations & dependencies

| Integration | Purpose | Secret/location | Failure behavior |
|---|---|---|---|
| Supabase Auth/DB/Realtime | Auth, storage, sync | `VITE_SUPABASE_URL/ANON_KEY` (build) | Fall back to localStorage |
| Anthropic (via `ai-proxy`) | AI advisor & insights | `ANTHROPIC_KEY` (function secret) | Advisor disabled / generic error |
| Resend (via `send-invitation`) | Invite emails | `RESEND_API_KEY`, `FROM_EMAIL`, `APP_URL` | Copy-link fallback |
| CoinGecko / ExchangeRate-API / metals.live | Live market data | none (public) | Reference values shown |
| BNR (`bnr-rates`) | Daily FX | scheduled function | Manual FX fallback |

---

## 10. Assumptions & constraints
- Users enter data manually or via statement files; no open-banking aggregation in Rwanda.
- Market reference figures (RSE/BNR/NISR) are sourced from publications, not live APIs — surfaced as Reference.
- Tax rules are encoded against current RRA/law citations and need periodic maintenance.
- Single-row-per-portfolio storage model; no per-field audit log beyond daily snapshots.
- No automated test suite today; the CI build gate is the safety net.

---

## 11. Risks & mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| No automated tests → regressions | High | Med | Add Vitest reducer smoke tests + `ai-proxy` contract test (highest-leverage next step). |
| Tax rules drift from law | High | Med | Annual review checklist; date-stamp rule sources; surface "as-of" in UI. |
| JSON-blob storage scaling | Med | Med | Plan normalized schema migration before large portfolios. |
| Market-data API outages / CORS | Low | High | Already degrade to Reference values; cached SW copies. |
| AI cost abuse | Med | Low | Per-user rate limit + model allowlist + token caps in `ai-proxy`. |
| Silent member overwrites | Med | Low | Add per-field audit log / change history. |
| Estimate mistaken for advice | High | Low | Persistent disclaimers + Live/Reference/Modeled tagging. |

---

## 12. Release status & roadmap

### Shipped (current — `main`)
All modules in §5 are implemented end-to-end and deployed. M1–M4 of the May 2026 UX review (52 issues) are closed; a dashboard "10/10" hardening pass (data parity, chart hover, BenchmarkBar, a11y glyphs, polish) is live.

### Near-term (proposed)
- **R1.** Vitest + reducer/`ai-proxy` smoke tests (NFR-MAINT, top risk).
- **R2.** Tax year configurability (remove hard-coded year/bands).
- **R3.** Per-field audit log / change history for shared portfolios.
- **R4.** Price alerts on Trends watchlist.
- **R5.** Complete fr/rw coverage for tax & trust prose (native review).

### Later (exploratory)
- **R6.** Normalized DB schema for large portfolios.
- **R7.** PDF/OFX statement parsing.
- **R8.** Push notifications for tax deadlines & maturities.
- **R9.** Streaming AI responses.

---

## 13. Open questions
1. Should Reference market figures carry a freshness SLA / staleness warning past N months?
2. Do we need a viewer-facing "data export for accountant" (CSV pack) beyond JSON backup?
3. Should milestone/tax notifications be email (Resend) or push (PWA) first?
4. What is the policy for AI advisor data retention in `state.chat` (cap/expiry)?

---

## 14. Appendix — requirement traceability
Requirement IDs (`FR-*`, `NFR-*`) are intended for linking to GitHub issues, future tests, and the May 2026 UX review (`ux-review-2026-05`). New findings should reference the relevant ID and be filed under a fresh review label rather than reopening closed cycles.
