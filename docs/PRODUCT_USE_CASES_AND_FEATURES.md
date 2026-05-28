# Imari — Product Use Cases & Features

**Product:** Imari by Maxventures
**Category:** Personal wealth & asset portfolio tracker (Rwanda-first)
**Live:** https://princenshuti.github.io/imari-portfolio/
**Document owner:** Nshuti Prince (Maxventures Ltd.)
**Last updated:** 2026-05-28
**Status:** Reflects production build on `main`

---

## 1. Product overview

Imari is a personal wealth platform that consolidates a Rwandan individual's (or household's) entire financial picture — bank accounts, mobile money, RSE & foreign equities, government bonds, real estate, vehicles, livestock, crypto, business equity and receivables — into a single, multi-currency dashboard with live exchange rates from the National Bank of Rwanda (BNR), Rwanda-specific tax estimates (RRA), and an AI advisor grounded in the user's actual holdings.

It is a client-side React single-page app backed by Supabase (Postgres + Auth + Edge Functions), installable as a Progressive Web App, and usable offline against cached data.

**One-line positioning:** *"Your whole net worth — Kigali plots, BK shares, MoMo, and dollars — in one honest dashboard built for Rwanda."*

### What makes it different
- **Rwanda-native by design** — RWF as base currency, BNR buy/sell FX, RRA tax logic, RSE/BNR/NISR market references, Kigali neighbourhood real-estate model, district/sector/cell/village geography, MTN/Airtel MoMo and 16 local banks, Kinyarwanda greetings, en/fr/rw locale switching.
- **Honest about data provenance** — every market figure is tagged **Live / Reference / Modeled** so users never mistake an estimate for a quote.
- **Tax-season ready** — Fixed Asset Tax, the new Vehicle Road Maintenance Levy (Law 013/2025), and Capital Gains Tax are computed from the user's own assets.
- **AI that knows your portfolio** — the advisor cites the user's real asset names and movers, with regulator-aware context (BNR/CMA/RRA/RSSB).

---

## 2. Target market & personas

### Primary market
Financially-active individuals and households in Rwanda and the Rwandan diaspora who hold a *mix* of local and foreign, liquid and illiquid assets — the people whose wealth is too scattered for a single bank app to capture.

### Personas

| Persona | Profile | Core need |
|---|---|---|
| **P1 — The Kigali professional** | Salaried, owns a plot + BK/MTN shares + MoMo + USD savings. | "What am I actually worth, in RWF, today?" |
| **P2 — The diaspora investor** | Lives abroad, holds Rwandan land + foreign ETFs/crypto. | Multi-currency net worth + remote oversight of Rwandan assets. |
| **P3 — The SME owner / landlord** | Business equity, rental property, vehicles, livestock, SACCO loans. | Income vs. obligations, maintenance & tax exposure. |
| **P4 — The household CFO** | Manages family wealth across spouse/relatives. | Shared portfolio with role-based access. |
| **P5 — The tax-conscious owner** | Multiple properties & vehicles. | RRA Fixed Asset Tax, Vehicle Levy & CGT estimates before deadlines. |

### Access roles (shared portfolios)
- **Owner** — full control, member management, danger-zone actions.
- **Editor** — can add/edit/delete records.
- **Viewer** — read-only.

---

## 3. Value proposition / jobs-to-be-done

1. **"Show me my true net worth"** — gross assets − liabilities, in my chosen currency, reconciled across every page.
2. **"Stop me doing RWF↔USD math by hand"** — automatic conversion at BNR buy/sell rates.
3. **"Tell me where I'm concentrated or at risk"** — concentration, maturity, depreciation and maintenance alerts.
4. **"Help me not get surprised by RRA"** — annual tax obligations and deadlines computed from my assets.
5. **"Give me a second brain for money decisions"** — an AI advisor that already knows my holdings.
6. **"Track my goals and cash flow"** — savings rate, recurring income/expenses, goal funding plans.
7. **"Let my family/accountant see it too"** — secure, role-based sharing with audit-safe sync.

---

