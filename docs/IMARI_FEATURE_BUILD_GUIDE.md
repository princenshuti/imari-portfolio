# Imari — Developer Build Guide: New Features

**Owner:** Nshuti Prince (Maxventures Ltd.)
**For:** Imari engineering
**Version:** 1.0 · 2026-05-28
**Architecture baseline:** React 18 + Vite 6 SPA · `useReducer` store · hash routing · Supabase (Postgres + Auth + Realtime + Edge Functions/Deno) · PWA/Workbox · GitHub Pages CI

---

## 0. How to use this guide

Each feature is a self-contained work order. Build in the sprint order in §12. Do not skip the cross-cutting layers (§1 Cost-of-Absence, §2 Insight Engine, §11 Data Freshness) — they are dependencies for the rest.

Every feature block has the same shape:
- **Objective** — one line.
- **User value & Cost-of-Absence hook** — the value, and the loss the user must feel without it.
- **Data model** — Postgres / state-JSON changes.
- **Build steps** — ordered, file-aware.
- **Acceptance criteria** — done = all checked.
- **Complexity** — Low / Medium / High.
- **Risks & guards.**

**Global conventions (apply everywhere):**
- New nav entries go through `nav.js` only (single source of truth, per NFR-MAINT-1).
- New views are code-split via `React.lazy` + `Suspense`. Keep per-view gzipped chunk < 60 KB (NFR-PERF-2).
- All model/AI calls route through the `ai-proxy` Edge Function. The Anthropic key never reaches the browser (FR-AI-2, NFR-SEC-1). No exceptions.
- All new tables enforce Postgres RLS keyed on `portfolio_members` (NFR-SEC-2, FR-PLAT-5).
- Reducer changes ship with a Vitest smoke test (this is R1 / top risk — no untested reducer math in a money app).
- Gain/loss conveyed by color **and** ▲/▼ glyph (NFR-A11Y-2). Icon-only controls get accessible names.
- Every imported or derived number carries a freshness timestamp (see §11). A stale number shown as fresh is a trust failure.

---

## 1. The Cost-of-Absence design system (cross-cutting — build first)

**Why this exists.** Net worth is checked episodically, not daily. The product loses two-thirds of users in a month (35% 4-week retention target). The fix is not more features — it is making the user *feel the loss* of not opening Imari. This is loss aversion, applied honestly: never fabricate fear, only surface real, already-present cost.

**The rule:** every insight, alert, and nudge must answer **"what does this cost me if I ignore it?"** in concrete RWF, days, or risk — grounded in the user's own data.

**Build a single reusable component: `<CostOfAbsence>`**

Inputs: `{ severity, headlineValue, costStatement, action }`.

| Severity | Trigger archetype | Example copy (data-driven) |
|---|---|---|
| `critical` | A deadline or loss already accruing | "RRA Vehicle Levy due in 6 days. Late penalty starts at RWF 12,000." |
| `warning` | Money bleeding silently | "RWF 4.2M idle in MoMo. At T-bill ~10%, that's ~RWF 35,000/month you're not earning." |
| `info` | Drift the user can't see | "Net worth flat in RWF — but down 2% in USD this quarter." |

**Implementation steps**
1. Create `src/components/CostOfAbsence.jsx`. Severity → color token + glyph. Always render `costStatement` in bold and a single primary `action` button (deep-links via hash route to the fix).
2. Add a `costOfAbsence` field to the insight schema (§2) so any insight can promote itself to a loss-framed card.
3. Add an app-open hook: on dashboard mount, compute the **single highest-severity unresolved cost** and pin it to the top of the dashboard (above the KPI strip). One item only — not a wall of fear.
4. Add a re-engagement payload: the same top-cost item feeds the WhatsApp nudge (§4) and (later) PWA push. Same source of truth, three surfaces.

**Acceptance criteria**
- [ ] `<CostOfAbsence>` renders for all three severities with correct color + glyph + accessible name.
- [ ] Dashboard pins exactly one highest-severity item on open; collapses to the existing "healthy" banner when none.
- [ ] Every cost statement traces to a real value in user data (no hard-coded fear). Unit test asserts no card renders without a numeric source.
- [ ] Reduced-motion respected; card transitions ≤ 300 ms.

**Complexity:** Low. **Risk:** Overuse → fatigue. Guard: max one pinned cost on open; rate-limit nudges (§4).

---

## 2. The Insight Engine (cross-cutting — foundational)

**Objective.** Turn raw data into "surprise / foresight / comparison" insights that pass the *so-what / now-what* test. This powers the existing AI insight card, the Cost-of-Absence layer, and nudges.

**User value & Cost-of-Absence hook.** Without it, Imari is a ledger. With it, the user learns things they didn't know (idle cash, real-vs-nominal drift, concentration) and is told the cost of ignoring them.

**Data model (state JSON `profile.insights[]`):**
```
Insight = {
  id, type: 'surprise'|'foresight'|'comparison',
  category: 'networth'|'liquidity'|'tax'|'goal'|'allocation',
  headline,                // short, human
  body,                    // 1-2 sentences, cites a real asset/number
  costOfAbsence?: { severity, costStatement, action },
  sourceRefs: [assetId|liabilityId|cashflowId...],  // traceability
  computedAt,              // freshness
  dataAsOf,                // oldest input timestamp (see §11)
  dismissed: bool
}
```

**Build steps**
1. Create `src/engine/insights/` with one pure function per insight rule. Pure = `(portfolioState) => Insight | null`. No side effects. This is what the Vitest suite tests.
2. Ship these rules in v1 (each is a separate testable function):
   - `runwayMonths` — liquid ÷ avg monthly expense. Cost hook if < 3 months.
   - `idleCashYieldGap` — cash earning < 2% vs current BNR T-bill reference. Cost hook = forgone yield/month.
   - `realVsNominalNetWorth` — net-worth Δ in RWF vs display currency using FX history.
   - `concentrationRisk` — any single asset or group > 25% (reuse existing alert threshold).
   - `taxDeadlineExposure` — next RRA obligation from the Tax module + days-to-deadline + penalty if missed.
   - `goalPaceGap` — required vs actual monthly contribution; projects slippage in months.
   - `incomeGeneratingShare` — % of assets that generate income vs idle.
   - `topMoverAttribution` — which holding drove most of the period's gain/loss.
3. Create `src/engine/insights/index.js` — runs all rules, sorts by severity, returns top N. Pure and memoized.
4. Wire the AI insight card (FR-DASH-7) to *narrate* the top engine insights via `ai-proxy` rather than free-associating. The engine decides *what*; the AI phrases it. This makes insights deterministic and testable, and cuts AI cost.
5. Add 24h TTL + manual regenerate (already specced); persist to `profile.insights`.

**Acceptance criteria**
- [ ] Each rule is a pure function with a Vitest test covering: positive case, null case, and a boundary (e.g., exactly 25% concentration, exactly 3-month runway).
- [ ] Every insight carries `sourceRefs` and `dataAsOf`. An insight with no source ref fails CI.
- [ ] AI card narrates engine output; if `ai-proxy` is down, the raw engine headline still renders (graceful degrade, NFR-REL-1).
- [ ] No insight references an asset that no longer exists (stale-ref guard).

