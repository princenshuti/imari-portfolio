# Imari — CLAUDE.md

Imari is a personal wealth tracker for Rwanda (assets, liabilities, net worth, goals, projections) built by Maxventures Ltd. Product thesis: **loss aversion** — every feature should surface the "Cost of Absence" (what inaction costs the user). Production: https://imali.princenshuti.com (cPanel-hosted static build, deployed via cPanel Git Version Control reading `.cpanel.yml`). Staging preview: https://princenshuti.github.io/imari-portfolio/ (built locally and pushed to verify before promoting to prod).

## What drives feature order

- `docs/IMARI_FEATURE_BUILD_GUIDE.md` — the roadmap. Part A = major features in build order with sprint gates; Part B = triaged backlog (P0 bugs first). When asked to "build the next feature", consult this guide and its Definition of Done sections (§13, §B21).
- `SYSTEM_DOCUMENTATION.md` — architecture and shipped features. Update it when shipping a feature.
- `docs/PRD.md`, `docs/VALUATION_BASIS.md` — product and valuation reference.
- `README.md` and `chats/` are a design-handoff bundle from Claude Design, not project docs.

## Stack

- React 18 + Vite, plain JavaScript (no TypeScript), plain CSS in `src/styles.css` (no Tailwind/UI framework).
- State: `src/store.js` + `src/reducer.js` (custom store, no Redux). Navigation: `src/nav.js` (no router lib).
- Backend: Supabase (auth, Postgres, edge functions in `supabase/functions/`: `ai-proxy`, `bnr-rates`, `send-invitation`). Schema/migrations: `supabase-*.sql` at repo root. The `whatsapp-inbound` / `whatsapp-nudge` functions and the MoMo SMS parser (`src/parsers/momo/`) were removed in 2026-06 — those features are deferred to the mobile app (`docs/IMARI_FEATURE_BUILD_GUIDE.md` §3 and §4). The `whatsapp_links` table in `supabase-migration-004.sql` is preserved for the mobile rebuild.
- AI: Anthropic SDK. In production calls go through the `ai-proxy` edge function — **never put the Anthropic key in client code or VITE_ vars shipped to prod**.
- i18n: `src/contexts/I18nContext.jsx` + `src/locales/{en,fr,rw}.js`. Every user-facing string must exist in all three locales; run `npm run i18n:audit` to check.
- PWA via `vite-plugin-pwa`.

## Layout

- `src/views/` — one file per screen (Dashboard, Assets, Liabilities, Goals, Projections, Advisor, …)
- `src/components/` — shared UI (Modal, Toast, AssetEditor, CostOfAbsence, charts.jsx, …)
- `src/engine/` — pure calculation logic with colocated `*.test.js`
- `src/services/` — market data, snapshots

## Commands

- `npm run dev` — dev server
- `npm test` — vitest (run before declaring any change done)
- `npm run i18n:audit` — locale completeness check
- `npm run build` — production build to `dist/`
- `npm run deploy` — build + FTP upload of `dist/` to cPanel (reads `.env.deploy`, gitignored). **Deploys straight to production — only run when the user explicitly asks to deploy.**

## Env

- `.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_ANTHROPIC_KEY` for local dev only).
- `.env.deploy` — FTP credentials (see `scripts/deploy.env.example`). Never commit either.

## Conventions

- Tests live next to the code (`reducer.test.js`, `engine/*.test.js`). New calculation logic goes in `src/engine/` with tests.
- Commit style follows existing history: `feat(scope): …`, `fix(scope): …`, `style(scope): …`.
- Dark mode is supported — verify UI changes in both themes (B1 in the build guide was a dark-mode bug).
- Currency is RWF; formatting helpers already exist (`src/format.test.js` covers them) — reuse, don't reimplement.
- Dates on cash-flow entries are date-only strings — parse with `parseLocalDate` from `src/engine/recurrence.js`, never `new Date(str)` (UTC-midnight parsing shifted entries a day for west-of-UTC users). Recurrence/month math also lives there — don't re-derive cadence division.
- New advisory logic = a rule in `src/engine/insights/` (pure `(state, {now, refs})`, quantified Cost-of-Absence, real `sourceRefs`, silent when data is thin) registered in `index.js`. Map its id in `src/glossary.js` if it uses jargon.
- New views register in `nav.js` (routing derives from `NAV_ITEMS` — nothing else to update for routing) and, if optional, get a module entry in `src/features.js`.
- Cloud saves are compare-and-swap on `updated_at` (`savePortfolio` in `cloud.js`) — never add an unconditional portfolio write.
- In `App.jsx`, all hooks go ABOVE the conditional auth/loading returns — a hook added below them crashes the app at runtime with every test green.