## 4. Use cases

### UC-1 — Onboard and see net worth in minutes
A new user signs up, is greeted by name, and is offered **9 Rwanda templates** (BK savings, MTN MoMo, USD cash, Kigali plot, house, vehicle, livestock, BNR T-bond, RSE share) or a sample portfolio. Each template opens a pre-filled editor for review before saving. Within minutes the dashboard shows their net worth, allocation and an AI insight.

### UC-2 — Track a mixed multi-currency portfolio
P2 adds a Kabuga plot (RWF), VTI ETF (USD) and Bitcoin (USD). Imari values each at today's price/appreciation rule, converts to the display currency at BNR rates, and shows one consolidated net worth — with the sidebar and dashboard always agreeing.

### UC-3 — Monitor cash flow and savings rate
P1 logs salary + rental income and recurring expenses (rent, school fees, SACCO, utilities), or **imports a bank/MoMo statement**. Imari pro-rates recurring entries, computes a 6-month savings rate, and shows income-vs-expense bars and an expense-category donut.

### UC-4 — Prepare for RRA tax season
P5 opens the Tax Report before 31 March. Imari lists Fixed Asset Tax per property (with the residential RWF 3M exemption and agricultural ≤2 ha exemption), the Vehicle Road Maintenance Levy per vehicle (Law 013/2025), and estimated Capital Gains Tax if everything were sold — plus a "what data is missing?" audit and the next deadline.

### UC-5 — Ask the AI advisor a grounded question
P3 asks "Am I too concentrated?" The advisor answers citing their actual biggest holding and group weights, suggests a Rwanda-grounded next step, and the user bookmarks the insight.

### UC-6 — Plan and fund a goal
P1 creates a "House down-payment (30%)" goal, funds it from *liquid assets only*, and Imari shows progress with 25/50/75% milestone ticks and "save RWF X/month to hit this on time."

### UC-7 — Share with household / accountant
P4 invites a spouse as **Editor** and an accountant as **Viewer** by email; invitations expire in 14 days and are auto-accepted on first sign-in. Edits sync in real time across sessions.

### UC-8 — Work offline / install as an app
A user installs Imari as a PWA. On a flight with no signal, cached data and rates still render; changes sync when back online.

---

## 5. Feature catalog

### 5.1 Authentication & onboarding
- Email/password sign-up & sign-in; password reset via recovery magic link.
- First-login name prompt; empty portfolio auto-created.
- Invite-link acceptance (`?invite=…`) post-login.
- **Onboarding wizard** — 9 Rwanda asset templates (review-before-save), "Load sample portfolio," and "Skip."

### 5.2 Dashboard (Overview)
- **KPI strip** — Net worth (collapses to a unique 4th tile when debt-free, promoting Liquid balance), Gross/Liquid, Unrealised P/L with ▲/▼, Savings rate.
- **Net-worth hero** — 24-month area chart with hover crosshair + value tooltip.
- **Asset-allocation donut** with group legend + percentages (accessible labels).
- **Financial ratios** — liquidity, income-generating, debt-to-asset, debt-to-income with threshold markers.
- **Cash flow (6M)** mini income-vs-expense bars.
- **AI insight card** — auto-generated 3-bullet read on the portfolio, 24h refresh, regenerate.
- **Financial monitoring** — monthly income by source, passive-income ratio, asset-utilization rate, liquidity position, return by asset class.
- **Net-worth timeline** — net worth vs cost basis, 1M/3M/6M/1Y/ALL ranges, dedup axis labels.
- **Category performance** bars (▲/▼ per class).
- **Top movers** — appreciating / depreciating cards (clickable to Assets).
- **Alerts** — concentration, high-risk (overdue receivables, bonds nearing maturity, large losses), maintenance assets; collapses to a single "healthy" banner when clear; promoted high in the layout.
- **vs. Benchmarks** — portfolio vs USD/RWF, CPI, RSE ASI, BNR T-bond with "You vs Benchmark" bars + spread pill.
- **Markets watchlist** preview → Trends.
- **Arrange mode** — drag-to-reorder + hide sections, persisted per browser.
- Milestone celebrations when net worth crosses thresholds.

