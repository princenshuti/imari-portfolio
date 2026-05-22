# Multi-Country Financial Platform

_Started 2026-05-22 00:26 UTC_

---

## User

Design a budget management and wealth management plus financial advisory per Country.

## Assistant

_[tool: list_files]_

_[tool: questions_v2]_

## User

Questions answered:
- platform: Both mobile + desktop
- primary_user: All of the above (multi-tier product)
- scope: Home / overview dashboard, Budget tracker (categories, spending), Investments & holdings, Net worth / portfolio overview, Country selector + localized rules, Advisor chat / book a meeting, Insights / AI recommendations, Goals (retirement, home, etc.), Tax & regulatory view per country, Onboarding flow, Transactions feed
- countries: RWANDA
- country_switching: Visible throughout — currency, tax, advisor, regulator surfaced everywhere
- fidelity_vibe: Decide for me
- advisor_model: Robo-advisor / AI only
- variations: Decide for me
- novelty: Conventional — follow established fintech patterns
- tweaks_focus: Switch country (currency, language, regulator), Color/theme (light/dark, accent), Data state (empty / typical / wealthy)

## Assistant

_[tool: update_todos]_

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: write_file]_

Now let me build. I'll create the design system tokens and data first, then screens. Starting with the brand decision:

**Brand**: "Imari" (Kinyarwanda/Swahili: wealth, value) — modern fintech with Rwandan grounding. Deep emerald green + warm cream + editorial serif headlines.

_[tool: write_file]_

_[tool: write_file]_

Now shared UI components used across all screens:

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the desktop screens:Now let's wire it all together with the main canvas + Tweaks:

_[tool: write_file]_

Now the main HTML file:

_[tool: write_file]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

Clean. Let me hand off to the user and verify in parallel.

_[tool: done]_

_[tool: str_replace_edit]_

Each Babel script runs in shared global lexical scope, so top-level `const { COUNTRIES } = window` collides between files. Wrapping each file's body in an IIFE.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

I built **Imari** — a Rwanda-grounded budget, wealth & advisory app on a Design Canvas with all 11 screens you asked for, presented as side-by-side artboards.

**What's there**
- **Brand & system card** — palette (emerald + gold, "Land of a Thousand Hills"), Instrument Serif + Geist + Geist Mono type, country rails (BNR · CMA · RRA · RSSB · RSE · MTN MoMo)
- **3 desktop screens** (1440×900) — Overview, Wealth/portfolio with holdings table, Advisor + Tax & Rules
- **9 mobile screens** (iPhone frame) — Onboarding, Home, Budget, Wealth, Transactions, AI Advisor chat, Insights/health score, Goals, Tax & Regulators

**Per-country surfacing** is wired throughout — every screen shows the country chip in the header, currency switches RWF↔KES↔UGX↔USD, regulator names + tax bands + bond yields update, AI advisor cites the right authorities.

**Tweaks panel** (toolbar toggle)
- Country: 🇷🇼 Rwanda · 🇰🇪 Kenya · 🇺🇬 Uganda · 🇺🇸 USA
- Data state: empty / typical / wealthy (HNW persona)
- Theme: light / dark

**Caveats / next steps**
- Robo-advisor only per your spec — no human advisor booking flow. Easy to add later.
- Onboarding is one scrollable preview of the 3 steps, not a clickable flow — say the word if you'd like a tappable version.
- Mobile screens that don't fit in the 5-tab bar (Goals, Transactions, Insights, Tax) currently route via the "More" tab — happy to design that drawer if useful.

## User

do you think this is an asset monitoring, portfolio management, Financial Monitoring and advisor dashboard based on the managed portfolio. Dashboard, with Trend report from the user’s selected domain of interest. Also having an AI chatbot that answers based on the users portfolio data. How about I start building it as my personal portal. Where I can enter my fixed or movable asset with the amount I purchased together with purchase and also have projected resell value as of today. And get shown as part of my wealth or net worth

## Assistant

_[tool: questions_v2]_

Yes — exactly. The current file is a *showcase* (fictional users, dummy data, 4 countries side-by-side). A **personal portal** for you is a different beast: persistent storage, real CRUD on your own assets, your own net-worth math, and an AI that reasons over *your* portfolio.

Totally doable. Before I build, a few quick questions so I get it right on the first pass:

## User

Questions answered:
- scope: New file + link from the showcase
- asset_types: Real estate (house, land, plot), Vehicles (car, motorbike), Livestock (cattle, goats), Government bonds / T-bills, RSE stocks (BOK, MTN-R, Bralirwa…), Mobile money / cash balance, Bank savings accounts, Foreign stocks / ETFs, Business equity (your own company), Gold / commodities, Crypto, Receivables / loans given out, Other / freeform
- valuation: Hybrid — manual today’s value, but the app suggests one based on a rule
- currency_mode: Multi-currency from the start (RWF + USD + EUR + KES)
- ai_scope: “What’s my net worth right now?” analytical answers, “Which asset gained the most this year?” — trend / performance Q&A, Risk & diversification feedback (concentration, sectors), Tax notes per RRA (rough estimates, not advice), Goal coaching (“how do I reach 50M by 2028?”), Asset suggestions (“should I buy more BOK?” — speculative)
- domains: Rwanda macro (BNR repo rate, inflation, USD/RWF), Kigali real-estate prices (per neighbourhood), Global stocks (S&P 500 etc.), RSE stock index, Crypto (BTC, ETH), Gold / commodities, Treasury yields
- privacy: LocalStorage + manual JSON export/import for backup
- name_owner: Should greet you based on your username.
- starter_assets: Plot in Kabuga — bought 2022 for 150M, BK shared 200 @ 280, and 5 more eXmples.

