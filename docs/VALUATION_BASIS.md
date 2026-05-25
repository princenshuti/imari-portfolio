# Valuation Basis · Design Direction

> Source of truth for how Imari should value assets and calculate tax.
> This document captures intent. Code may not yet match — see "Current state" vs "Target state" sections.

## The principle

**Portfolio valuation and tax calculation are two separate concerns.** Today's code conflates them. Going forward, they live in two distinct calculation paths that never share inputs except the underlying transactions.

| Concern | Question it answers | Data sources |
|---|---|---|
| **Valuation** | "What is this asset worth today?" | RRA depreciation (business assets) + scraped market data (everything else) |
| **Tax** | "What do I owe RRA on this?" | RRA rules **only** — never touch valuation rules of thumb |

These are physically separated in code (different modules, different functions), and a change to one must never silently change the other.

---

## Valuation — Depreciation

| Asset condition | Rule | Notes |
|---|---|---|
| **Business asset, computers / software / related** | RRA pooling **50%** declining balance | Per *Income Tax Law, depreciation rules* |
| **Business asset, other tangible (vehicles, equipment used in business)** | RRA pooling **25%** declining balance | Same source |
| **Business asset, buildings & machinery, built-in heavy equipment** | RRA **5%** straight-line | Same source |
| **Business asset, intangibles (goodwill, R&D)** | RRA **10%** straight-line | Same source |
| **Personal vehicle / equipment** | **Market depreciation** (scraped) | RRA pools do not apply — these are deduction rules, not valuation rules |
| **Building (personal)** | **Market data** (no depreciation in valuation context) | Buildings rarely depreciate at market unless damaged |
| **Land, fine arts, jewellery, livestock breeding stock** | **Never depreciated** | Per RRA "non-wearing assets" list |

**The business/personal distinction is user-driven.** Each asset has a `usage: 'business' | 'personal'` flag (to add). Default depends on asset class (e.g. computer in a sole-proprietor's setup defaults to business if the user has indicated they run a business).

---

## Valuation — Appreciation

Appreciation is **not** in any RRA rule book. RRA only defines depreciation deductions. So appreciation comes from market data:

| Asset class | Primary source | Fallback |
|---|---|---|
| **Land / plot** | Scraped from Rwandan real-estate sites (Property24 RW, Cyamunara, etc.) keyed on neighbourhood / district / UPI | `KIGALI_NEIGHBOURHOODS` per-sqm baseline (already in `data.js`) |
| **House / apartment** | Same scraping + neighbourhood × square-meter | Same baseline |
| **RSE-listed stock** | RSE official daily prices (when API available) | User-entered `lastPrice` |
| **Foreign stock / ETF** | Yahoo Finance / Alpha Vantage live | User-entered `lastPrice` |
| **Crypto** | CoinGecko live (already wired in `market.js`) | User-entered `lastPrice` |
| **Gold / commodities** | metals.live / LBMA spot (already wired) | Modeled fallback |
| **Livestock** | NISR Agricultural Statistics market price tables (when scraped) | Manual override |
| **T-bills / T-bonds** | Simple-interest accrual at stated yield (unchanged) | — |
| **Receivables** | Same — accrual at agreed rate | — |
| **Business equity** | Manual valuation only | — |

**The user always overrides.** Every asset has a `currentValue` field. If filled, it wins over every rule and every scrape.

---

## Tax — Strictly RRA

Tax calculations live in `TaxReport.jsx` and use **only** the RRA constants in `data.js` (`FIXED_ASSET_TAX`, `VEHICLE_CATEGORIES`, `TAX_RULES`). They never read the valuation `rule` functions.

| Tax | Rate | Basis | Already in code |
|---|---|---|---|
| **Fixed Asset Tax** | 0.1% | Property value × (max 0, value − RWF 3M for residential) | ✅ |
| **Vehicle Road Maintenance Levy** | Flat RWF 50k–150k per category | Per Law 013/2025 | ✅ |
| **Capital Gains Tax** | 5% | Realised gain (sale price − purchase price) | ✅ (display only — no realisation tracking yet) |
| **Withholding Tax on investment income** | 15% | Interest / dividends received | ✅ (display only) |
| **PAYE** | Progressive bands | Income from employment | Out of scope (this is income, not wealth) |
| **VAT** | 18% | Not applicable to personal wealth | Out of scope |
| **Depreciation (deduction for business income tax)** | RRA pools (see above) | Only for users running registered businesses, applied to **business income tax** filing — *not* wealth valuation | ⏳ Future |

---

## Current state (May 2026)

What the code does today, honestly:

- **All valuation** uses hard-coded "rule of thumb" compound growth rates in `data.js` (`+5%` land, `−15%` vehicle, etc.). These are **not** RRA rates and **not** based on market data. They're rough averages a designer typed in.
- **Tax module** does **not** apply any depreciation. It only computes the four taxes in the table above based on user-entered current values.
- **Market data integration** exists for FX (BNR live), crypto (CoinGecko live), and gold (metals.live live). Not for real-estate, RSE stocks, livestock, or vehicles.

The landing page has been updated (commit `<TBD>`) to describe only what the code actually does. The "RRA depreciation" claim that was previously in the Tax card has been removed.

---

## Target state — implementation phases

### Phase 1 · Decouple wealth and tax (foundation)
- Add `usage: 'business' | 'personal'` field to each asset
- Move all valuation logic into a `valuation/` module; move tax logic into `tax/`
- Audit `TaxReport.jsx` to ensure it never imports from `valuation/`

### Phase 2 · RRA depreciation for business assets
- New `valuation/depreciationRRA.js`:
  - Pool tracking (declining balance) for 25% / 50% pools
  - Straight-line for buildings (5%), intangibles (10%)
- Surface in UI: "Business basis: RWF X · Market value: RWF Y" on each asset card
- Use business basis in business income tax estimate (future tax feature)

### Phase 3 · Market data scraping
- Service that periodically scrapes:
  - Property24 RW, Cyamunara (real estate)
  - RSE.rw daily price file (RSE stocks)
  - NISR price indices (livestock, commodities)
- Cache in Supabase (shared across all users — public data, no PII)
- Per-asset valuation uses scraped data with user override

### Phase 4 · Realisation tracking for CGT
- When user marks an asset as sold, compute realised gain (sale − purchase) and apply 5% CGT
- Add to tax report year-end summary

### Phase 5 · Business income tax (full)
- PAYE, VAT, business income tax for sole proprietors
- Use Phase-2 depreciation as deductible expense

---

## Open questions

- **Where does livestock value come from?** NISR has annual market prices but no live API. Likely a manual quarterly update of a reference table in `data.js`, sourced from NISR publications.
- **How granular is the property scrape?** UPI-level lookup would be ideal but unlikely available. Realistic: neighbourhood × type × square-meter.
- **Who runs the scrapers?** GitHub Actions on a schedule? Supabase Edge Functions? Decide before Phase 3.
- **Do we need a "tax basis" view per asset** showing depreciated book value separately from market value? Yes — for any user with business assets. UI surface to design.

---

## Honesty discipline

We never claim Imari uses RRA depreciation, market scraping, or any other data source that isn't actually wired up in code. Landing copy, dashboard tooltips, and AI advisor responses all hold to this. If a feature is in `docs/VALUATION_BASIS.md` but not in code, it does not exist for users.