### 5.3 Assets
- **14 asset classes across 11 groups** — Land, House/apartment, Vehicle, Livestock, RSE stock, Foreign stock/ETF, T-bill/T-bond, Bank savings, Mobile money/cash, Crypto, Gold/commodity, Business equity, Receivable/loan-given, Other.
- **Class-aware valuation** — appreciation/depreciation/accrual rules per class with a one-click "use suggested value," overridable by manual current value.
- **Rich asset editor** — conditional fields (UPI title-deed number, property category, size m², vehicle model/chassis, vehicle category with road-levy shown inline, ticker/shares/units/last price, yield, maturity, bank, wallet, grams, stake %, debtor, due date); location accordion (Country → Province → District → sector/cell/village for Rwanda); income-generation toggle (amount/frequency); up to 3 photos; up to 5 documents (≤2MB).
- **Search, 9-way sort, type & location filters**, clear-filters.
- **Summary stats** (count, cost basis, value, gain/loss) and per-group cards.
- **Inline edit** of today's value; **bulk multi-select** with sticky action bar + destructive-confirm delete.
- **Excel import/export** — downloadable template, parse, merge by natural key, preview + skipped-row errors.
- Full **keyboard navigation** of the asset table; maturity/overdue alerts.

### 5.4 Accounts (Cash & MoMo lens)
- Liquid-balance summary split into Bank vs Mobile money.
- Add/edit account — institution from 16 Rwandan banks or MTN/Airtel (with custom escape hatch), masked account number, balance + currency, bank interest rate.
- Cards show yield, linked-cashflow count, last-activity hint, ≈ display-currency conversion.
- "Open in Assets" — explains accounts and the Cash & savings asset group are the same records.

### 5.5 Liabilities
- Summary: total liabilities, total assets, **true net worth**.
- 7 liability types (mortgage, vehicle, personal, SACCO, business, credit/overdraft, other).
- Per-loan: rate, days-left/matured countdown, remaining-of-original, **payoff progress bar**, and an **amortization expander** (PMT, total interest, effective APR, months-to-payoff, extra-payment modeling).
- Auto-deducted from net worth.

### 5.6 Cash Flow
- KPI strip — monthly income, expenses, net, savings rate.
- 6M/12M income-vs-expense bar chart (Y-axis ticks, gridlines, hover tooltips, persisted window) with a **thin-data caveat** under 3 months.
- Expense-by-category donut for the viewed month; month navigator.
- Entry editor — income/expense, category grid, amount/currency, date, frequency (once/monthly/quarterly/annually), optional linked account (only "Once" entries move balances), notes, **receipt image** (compressed + lightbox).
- **Bank/MoMo statement import wizard** (Upload → Map columns → AI categorising → Review) — CSV/TSV/Excel, Rwanda-merchant keyword categorizer, fee splitting, confidence flagging, and a single batched AI pass for low-confidence rows.

### 5.7 Goals
- 9 Rwanda-tuned templates (emergency fund, school fees, house down-payment, land, vehicle, Hajj, wedding/dowry, retirement, business).
- Goal editor — category, target, deadline, **funding source** (net worth / liquid only / specific assets), notes.
- Cards — status pill (On track / Slipping / Overdue / Done), milestone ticks at 25/50/75%, "save X/month," remaining-to-target.
- Overview: active goals, net worth, "closest to done."

### 5.8 Trends (Markets you watch)
- Live: FX (ExchangeRate-API), Gold (metals.live), Crypto (CoinGecko); Reference: BNR repo, NISR CPI, RSE ASI, 10-yr Treasury; Modeled: Kigali RE index.
- **Live / Reference / Modeled** badges + a data-sources transparency note.
- Grouped indicator cards (Rwanda macro, Stocks, Crypto, Yields, Real estate) with sparklines, per-row last-updated timestamps, source attribution, "How is this computed?" disclosure for modeled values, and a **personal watchlist** star.
- **Kigali real estate by neighbourhood** — indicative price/m² for 7 neighbourhoods.