**Complexity:** Medium. **Risk:** Wrong math = wrong advice. Guard: pure functions + mandatory tests; show `dataAsOf` on every card.

---

## 3. Feature — MoMo SMS Parser ("Auto-MoMo")

> **🚫 DEFERRED to the Imari mobile app (2026-06).** A PWA cannot read SMS — the entire feature relies on a native Android capture layer with `READ_SMS` permission. Removed from the web sprint to avoid promising what the browser can't deliver. The parser code (`src/parsers/momo/`) was deleted; this spec is preserved verbatim as the source-of-truth for the mobile rebuild. The bank-statement importer (`src/services/bankImport.js`) already covers MoMo via MTN/Airtel statement upload on the web — point users there in the interim.

**Objective.** Auto-ingest MTN MoMo & Airtel Money transactions from confirmation SMS into the cash-flow + accounts ledger, with consent.

**User value & Cost-of-Absence hook.** Kills manual entry — the #1 retention killer. Hook: *"You stopped logging 11 days ago. RWF 240,000 of MoMo activity is missing — your net worth on screen is wrong."* Once a user sees the app self-update, going back to manual feels like loss.

**Why it's defensible.** Depends on Rwanda-specific SMS grammars (Kinyarwanda/French/English strings, MoMoPay merchant codes, Mobicash variants). No global app builds this. This is moat, not parity.

**Data model**
- New table `momo_ingest_log` (RLS): `id, portfolio_id, raw_hash, parsed_status, counterparty, amount, currency, balance_after, txn_at, matched_cashflow_id, created_at`. `raw_hash` dedupes; never store raw SMS body server-side longer than needed (DPP Law 058/2021 minimization).
- Cashflow entries get `source: 'momo-auto'` and `confidence` (reuse the statement-import confidence flagging, FR-CF-5).

**Build steps**
1. **Capture layer (Android first).** PWA cannot read SMS. Ship a thin Android companion (Capacitor or a lightweight native helper) that, on explicit opt-in, reads only MoMo/Airtel sender IDs (`M-Money`, `MTN`, `AirtelMoney`) and POSTs parsed fields to a guarded Supabase endpoint. iOS fallback: forward-to-email address that a parser inbox reads (document the limitation clearly).
2. **Parser.** Build `parsers/momo/` with one grammar module per sender format. Regex-first for speed; route only *unmatched* strings to a batched `ai-proxy` pass (cost control). Extract amount, counterparty, direction (in/out), balance, timestamp, fee.
3. **Reconciliation.** Match to existing cashflow by amount+date window to avoid double-entry. Unmatched → create `momo-auto` cashflow with confidence flag. Update linked account balance only for settled txns (respects FR-CF-4 semantics).
4. **Consent & control.** Settings toggle: enable/disable, per-sender, "pause sync." Show a consent screen citing what's read and stored (DPP informed-consent, Article 7). Provide one-tap "delete all MoMo-sourced data."
5. **Review queue.** Low-confidence rows surface in a review tray (reuse statement-import wizard UI). Require resolve or "accept as-is."

**Acceptance criteria**
- [ ] Parser ≥ 60% exact-match accuracy on a 500-SMS sample → ship to all; < 40% → fall back to Statement-OCR-first (§8). Log the metric.
- [ ] Zero double-entries on a test set containing both a manual entry and its matching SMS.
- [ ] Consent screen + per-sender toggle + delete-all all functional; disabling stops ingestion immediately.
- [ ] Raw SMS body not persisted server-side beyond parse; only structured fields + `raw_hash`.
- [ ] AI pass only fires on unmatched rows, batched (assert call count in test).

**Complexity:** Medium (parser) / Medium-High (Android capture). **Risk:** SMS format drift; store-distribution friction. Guard: grammar modules are versioned and unit-tested against fixtures; companion app is optional, manual entry always works.

---

## 4. Feature — WhatsApp Quick-Entry Bot + Proactive Nudges

> **🚫 DEFERRED to the Imari mobile app (2026-06).** WhatsApp Business API provisioning, phone-verification UX, and the always-on inbound webhook are mobile-lifecycle concerns — they belong with the native build, not the marketing web app. The two Edge Functions (`whatsapp-inbound`, `whatsapp-nudge`) were deleted from `supabase/functions/`; the `whatsapp_links` table (`supabase-migration-004.sql`) is **preserved** so the mobile rebuild can reuse it without a schema migration. This spec stays as the rebuild source-of-truth.

**Objective.** Let users add transactions and receive insights via WhatsApp — the dominant chat surface in Rwanda. Convert episodic use to daily.

**User value & Cost-of-Absence hook.** Lightweight input where smartphone keyboard friction is high; daily check-in without opening the app. Hook (the nudge itself is the loss signal): *"Today's spend: RWF 35,200 across 4 categories. Liquid covers 2.3 months. Reply 'why' for detail."* Silence from the bot = the user notices when their money stops being watched.

**Data model**
- `whatsapp_links` (RLS): `portfolio_id, phone_e164, verified_at, opt_in_nudges, nudge_window`.
- Inbound messages logged transiently; parsed to cashflow with `source: 'whatsapp'`.