## Assistant

_[tool: update_todos]_

Got it. Building your personal portal now — separate file, linked from the showcase, with persistent LocalStorage + JSON backup.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the app shell and the HTML file:

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: write_file]_

Now add a link from the showcase to the portal:

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

Clean. Let me ship.

_[tool: update_todos]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Done — your personal portal is live at **`Imari Portfolio.html`**.

**What's working**

1. **First-run greets you in Kinyarwanda** ("Muraho.") and asks for your name. After that, it greets time-of-day ("Mwaramutse Prince" / "Mwiriwe Prince").

2. **Dashboard** — net worth, 24-month synthesised trend from your purchase dates, composition donut, cost basis, unrealised P/L, top movers, and a 4-card watchlist preview.

3. **Assets** — search, filter by class, add/edit/delete. Editor supports **all 13 classes** (real estate, vehicles, livestock, RSE stocks, bonds, savings, MoMo, foreign stocks, business equity, gold, crypto, receivables, other) with class-specific fields. The hybrid valuation rule lives in a green callout: it suggests today's value (e.g. land +5%/yr, vehicles -15%/yr, bonds yield-based, RSE stocks = shares × your last price) — one click to accept, or you override.

4. **Multi-currency** — every asset is tagged with its native currency (RWF/USD/EUR/KES), and the topbar selector + sidebar net worth converts everything to your chosen display currency. FX rates are editable in Settings.

5. **Seeded with your starter assets** — Plot in Kabuga (150M RWF, 2022), 200 BK shares @ 280, MTN Rwanda shares, Toyota Rav4, 5 cattle, 5-yr T-Bond, MoMo balance, BK savings, BTC, VTI ETF.

6. **Trends** — 10 domain cards across Rwanda macro / stocks / commodities / crypto / yields / real estate, plus a Kigali neighbourhoods table. **All marked "illustrative"** with a clear disclaimer at the top — the browser can't fetch live data reliably.

7. **AI Advisor** — uses `window.claude.complete`. Every question ships with a JSON snapshot of your portfolio (totals, every asset with class/cost/current value/gain) plus Rwanda regulator/tax context. 5 starter prompts cover net worth, top performers, concentration risk, RRA tax estimates, and goal coaching.

8. **Settings** — name, display currency, FX rates editor, JSON export/import with confirm dialog, reset-to-seed, delete-all.

9. **Showcase link** — floating "Open my personal portal →" button on the top-left of the showcase. From the portal dashboard, a "← Showcase" pill takes you back.

**Caveats**
- Trend values are synthesised — they'll never auto-update. The honest fix is to manually update an asset's "last price" field; the AI advisor will tell you the same when asked.
- LocalStorage is per-browser. Use **Settings → Export** before switching devices.
- AI advice is informational, not a fiduciary recommendation — disclaimer is in every chat.

## User

Apply drawing

## Assistant

_[tool: str_replace_edit]_

Good catch — let me add an AI Advisor insight card right below "Markets you watch" that auto-generates a summary of *your* current portfolio.Now add the insight card component in views, and integrate it into the Dashboard:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

Added the **"What I'm seeing in your portfolio"** card right where you drew the box.

How it works:
- Auto-generates on first dashboard load using `window.claude.complete`, passing a compact snapshot of your portfolio (totals, composition %, every asset with cost/current value/gain).
- The AI returns 3 numbered bullets, each specific to *your* data — concentration risk, top performer/laggard, one actionable next step (grounded in RRA/BNR/CMA rules).
- Cached in LocalStorage with a "portfolio key" — if you add/edit/delete an asset, the card detects the change and regenerates after a short debounce.
- **↻ Refresh** button to regenerate on demand, **Open chat →** jumps to the full Advisor view to dig deeper.
- Shows a shimmering skeleton while waiting; graceful error UI with retry if the AI call fails.

The card uses the same brand gradient + serif headline as the rest of the design system.

## User

Apply drawing

## Assistant

_[tool: str_replace_edit]_

Adding a persistent template sidebar to the AI Advisor view, with categorized prompts that reference *your* actual assets:

_[tool: done]_

Added a persistent **"Ask Imari"** template sidebar to the AI Advisor view — right where you drew the box.

**6 categories, ~30 dynamic templates** that reference *your actual assets*:

- **Overview** — net worth, financial health summary, biggest holding deep-dive
- **Performance** — top mover, worst mover, return rankings, class-vs-class comparisons *(names your real top/worst performer)*
- **Risk & diversification** — concentration risk, stress scenarios *("If Plot in Kabuga lost half its value tomorrow...")*
- **Tax (RRA)** — capital gains sims on your specific stocks/bonds, RSSB deductions
- **Goals & planning** — net worth targets, savings simulators, retirement planning
- **Asset ideas** — buy/sell/rotate prompts referencing your specific tickers, crypto, vehicle, cattle

Templates are built fresh from your portfolio on each render, so they update as you add/edit assets. Click any → it sends instantly. Disabled state while a request is in flight.