### 5.9 Tax Report (RRA)
- Print/Save-PDF, next-deadline card, and a **missing-data audit** (deep-links to fix).
- **Fixed Asset Tax** — per-property table with category rates, residential RWF 3M exemption, agricultural ≤2 ha exemption, and a late-payment penalty estimator (10/20/30/40% bands, 1.5%/month interest, RWF 100k surcharge cap).
- **Vehicle Road Maintenance Levy** — flat per-category schedule (Law 013/2025), exemptions, fuel-levy note.
- **Capital Gains Tax** — 5% on realised gains (bonds exempt), 15% withholding on investment income, per-asset table.
- Disclaimer with RRA contact and law citations.

### 5.10 AI Advisor
- Multi-turn chat grounded in a `<PORTFOLIO_DATA>` snapshot with prompt-injection hardening.
- Portfolio-tailored question templates referencing the user's real movers/asset types.
- Asset-name highlighting in replies; **bookmark/save insights** to a drawer.
- Persistent "not professional advice" disclaimer; typing indicator; floating advisor button available app-wide (clears the mobile tab bar).
- Server-proxied (key never in browser), model allowlist, per-user rate limit.

### 5.11 Settings
- Appearance — theme (auto/light/dark) + **locale (en/fr/rw)**.
- Profile — avatar, name, display currency, bio, phone, location.
- **Members** — invite Editor/Viewer, pending invites (copy-link/resend/revoke), role change/remove (owner-gated).
- AI key — shared env key state or personal key (browser-only).
- **Exchange rates** — daily BNR sync (buy/sell + as-of) with manual fallback overrides.
- Backup & restore — JSON export/import.
- Net-worth milestones — shorthand entry (10M/250M/1B), undo, reset.
- **Danger zone** — reset-to-sample and delete-all, typed-`DELETE` confirm.

### 5.12 Platform-level
- PWA install + offline (stale-while-revalidate: FX 1h, market data 15m).
- Real-time multi-session sync; hash-based deep links survive reload.
- Role-based access control enforced by Postgres RLS.
- Responsive (desktop sidebar + collapsible rail; mobile tab bar + "More").
- Accessibility — skip-to-content, focus rings, ▲/▼ + color for gain/loss, accessible chart/control names, reduced-motion support.

---

## 6. Rwanda-specific differentiators (summary)
- **Currency & FX:** RWF base; BNR buy/sell rates; RWF/USD/EUR/KES.
- **Tax:** RRA Fixed Asset Tax, Vehicle Road Maintenance Levy (Law 013/2025), CGT 5%, 15% withholding, PAYE context.
- **Markets:** RSE All-Share, BNR repo & 10-yr yield, NISR CPI, Kigali RE composite.
- **Geography:** Province → District → Sector → Cell → Village; UPI parcel IDs.
- **Money rails:** 16 banks + MTN/Airtel MoMo; Rwanda-merchant statement categorizer.
- **Language:** English / French / Kinyarwanda.

---

## 7. Non-goals (out of scope)
- Not a brokerage, bank, or payment app — Imari never moves money or executes trades.
- Not live market quotes for RSE/BNR/NISR (clearly tagged Reference/Modeled).
- No automated bank-account linking/aggregation (manual entry + statement import only).
- Not tax-filing software — estimates only, with disclaimers; verify with RRA.
- No PDF/OFX/MT940 statement parsing (CSV/TSV/Excel only).

---

## 8. Glossary
- **BNR** — National Bank of Rwanda. **RRA** — Rwanda Revenue Authority. **RSE** — Rwanda Stock Exchange. **NISR** — National Institute of Statistics of Rwanda. **CMA** — Capital Market Authority. **RSSB** — Rwanda Social Security Board.
- **UPI** — Unique Parcel Identifier (land title). **FAT** — Fixed Asset Tax. **CGT** — Capital Gains Tax. **MoMo** — Mobile Money. **SACCO** — Savings & Credit Cooperative.