**Build steps**
1. Provision WhatsApp Business API tenant + number. Verify phone via one-time code bound to the portfolio (no account creation on the user's behalf).
2. **Inbound:** webhook → guarded write endpoint → `ai-proxy` parses natural language ("spent 25k fuel", "ngiye 80k kacyiru rent", or a receipt photo) → cashflow entry with confidence. Echo a confirmation with an "undo" keyword.
3. **Outbound nudges:** scheduled Edge Function reads the top Cost-of-Absence item (§1) + daily summary from the Insight Engine (§2). Send at user's `nudge_window` (default 18:00 Kigali). Respect opt-in only.
4. **Rate-limit & quiet hours:** max one proactive nudge/day; never between 21:00–07:00. Reuse `ai-proxy` per-user rate limit (NFR-SEC-3).
5. Reply commands: `why`, `balance`, `networth`, `stop` (instant opt-out, logged).

**Acceptance criteria**
- [ ] Phone verification required before any read/write; unverified numbers rejected.
- [ ] Inbound NL entry creates a correctly-categorized cashflow ≥ 70% of the time on a Kinyarwanda/English test set; low-confidence flagged.
- [ ] `stop` opts out within one message; no further nudges sent.
- [ ] Max one nudge/day enforced; quiet hours enforced (test with mocked clock).
- [ ] Every nudge traces to a real Insight/Cost item (no generic spam).

**Complexity:** Medium. **Risk:** Messaging-policy compliance, opt-out hygiene. Guard: opt-in only, one-tap stop, audit log of all sends.

---

## 5. Feature — Imisanzu / RSSB Pension Import + Retirement Readiness

**Objective.** Pull RSSB (Imisanzu) + Ejo Heza contribution history into the portfolio; project pension at retirement; render a Readiness Score.

**User value & Cost-of-Absence hook.** Most users have never seen their pension and net worth in one view. Hook: *"Your pension isn't in your net worth. You're under-counting your wealth by ~RWF X — and at current contributions you'll replace only 38% of income at 60."* The gap is the loss.

**Why it's defensible.** Rwanda-only data source. Contribution rates are rising (6%→12% in 2025, toward 20% by 2030), so projections shift yearly — keep the schedule configurable.

**Data model**
- New asset class within existing `data.js` groups: `pension` (kind: `rssb` | `ejoheza`), fields: `contributionsToDate, monthlyContribution, employerMatch, projectedAt60, projectedAt65, asOf`.
- `profile.retirement = { score, replacementRatio, assumptions, computedAt }`.

**Build steps**
1. **v1 import (no API):** user uploads Imisanzu PDF statement / Ejo Heza statement; route through the existing Excel/statement import pipeline (FR-ASSET-6 / FR-CF-5) extended with a PDF→fields parser via `ai-proxy` vision. Preview before save (no silent creation, per FR-AUTH-5 pattern).
2. **Projection engine:** pure function in `src/engine/retirement/`. Inputs: contributions, age, salary, statutory rate schedule (config table, not hard-coded — see tax-year configurability R2). Output: projected pot, replacement ratio, readiness score (0–100).
3. **Top-up simulation:** "add RWF 10,000/mo to Ejo Heza → +RWF Y at 60." Pure, testable.
4. **Dashboard tile:** Readiness Score next to net worth; Cost-of-Absence hook when replacement ratio < 50%.
5. **Config:** statutory rates + retirement ages in a versioned config with `as-of` date surfaced in UI.

**Acceptance criteria**
- [ ] PDF import produces correct contributions on sample Imisanzu + Ejo Heza statements; user reviews before save.
- [ ] Projection function unit-tested against the rate schedule incl. the 12%→20% ramp; boundary tests at age 60 and 65.
- [ ] Pension included in total net worth, tagged distinctly in allocation.
- [ ] Rate schedule is config-driven; changing it does not require code edits.
- [ ] `as-of` shown on every projection (assumptions transparent).

**Complexity:** Low-Medium (v1 PDF import) / High (formal RSSB API). **Risk:** Rate-schedule drift, statement-format variance. Guard: config-driven rates, parser fixtures, review-before-save.

---
## 6. Feature — RRA EBM Receipt Ingestion ("My RRA Wallet")

**Objective.** Pull certified EBM 2.1 invoices issued to a user's TIN into the expense (and, for sellers, income) ledger; surface VAT input credit and turnover trend.

**User value & Cost-of-Absence hook.** Every certified purchase is already declared to RRA — Imari reconciles it automatically. Hook for SME/landlord: *"RWF 1.8M in EBM purchases this quarter aren't matched to a supplier. Unclaimed VAT input credit: ~RWF Z."* Not using it = money left on the table at filing.

**Why it's defensible.** Requires RRA accreditation + TIN-level consent. Architecturally impossible for Kubera/Monarch. Deepens the strongest existing moat (the Tax module).

**Data model**
- `rra_link` (RLS): `portfolio_id, tin, consent_at, last_sync`.
- EBM invoices → cashflow with `source: 'ebm'`, `vatAmount`, `supplierTin`, `invoiceRef`.

**Build steps**
1. Apply for RRA VSDC / CIS integration certificate (`cis_sde_certification@rra.gov.rw`). This is the long-pole; start the BD/legal track immediately, build against the spec in parallel.
2. **v1 (no API approval yet):** accept EBM e-receipt uploads / EIS export files; parse via the import pipeline. This unblocks the feature while accreditation proceeds.
3. **v2 (API):** Edge Function client to VSDC API; consented pull by TIN; reconcile to ledger; compute VAT input credit and monthly turnover.
4. Surface in Tax Report module: "purchases not matched," "VAT credit available," "turnover trend." Add Cost-of-Absence cards.

**Acceptance criteria**
- [ ] v1 upload path live and parsing EIS exports correctly before API dependency.
- [ ] TIN consent captured and revocable; revocation stops sync and offers data deletion.
- [ ] VAT credit + turnover computed and shown in Tax module with `as-of`.
- [ ] No EBM data ingested without explicit TIN consent.

**Complexity:** Medium (v1) / High (API accreditation). **Risk:** RRA approval timeline is external and uncertain. Guard: ship v1 upload first; treat API as enhancement, not blocker.

---

## 7. Feature — UPI Land-Title Linkage

**Objective.** Anchor real-estate assets to the Unique Parcel Identifier (UPI); attach the NLA e-title; schedule district-specific revaluation; tag Fixed Asset Tax per parcel.

**User value & Cost-of-Absence hook.** Turns a free-text "land" line into a verified, tax-aware asset. Hook for diaspora: *"Your Kicukiro plot hasn't been revalued in 14 months. The NISR index for that district is up 3.8% — your net worth understates this asset by ~RWF X. Fixed Asset Tax due if unpaid."*

**Why it's defensible.** UPI-anchored records are uniquely Rwandan. Generic apps have only a text field.

**Data model**
- Extend the land/real-estate asset: `upi, titleDocId, registeredOwner, district, lastRevaluedAt, revalIndexSource`.

**Build steps**
1. **v1 (manual):** add UPI field + e-title PDF upload to the asset editor (conditional fields already exist, FR-ASSET-3). Self-verify: prompt user to confirm registered-owner name matches their NID (no automated NID lookup in v1 — privacy).
2. **Revaluation prompt:** scheduled check vs NISR district index (Reference-tagged, per FR-TREND provenance rules); fire a Cost-of-Absence card when stale > N months.
3. **Tax linkage:** feed UPI + category into the existing Fixed Asset Tax computation (FR-TAX-1) for per-parcel exposure.
4. **v2 (API, if Irembo/NLA opens):** consented e-title fetch. Gate behind availability; do not pre-build assuming a date.

**Acceptance criteria**
- [ ] UPI + e-title upload functional; owner-match confirmation captured.
- [ ] Per-parcel Fixed Asset Tax shows in Tax module.
- [ ] Revaluation card fires on staleness using a Reference-tagged index with visible `as-of`.
- [ ] Land valuations never silently auto-change; user confirms (FR-ASSET-2 override semantics).

**Complexity:** Medium. **Risk:** No public NLA API guaranteed. Guard: v1 fully manual and self-sufficient; API is upside.

---

## 8. Feature — Statement OCR ("Photograph any document")

**Objective.** Drop a bank/MoMo statement (PDF/photo/CSV) → AI extracts and posts entries. Friction parity with Kubera AI Import / Copilot.

**User value & Cost-of-Absence hook.** Onboards a year of history in minutes. Hook: *"Add 3 months of statements and we can compute your real savings rate. Right now we're guessing from 4 entries."*

**Data model:** reuse cashflow `source: 'ocr'`, confidence flagging, skipped-row reporting (FR-CF-5, FR-ASSET-6).

**Build steps**
1. Extend import wizard to accept image/PDF; route to `ai-proxy` vision (batched). Support BK, I&M, Equity, BPR, Cogebanque, Bank of Kigali + Mobicash formats — build a fixtures library per bank.
2. Map columns → categories via the existing Rwanda-merchant categorizer; flag low-confidence; require resolve or "import as-is."
3. Compress and store source image with lightbox (reuse receipt-image handling, FR-CF-6).

**Acceptance criteria**
- [ ] Each supported bank format has a parse fixture + test.
- [ ] Low-confidence rows flagged; user must resolve or accept.
- [ ] AI vision calls batched; call count asserted.
- [ ] Skipped-row report shown (no silent drops).

**Complexity:** Medium. **Risk:** Format variance. Guard: per-bank fixtures, confidence gating.

---

## 9. Feature — Idle-Cash / T-Bill Sweep Insight + Goal Lockbox

**Objective.** Detect idle cash, quantify forgone yield vs BNR instruments, and offer a CMA-licensed broker hand-off. Goals can be "locked" against a real T-bill auction.

**User value & Cost-of-Absence hook.** The clearest loss-aversion feature in the app. Hook: *"RWF 4.2M sat idle 90 days. At ~10% T-bill yield, that's ~RWF 105,000 you didn't earn."* Inaction has a running price tag.

**Data model**
- `goal.lock = { locked, instrumentRef, auctionDate }`.
- Reference T-bill/T-bond yields from the Trends module (provenance-tagged).

**Build steps**
1. Insight rule `idleCashYieldGap` (already in §2) drives a dedicated card with cumulative forgone-yield counter.
2. Surface next BNR auction (Reference data) with a "request a broker call" hand-off to a CMA-licensed intermediary. Imari earns a referral fee — **no money movement, no trade execution** (out of scope per non-goals). Hand-off only.
3. Goal Lockbox: marking a goal "Lock" pins the auction + the broker hand-off. Psychological commitment, real instrument.

**Acceptance criteria**
- [ ] Forgone-yield computed from real balances + Reference yield; `as-of` shown.
- [ ] Broker hand-off is a referral only; app never executes a trade or moves funds.
- [ ] Yields tagged Reference/Modeled per FR-TREND-1.

**Complexity:** Medium. **Risk:** Implying advice. Guard: persistent "not professional advice" disclaimer (FR-AI-5); hand-off framed as introduction, not recommendation.

---

## 10. Feature — Diaspora Oversight Tier (the revenue engine)

**Objective.** First paid tier. Bundle remote oversight + reporting + estate handover for diaspora users at ~USD $9.99/mo.

**User value & Cost-of-Absence hook.** For a Rwandan abroad, the alternative is calling a cousin. Hook: *"You haven't seen your Rwanda assets in 38 days. Your trustee made 2 changes. Get the twice-monthly statement."* Loss = blind to your own assets back home.

**Bundle (gate these behind the tier):**
- Read-only trustee invites (extends Members/RBAC, FR-SET-3) with a Power-of-Attorney workflow.
- Twice-monthly auto "State of Your Rwanda Assets" PDF (land, RSE, T-bonds, MoMo, rental receipts).
- Accountant export pack (RRA-formatted CSV: CGT, rental income, Vehicle Levy — built on the existing Tax module).
- Document vault (titles, contracts, insurance, wills).
- Estate handover (beneficiary list; modeled on Kubera Life Beat).
- USD/EUR/GBP first-class display + BNR FX history.

**Build steps**
1. Billing: integrate Stripe (USD) + Flutterwave (local) behind an `entitlements` table (RLS). Do **not** auto-charge or store card data in-app — redirect to the processor (privacy + prohibited-action rules).
2. Entitlement gate: feature flags read from `entitlements`; free tier stays fully functional for the core dashboard (protects the local market).
3. PDF report templating (server-side Edge Function); schedule twice-monthly; email via the existing Resend `send-invitation` infra pattern.
4. Document vault: Supabase Storage with RLS; size caps; no sharing/permission changes performed by Imari on the user's behalf (prohibited action — user controls sharing).

**Acceptance criteria**
- [ ] Free core unchanged for non-payers.
- [ ] Payment handled by processor; no card data touches Imari.
- [ ] Trustee invite is read-only by default; role changes owner-gated.
- [ ] Scheduled PDF delivers on cadence with correct FX `as-of`.
- [ ] Vault enforces RLS; Imari never alters document sharing/permissions automatically.

**Complexity:** Medium. **Risk:** Unproven willingness-to-pay. Guard: validate with 10–15 paid diaspora interviews before full build; ship a payment link + waitlist first (the council's "fake price" test) and read conversion before committing engineering.

---

## 11. Cross-cutting — Data Freshness & Trust (build alongside everything)

**Objective.** Every number shows how old its inputs are. A confidently-wrong stale number erodes trust faster than no number.

**Build steps**
1. Add `dataAsOf` to every derived figure (net worth, insights, projections, tax, FX).
2. Render a subtle freshness chip: "as of 3 weeks ago" when inputs exceed a per-type threshold (FX 1h, market 15m per existing SW policy; user assets: 30 days → nudge).
3. Stale net worth triggers a Cost-of-Absence card: *"Your net worth is based on data last touched 24 days ago — update 2 assets to make it real."*
4. NCSA Data-Controller registration + "Stored in Rwanda / compliant with Law 058/2021" trust badge in footer (legal/ops task, low engineering).

**Acceptance criteria**
- [ ] No derived number renders without `dataAsOf`.
- [ ] Freshness chip appears past threshold; stale net worth fires a single update prompt.
- [ ] Trust badge live once NCSA registration confirmed.

**Complexity:** Low. **Risk:** Freshness noise. Guard: thresholds per data type; one stale-net-worth prompt max.

---
## 12. Sprint sequencing & gates

Build in this order. Each phase ships behind a flag and passes its acceptance gate before the next starts.

**Phase 0 — Foundations (Sprint 1–2). No new user-facing feature ships without these.**
1. §1 Cost-of-Absence component.
2. §2 Insight Engine (pure functions + Vitest suite). This is also risk-mitigation R1.
3. §11 Data-freshness layer.
4. NCSA Data-Controller registration kicked off (parallel, legal track).

**Phase 1 — Friction killers & daily engagement (Sprint 3–6).**
5. ~~§3 MoMo SMS Parser~~ — **deferred to mobile app**; web users use the statement importer (`bankImport.js`) instead.
6. ~~§4 WhatsApp Bot + Nudges~~ — **deferred to mobile app**; provisioning + always-on inbound belong with the native lifecycle.
7. §5 Imisanzu/RSSB import (v1 PDF). Fast win, high "wow."
8. §8 Statement OCR (the primary capture path on web while §3/§4 are mobile-only).

**Phase 2 — Moat + first revenue (Sprint 7–12).**
9. §10 Diaspora Oversight tier. **Gate before building: payment-link + waitlist conversion ≥ 2.5% of signups in 60 days.** If < 0.5%, repackage as accountant-export-only at $4.99.
10. §6 RRA EBM ingestion (v1 upload now; API after accreditation — start BD in Phase 0).
11. §7 UPI land-title linkage (v1 manual).
12. §9 Idle-cash insight + Goal Lockbox (needs CMA intermediary BD — begin in Phase 1).

**Phase 3 — Long bets (Year 2).** Open Finance TPP-readiness architecture; eKash integration; Ikimina/SACCO module; estate vault; RSE brokerage hand-off. Architect for these now (don't pre-build to a fixed external date).

**Decision triggers that change the plan:**
- ~~MoMo parsing < 40% accuracy → OCR-first, demote SMS.~~ (Moot — §3 deferred to mobile.)
- ~~WhatsApp DAU/MAU < 10% → demote to Phase 3.~~ (Moot — §4 deferred to mobile.)
- Diaspora conversion < 0.5% → repackage; > 2.5% → raise price to $14.99 and accelerate.
- BNR confirms Open Finance Phase 2 for 2027 → promote §14-class work.
- RSE diaspora Direct Market Access launches before mid-2026 → promote §9 T-bond sweep to Phase 1.

---

## 13. Definition of Done (every feature)

- [ ] Behind a feature flag; free core remains fully functional.
- [ ] Nav via `nav.js`; view code-split; chunk < 60 KB gzipped.
- [ ] Reducer changes covered by Vitest (positive, null, boundary).
- [ ] All AI/model calls via `ai-proxy`; key never in browser; AI fires only on low-confidence/batched paths.
- [ ] RLS on all new tables; consent captured + revocable where personal data is read; revocation deletes.
- [ ] No card/asset/insight renders without a real numeric source and a `dataAsOf`.
- [ ] A Cost-of-Absence hook is defined for the feature (the "loss of not using it").
- [ ] Graceful degrade when external APIs/Supabase unreachable (cached/Reference, localStorage).
- [ ] a11y: color + ▲/▼ glyph, accessible names, keyboard path, reduced-motion, ≤ 300 ms transitions.
- [ ] `vite build` passes (CI deploy gate).
- [ ] No prohibited actions automated: no account creation, no money movement, no trade execution, no auto-changing document/sharing permissions, no card-data handling in-app.

---

## 14. The loss-aversion thesis (why every feature carries a Cost-of-Absence hook)

The brief was explicit: users must *feel the need, and the loss of not using the app.* The mechanism is honest loss aversion — surface costs that are **already real and already in the user's data**, never invented fear.

Each feature maps to a concrete loss the user incurs by staying away:

| Feature | The loss the user feels |
|---|---|
| MoMo SMS parser | "Your net worth on screen is wrong — days of activity missing." |
| WhatsApp nudges | "No one is watching your money today." |
| Pension import | "You're under-counting your wealth and under-saving for 60." |
| RRA EBM | "Unclaimed VAT credit; surprise at filing." |
| UPI land | "Your biggest asset is stale and tax is accruing." |
| Idle-cash insight | "RWF X you didn't earn — a running counter." |
| Diaspora tier | "You're blind to your own assets back home." |
| Freshness layer | "Your numbers are 3 weeks old — don't trust them." |

The discipline: one pinned loss on open, honest sourcing on every claim, one-tap opt-out on every nudge. Loss aversion that informs, never manipulates — because in a wealth app, the moment a user catches a fabricated number, trust is gone for good.

---

# PART B — Feedback & Feature Requests (Backlog Intake 2026-05-28)

Source: user/founder feedback. Triaged into Bugs, Quick Wins, New Features, and Cross-links to Part A. Each carries a Cost-of-Absence hook where user-facing. Priority: **P0** (broken/trust) · **P1** (high value, low effort) · **P2** (high value, medium effort) · **P3** (larger build).

## B0. Triage summary

| # | Item | Type | Priority | Maps to |
|---|---|---|---|---|
| B1 | Edit button unclear in dark mode (Assets) | Bug (a11y) | P0 | new |
| B2 | Language switch misses some strings | Bug (i18n) | P0 | NFR-I18N-1 |
| B3 | Cap invites at 2 per portfolio | Quick win | P1 | FR-SET-3 |
| B4 | Chat with invited members | New feature | P2 | new |
| B5 | Paginate assets (10/page, next) | Quick win | P1 | FR-ASSET-4 |
| B6 | Cash-in-Hand widget | New widget | P1 | new |
| B7 | Tax Estimate widget | New widget | P1 | Tax module |
| B8 | Debt widget | New widget | P1 | Liabilities |
| B9 | Investable widget | New widget | P1 | §9 idle-cash |
| B10 | Cash-flow dashboard by category + amount | New feature | P2 | FR-CF-3 |
| B11 | Time-based net-worth sorting (1M/1Y/last year) | New feature | P2 | FR-DASH-4 |
| B12 | Net-worth projections (Fast Forward) + scenario dashboard + peer/market ideas | New feature | P3 | §2, AI |
| B13 | Expense capture from photo | New feature | P2 | §8 OCR, §4 |
| B14 | Proactive AI alerts | New feature | P2 | §1, §2, §4 |
| B15 | Pension on Assets + Dashboard | New feature | P2 | §5 (already specced) |
| B16 | "How to use WhatsApp bot" guidance | Docs/UX | P1 | §4 |
| B17 | NISR + BNR macro overlay | New feature | P2 | new |
| B18 | Balance sheet report | New feature | P2 | Tax/Reports |
| B19 | Club benchmark ratios | New feature | P3 | FR-DASH-5 |

---

## B1. Fix — Asset "Edit" button unclear in dark mode  [P0 · Bug]

**Objective.** Edit control must meet contrast in dark theme.
**Why P0.** a11y regression (NFR-A11Y-1, WCAG 2.1 AA). Users can't find a core action.
**Build steps**
1. Audit the Edit control's token in dark mode (`styles.css`). Likely a low-contrast icon/ghost button on dark surface.
2. Use a token that passes ≥ 4.5:1 against the dark card surface; add visible border or filled variant. Add accessible name if icon-only (NFR-A11Y-3).
3. Sweep sibling row actions (delete, inline-edit) for the same defect.
**Acceptance**
- [ ] Edit control ≥ 4.5:1 contrast in dark mode; visible focus ring.
- [ ] Icon-only controls have `aria-label`.
- [ ] Verified on asset table + asset cards.
**Complexity:** Low.

---

## B2. Fix — Language switch leaves untranslated strings  [P0 · Bug]

**Objective.** en/fr/rw applies to all chrome (NFR-I18N-1).
**Why P0.** Broken core promise; Kinyarwanda/French users see mixed UI = looks unfinished, erodes trust.
**Build steps**
1. Add a dev-mode i18n linter: scan render output for hard-coded literals not routed through the translation layer. Fail CI on new untranslated strings.
2. Generate a missing-keys report per locale (en vs fr vs rw). Triage: app chrome first; tax/trust prose may stay English pending native review (NFR-I18N-2 — keep that exception explicit).
3. Backfill fr/rw keys for all chrome strings. Route any string found inline through the layer.
**Acceptance**
- [ ] Missing-keys report = 0 for app chrome in all three locales.
- [ ] CI fails on a newly introduced hard-coded UI string.
- [ ] Tax/trust prose English-fallback is intentional and labeled, not accidental.
**Complexity:** Medium (sweep) / Low (lint gate).
**Note:** This is the highest-leverage trust fix in Part B. Do it before adding new strings from B4–B19.

---

## B3. Cap invitations at 2 per portfolio  [P1 · Quick win]

**Objective.** Max 2 invited members per portfolio (owner + 2).
**Build steps**
1. Enforce server-side: count `portfolio_members` + pending `portfolio_invitations` for the portfolio; reject the 3rd at the `send-invitation` Edge Function (don't rely on UI alone).
2. UI: disable "Invite" + show "2 of 2 used" when at cap; copy explains the limit.
3. Make the cap a config constant (`MAX_INVITES = 2`) so the Diaspora tier (§10) can raise it later per entitlement.
**Acceptance**
- [ ] 3rd invite rejected server-side even via direct call.
- [ ] UI shows usage + disabled state at cap.
- [ ] Cap is config-driven, not hard-coded in multiple places.
**Complexity:** Low.
**Cross-link:** Entitlements (§10) will gate higher caps for paid tiers.

---

## B4. Chat with invited members  [P2 · New feature]

**Objective.** In-portfolio messaging between members (owner/editor/viewer).
**User value & Cost-of-Absence hook.** Household CFO + spouse/accountant coordinate inside the data. Hook: *"Decisions about shared money happen in WhatsApp, out of context. Keep them next to the numbers."*
**Data model**
- `portfolio_messages` (RLS): `id, portfolio_id, sender_user_id, body, created_at, read_by[]`. RLS = portfolio members only.
**Build steps**
1. Realtime channel per portfolio (reuse Supabase Realtime already used for sync, FR-PLAT-2).
2. Lightweight thread UI; mention an asset/goal by deep link (hash route). No file upload in v1 (privacy/scope).
3. Unread badge on nav; respect roles (viewer can read/post messages but not data).
4. Moderation/scope: messages are per-portfolio only; no cross-portfolio DM. No external email relay (avoid sending-on-behalf rules).
**Acceptance**
- [ ] Only members can read/post (RLS verified by direct-call test).
- [ ] Realtime delivery across open sessions; unread badge accurate.
- [ ] Deep-link to a referenced asset/goal works post-reload (FR-PLAT-4).
**Complexity:** Medium.
**Risk:** Scope creep into full chat. Guard: text-only, in-portfolio, v1.

---

## B5. Paginate the asset list (10 per page)  [P1 · Quick win]

**Objective.** Show ~10 assets/view with next/prev; reduce scroll + render cost.
**Why now.** Large portfolios slow the view; also a perf win (NFR-PERF).
**Build steps**
1. Add client-side pagination over the existing filtered/sorted set (works with FR-ASSET-4 search/sort/filter — paginate the *result*, not the raw list).
2. Page size config (default 10); next/prev + page indicator; preserve filters/sort across pages.
3. Keep full keyboard nav (FR-ASSET-7) across pagination; focus moves to first row of new page.
4. Virtualize only if needed later; pagination is enough for now.
**Acceptance**
- [ ] 10/page default; next/prev; filters + 9-way sort persist across pages.
- [ ] Keyboard nav + focus management across page changes.
- [ ] Bulk multi-select state handled sanely across pages (select-all = current page; explicit "select all N" option).
**Complexity:** Low.

---

## B6–B9. Dashboard widgets — Cash-in-Hand, Tax Estimate, Debt, Investable  [P1 · New widgets]

**Objective.** Four KPI/summary widgets, each a one-glance number with a Cost-of-Absence hook and deep link.

All four reuse the Insight Engine (§2) for their numbers and the `<CostOfAbsence>` component (§1). Build as a shared `<MetricWidget>` with `{ title, value, subtext, costHook, deepLink, asOf }`. Add to the KPI strip / Arrange-mode sections (FR-DASH-3, FR-DASH-8).

**B6 — Cash in Hand.** Sum of cash + MoMo + bank current (liquid, excludes locked/goal-committed). Hook: *"RWF X liquid — Y months of expenses."* Deep link → Accounts.

**B7 — Tax Estimate.** Pull next-obligation total from the Tax module (FR-TAX-4): Fixed Asset Tax + Vehicle Levy + estimated CGT/withholding. Hook: *"~RWF X due, next deadline in Z days."* Deep link → Tax Report. Carry the disclaimer (FR-TAX-6).

**B8 — Debt.** Total liabilities + nearest maturity/overdue countdown (FR-LIAB-3). Hook: *"RWF X owed; next payment in Z days; debt-to-asset W%."* Deep link → Liabilities.

**B9 — Investable.** Liquid minus an emergency-fund buffer (configurable, default 3 months expenses) = "investable surplus." Hook: *"RWF X investable sitting idle — at ~10% T-bill that's RWF Y/yr forgone."* Deep link → §9 idle-cash insight.

**Acceptance (all four)**
- [ ] Each widget = one `<MetricWidget>` instance; number from Insight Engine with `asOf`.
- [ ] Each has a real Cost-of-Absence hook and a working deep link.
- [ ] Arrange-mode can reorder/hide them (FR-DASH-8); state persists per browser.
- [ ] Debt-free state: Debt widget collapses gracefully (mirror FR-DASH-3 logic).
**Complexity:** Low each (shared component).

---
## B10. Cash-Flow dashboard by category + amount  [P2 · New feature]

**Objective.** A cash-flow overview: spend/income by category with amounts, on the dashboard (not just inside the Cash Flow module).
**User value & Cost-of-Absence hook.** Most users never see where money goes. Hook: *"Top category this month: school fees, RWF X (32% of spend). Up 18% vs last month."*
**Build steps**
1. Reuse the expense-by-category donut + income-vs-expense logic (FR-CF-3); render a compact dashboard variant.
2. Category table: name, amount, % of total, MoM delta with ▲/▼ glyph (NFR-A11Y-2).
3. Pro-rate recurring entries into monthly figures (FR-CF-2) so the dashboard agrees with the Cash Flow module (single source of truth, FR-DASH-2).
4. Click a category → filtered Cash Flow view (deep link).
**Acceptance**
- [ ] Dashboard numbers match the Cash Flow module exactly (parity test).
- [ ] MoM delta correct incl. recurring pro-ration.
- [ ] Category click deep-links to filtered entries.
**Complexity:** Medium.

---

## B11. Time-based net-worth sorting / history  [P2 · New feature]

**Objective.** "What was my net worth last month / last year?" — selectable ranges on the net-worth view.
**User value & Cost-of-Absence hook.** Trajectory beats level. Hook: *"You're RWF X richer than a year ago — but flat over 3 months. Momentum is stalling."*
**Build steps**
1. Use the daily Snapshot history (`{date, netWorth, costBasis}`, 60-day synthetic seed). Add range selector: 1M / 3M / 6M / 1Y / Last Year / ALL (extends the existing timeline ranges in the feature catalog §5.2).
2. "Last year" = same-period prior-year comparison; show absolute + % delta vs selected anchor.
3. Where history predates the user, show the synthetic-seed caveat (honest provenance).
4. Feed the delta into the Insight Engine (`realVsNominalNetWorth`, §2) so the FX-adjusted view is one toggle away.
**Acceptance**
- [ ] All ranges render from Snapshot history; axis labels dedup (FR-DASH-4 behavior).
- [ ] Prior-year comparison correct; deltas shown in value and %.
- [ ] Synthetic-seed period flagged; no fabricated precision.
**Complexity:** Medium.
**Note:** Requires enough snapshot history — value compounds over time. Ship now so history accrues.

---

## B12. Net-Worth Projections (Fast Forward) + scenario dashboard + peer/market ideas  [P3 · New feature]

**Objective.** Project net worth 1M / 1Y / 5Y / 10Y / 20Y; build an Advisory scenario dashboard per horizon; suggest investment ideas from market + (anonymized, aggregated) peer patterns.

**User value & Cost-of-Absence hook.** Shows the future cost of today's inaction. Hook: *"At your current savings rate you reach RWF X by 2046. Add RWF 50k/mo to Ejo Heza and it's RWF Y — a RWF Z gap you're leaving on the table."*

**Build in three layers — ship 12a first.**

**B12a — Deterministic projection engine (P3, do first).**
1. Pure function `src/engine/projection/` — inputs: current net worth, savings rate, asset growth assumptions per class (reuse class valuation rules from `data.js`), FX path. Output: projected net worth per horizon with a low/expected/high band.
2. Assumptions are config-driven and **visible** ("expected 8%/yr, inflation-adjusted"). Tag Modeled (FR-TREND-1). Never present as a guarantee.
3. Scenario controls: change savings rate, add a lump sum, change FX assumption → live re-projection.
**Acceptance:** pure + Vitest (boundary at each horizon); bands shown; assumptions visible + Modeled-tagged; respects display currency.

**B12b — Advisory scenario dashboard (P3, second).**
1. Per selected horizon, render a scenario view: projected allocation, milestone crossing dates (FR-DASH-9), goal-funding feasibility (FR-GOAL-3).
2. AI Advisor (via `ai-proxy`) narrates the scenario grounded in the projection output (engine decides numbers; AI explains). Persistent "not professional advice" disclaimer (FR-AI-5).
**Acceptance:** scenario reads from engine output only; AI never invents figures; disclaimer present.

**B12c — Peer + market investment ideas (P3, last — privacy-gated).**
1. "What's working for others" must use **only anonymized, aggregated, opt-in** cohort data — never another user's holdings. Minimum cohort size (e.g., ≥ 50) before any stat is shown. This is a hard privacy line (DPP Law 058/2021 + your own RLS model).
2. Surface market-grounded ideas from the Trends module (Reference/Modeled tagged), not stock tips. Frame as education, not advice.
3. Explicit opt-in to contribute anonymized data; opt-out by default.
**Acceptance:** no individual's data ever exposed; cohort floor enforced in query; opt-in default off; ideas tagged provenance; disclaimer present.
**Risk:** This is the highest-sensitivity item in Part B. If unsure, ship 12a + 12b and defer 12c until the privacy model is reviewed. Do not build 12c on raw cross-user reads.
**Complexity:** High.

---

## B13. Expense capture from a photo  [P2 · New feature]

**Objective.** User snaps a receipt/expense image → Imari extracts and posts the expense to their account.
**User value & Cost-of-Absence hook.** Zero-typing capture. Hook: *"4 receipts unphotographed this week ≈ RWF X missing from your spend picture."*
**Build steps**
1. This is the consumer-facing slice of §8 (Statement OCR) + §4 (WhatsApp). Reuse the `ai-proxy` vision path; do not build a separate pipeline.
2. Entry points: (a) in-app "snap receipt" on the cash-flow editor (extends receipt-image attachment FR-CF-6); (b) WhatsApp photo (§4).
3. Extract merchant, amount, date, suggested category (Rwanda-merchant categorizer). Confidence flag; user confirms before save (no silent creation).
4. Store compressed image with lightbox; link to the entry.
**Acceptance**
- [ ] Photo → pre-filled expense draft ≥ 70% correct on a Rwanda-receipt test set; user confirms.
- [ ] Same `ai-proxy` vision path as §8 (no duplicate pipeline; assert batched calls).
- [ ] Image compressed + linked; low-confidence flagged.
**Complexity:** Medium.
**Cross-link:** Hard dependency on §8. Sequence §8 → B13.

---

## B14. Proactive AI Alerts  [P2 · New feature]

**Objective.** Push timely, data-grounded alerts: low balance, un-added expenses, depreciating vehicle, bond nearing maturity, overdue receivable, stale asset.
**User value & Cost-of-Absence hook.** This *is* the daily-engagement engine. Hook example: *"Your vehicle dropped ~RWF X in value this quarter; Road Maintenance Levy due in Z days."*
**Build steps**
1. This is the surfacing layer for §1 (Cost-of-Absence) + §2 (Insight Engine) + §4 (WhatsApp/PWA push). Do not invent new alert logic — alerts are Insight Engine outputs above a severity threshold.
2. Channels: in-app banner (top, FR-DASH-6 alert slot), ~~WhatsApp nudge (§4)~~ *(deferred to mobile with §4 — web v1 is in-app only)*, PWA push (later).
3. Alert types in v1: low liquid balance (< buffer), un-added expenses (gap since last entry / detected MoMo not categorized), vehicle depreciation, bond < 90 days to maturity, overdue receivable, asset stale > 30 days. (Reuse existing alert thresholds from FR-DASH-6.)
4. Per-alert mute + global quiet hours; max one proactive push/day (§4 rate limit).
**Acceptance**
- [ ] Every alert traces to an Insight Engine rule + real value (no generic alerts).
- [ ] Per-type mute + quiet hours + one-push/day enforced.
- [ ] In-app + WhatsApp share one source of truth (no divergence).
**Complexity:** Medium.
**Cross-link:** Depends on §1, §2, §4. Build those first.

---
## B15. Pension (Imisanzu / RSSB) on Assets + Dashboard  [P2 · Cross-link to §5]

**Status:** Already specced in **§5 (Imisanzu/RSSB Pension Import + Retirement Readiness)**. This intake item confirms two surfacing requirements:
1. Pension appears as an **asset** in the Assets section (new `pension` class in `data.js`, per §5 data model) — included in net worth, tagged distinctly in allocation.
2. Pension appears on the **dashboard** as a Readiness tile (§5 step 4) with a Cost-of-Absence hook when replacement ratio < 50%.
**Action:** No new spec. Ensure §5 acceptance criteria explicitly cover both the Assets-list row and the dashboard tile. Add to §5 DoD: *"pension visible in Assets list AND as a dashboard tile."*

---

## B16. "How to use the WhatsApp Quick-Entry Bot"  [P1 · Docs/UX]

> **🚫 DEFERRED with §4 (2026-06).** This item is onboarding for the WhatsApp bot; the bot itself moved to the Imari mobile app, so there is nothing to onboard on the web. Spec preserved for the mobile rebuild — when §4 ships there, build this in the same sprint.

**Objective.** Onboarding + in-app guidance for the WhatsApp bot (§4). A powerful feature is worthless if users don't know it exists or how to start.
**User value & Cost-of-Absence hook.** Activation. Hook: *"Add expenses by texting — no app needed. Connect WhatsApp in 30 seconds."*
**Build steps**
1. Settings card: "Connect WhatsApp" → phone verification flow (§4 step 1) with a 3-step illustrated guide (connect → text an example → see it appear).
2. First-run tip after a user logs ≥ 3 manual expenses: "Tired of typing? Text them instead." (behavioral trigger, not nag).
3. In-WhatsApp `help` command returns the command list (`why`, `balance`, `networth`, `stop`).
4. Localize the guide (en/fr/rw — respect B2 fix).
**Acceptance**
- [ ] Connect flow + 3-step guide live in Settings, localized.
- [ ] `help` command returns usage; examples in all 3 languages.
- [ ] First-run tip fires once, dismissible, after the 3-expense trigger.
**Complexity:** Low.
**Cross-link:** Depends on §4 shipping first.

---

## B17. NISR + BNR Macro Overlay  [P2 · New feature]

**Objective.** On the dashboard, show each user their *personalized* macro: personal inflation vs national CPI; net-worth growth vs RWF/USD depreciation; RSE allocation vs RSE All-Share (RSESI) benchmark.
**User value & Cost-of-Absence hook.** "Personalized macro" no global app can replicate. Hook: *"Your net worth grew 6% — but RWF lost 8% vs USD and CPI ran 5%. In real terms you're flat. Standing still costs you."*
**Build steps**
1. Three comparison cards, each reading from the Trends module's provenance-tagged data (NISR CPI = Reference, BNR FX = Live/Reference, RSESI = Reference). Must read the **same FX overrides** the rest of the app uses (FR-TREND-3 — no divergent rates).
2. **Personal inflation:** weight national CPI components by the user's own expense-category mix (from Cash Flow). Show personal vs headline CPI.
3. **Real net-worth growth:** nominal RWF growth adjusted by (a) CPI and (b) RWF/USD depreciation — two toggleable lenses. Feed from `realVsNominalNetWorth` (§2).
4. **RSE allocation vs RSESI:** user's RSE holdings weighting vs index; "You vs Benchmark" bar (reuse BenchmarkBar from the 10/10 hardening pass).
5. Every figure provenance-tagged + `as-of` (FR-TREND-1, §11).
**Acceptance**
- [ ] All three cards render from Trends data with provenance badges + `as-of`.
- [ ] FX rates identical to Dashboard (parity test, FR-TREND-3).
- [ ] Personal inflation uses the user's real category mix; falls back to headline CPI when < 3 months data (thin-data caveat, FR-CF-7).
**Complexity:** Medium.

---

## B18. Balance Sheet report  [P2 · New feature]

**Objective.** A proper personal balance sheet ("make sheet") in Reports: assets (by group) − liabilities = net worth, with detail lines, exportable.
**User value & Cost-of-Absence hook.** The document users need for a loan, visa, or accountant. Hook: *"Need to prove your net worth to a bank? Generate a dated balance sheet in one click."* This is also a Diaspora-tier driver (§10 accountant pack).
**Build steps**
1. Reports view: assets grouped by the 11 groups with cost basis + current value; liabilities by type; net worth total. Use the single source of truth (FR-DASH-2) — must equal the dashboard figure exactly.
2. Date-stamped ("Balance sheet as of <date>"), display-currency, FX `as-of` shown.
3. Print/Save-PDF (reuse Tax module's PDF path, FR-TAX-5).
4. Export: structured CSV for accountants (feeds §10 accountant pack — build the data shape once, reuse).
5. Provenance: Modeled/Reference asset valuations flagged so a lender sees what's estimated.
**Acceptance**
- [ ] Balance sheet net worth = dashboard net worth (parity test).
- [ ] PDF + CSV export; dated; FX `as-of` shown.
- [ ] Estimated valuations flagged (no false precision for a lender).
**Complexity:** Medium.
**Cross-link:** Shares export shape with §10 (Diaspora accountant pack). Build the CSV schema here, reuse there.

---

## B19. Club / Cohort Benchmark Ratios  [P3 · New feature]

**Objective.** Let a user compare their financial ratios (savings rate, debt-to-asset, liquidity, income-generating %) against a "club" — an opt-in cohort or a private group (e.g., an investment club, ikimina, or peer band).
**User value & Cost-of-Absence hook.** Social benchmarking drives behavior. Hook: *"Your savings rate is 14%. Your club median is 22%. You're falling behind the group."*
**Build steps**
1. **Two modes.** (a) **Anonymized cohort** — same privacy rules as B12c: opt-in, aggregated, minimum cohort size, never individual data. (b) **Private club** — members who explicitly join a shared benchmark group consent to share *ratios only* (never balances) with that group.
2. Compute the existing four ratios (FR-DASH-5) per member; share only the ratio, never underlying amounts.
3. Show user vs club median/quartile with "You vs Club" bars (reuse BenchmarkBar). ▲/▼ glyph + color.
4. Hard privacy gate: ratios only, consent required, leave-club deletes the user's contribution. Enforce in RLS + query (min group size).
**Acceptance**
- [ ] Only ratios shared, never balances/holdings; verified by query inspection.
- [ ] Consent required to join; leaving removes contribution.
- [ ] Min group size enforced before any club stat renders.
- [ ] User vs club bars with a11y glyphs.
**Complexity:** High.
**Risk:** Privacy. Same line as B12c — never expose individual financial data. If the privacy model isn't reviewed, ship the personal-ratios view (FR-DASH-5 already covers it) and defer the club comparison.

---

## B20. Updated sprint placement for Part B

Slot Part B items into the Part A phases — don't run a parallel track.

**Immediate (before any new feature — trust & hygiene):**
- B2 (i18n sweep + lint gate) — highest-leverage trust fix.
- B1 (dark-mode Edit contrast).
- B3 (invite cap), B5 (asset pagination) — quick wins.

**Phase 0–1 (with Foundations & friction killers):**
- B6–B9 widgets (shared `<MetricWidget>` on Insight Engine + Cost-of-Absence).
- B7 Tax widget, B18 Balance Sheet (both lean on existing Tax module + parity).
- ~~B16 WhatsApp guidance~~ — **deferred to mobile app with §4.**
- B13 photo expense (after §8 OCR).
- B14 proactive alerts (after §1/§2 — the §4 WhatsApp delivery channel is mobile-only; in-app banner / email-digest delivery remain in scope).
- B15 pension surfacing (with §5).

**Phase 2 (value depth):**
- B10 cash-flow dashboard, B11 time-based history, B17 macro overlay.
- B4 member chat.

**Phase 3 (larger / privacy-sensitive):**
- B12 projections + scenario dashboard (12a→12b→defer 12c pending privacy review).
- B19 club benchmarks (defer comparison pending privacy review; personal ratios already shipped).

**Two privacy lines drawn in concrete (B12c, B19):** never read across users' raw financial data. Cohort/club features use opt-in, aggregated, ratio-only data with an enforced minimum group size. If the privacy model is not reviewed and signed off, ship the personal/individual version and defer the social comparison. In a wealth app, one privacy breach ends the product.

---

## B21. Definition of Done additions for Part B

In addition to §13:
- [ ] Bugs (B1, B2): regression test added so the defect cannot silently return (contrast check / i18n lint in CI).
- [ ] Widgets (B6–B9): all four use the shared `<MetricWidget>`; no bespoke widget code.
- [ ] Any cohort/club/peer feature (B12c, B19): opt-in default off, ratios/aggregates only, minimum group size enforced in query AND RLS, individual data never exposed — reviewed before merge.
- [ ] Every new user-facing string routed through i18n (enforced by the B2 lint gate).
- [ ] Photo/OCR (B13) reuses the single `ai-proxy` vision pipeline (§8) — no duplicate path.
