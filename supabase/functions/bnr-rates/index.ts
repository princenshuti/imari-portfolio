/**
 * bnr-rates — Supabase Edge Function
 *
 * Fetches the latest exchange rates published by the National Bank of Rwanda
 * (BNR) and upserts them into public.exchange_rates.
 *
 * Source endpoint (unauthenticated, used by bnr.rw/exchangeRate itself):
 *   https://fxrates.bnr.rw/currency_history/?currency_name=USD&start_date=DD/MM/YYYY&end_date=DD/MM/YYYY
 *
 * Run modes:
 *  • Scheduled by pg_cron once per day (see supabase-migration-002.sql).
 *  • Can also be invoked manually for backfill / debugging.
 *
 * Writes use the service-role key so they bypass RLS on exchange_rates.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET           = Deno.env.get('CRON_SECRET') ?? '';   // optional shared secret
const CURRENCIES            = ['USD', 'EUR', 'KES'];
// Pull a 10-day window so weekends / holidays / publishing delays are covered.
const LOOKBACK_DAYS         = 10;

// Echo allowed origin if set. Without ALLOWED_ORIGINS, falls back to '*' for
// dev. With auth via CRON_SECRET below, the wildcard is acceptable but the
// allowlist is safer in production.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);

function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const origin = reqOrigin ?? '';
  const allowed = ALLOWED_ORIGINS.length === 0
    ? '*'
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

/** Format a Date as DD/MM/YYYY (the format the BNR API expects). */
function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

/** Parse BNR's "DD-Mon-YY" post_date into an ISO date (YYYY-MM-DD). */
function parseBnrDate(s: string): string | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const mo = months[m[2].toLowerCase()];
  if (!mo) return null;
  return `20${m[3]}-${mo}-${m[1]}`;
}

interface BnrRate {
  currency_name: string;
  buying_rate:   string;
  average_rate:  string;
  selling_rate:  string;
  post_date:     string;
}

interface UpsertRow {
  currency:     string;
  rate_date:    string;
  buying_rate:  number;
  average_rate: number;
  selling_rate: number;
  source:       string;
}

async function fetchCurrency(currency: string, start: string, end: string): Promise<BnrRate[]> {
  const url =
    `https://fxrates.bnr.rw/currency_history/?currency_name=${encodeURIComponent(currency)}` +
    `&start_date=${start}&end_date=${end}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'imari-portfolio/1.0' } });
  if (!r.ok) throw new Error(`BNR HTTP ${r.status} for ${currency}`);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error(`BNR returned non-array for ${currency}`);
  return data;
}

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req.headers.get('Origin'));
  const reply = (body: unknown, status = 200) => json(body, status, CORS);

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')    return reply({ error: 'method not allowed' }, 405);

  // Optional shared-secret check — when CRON_SECRET is configured, callers
  // (e.g. pg_cron) must send `x-cron-secret`. Prevents anonymous traffic from
  // amplifying load against BNR and triggering free service-role writes.
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return reply({ error: 'forbidden' }, 403);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return reply({ error: 'service not configured (missing env vars)' }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now      = new Date();
  const earlier  = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const startStr = ddmmyyyy(earlier);
  const endStr   = ddmmyyyy(now);

  const upserts: UpsertRow[] = [];
  const errors: Array<{ currency: string; message: string }> = [];

  for (const currency of CURRENCIES) {
    try {
      const rows = await fetchCurrency(currency, startStr, endStr);
      for (const row of rows) {
        const rate_date = parseBnrDate(row.post_date);
        if (!rate_date) continue;
        const buying  = parseFloat(row.buying_rate);
        const average = parseFloat(row.average_rate);
        const selling = parseFloat(row.selling_rate);
        if (!isFinite(buying) || !isFinite(average) || !isFinite(selling)) continue;
        upserts.push({
          currency,
          rate_date,
          buying_rate:  buying,
          average_rate: average,
          selling_rate: selling,
          source:       'bnr',
        });
      }
    } catch (e) {
      errors.push({ currency, message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (upserts.length === 0) {
    return reply({ ok: false, inserted: 0, errors, window: { start: startStr, end: endStr } }, 502);
  }

  const { error } = await supabase
    .from('exchange_rates')
    .upsert(upserts, { onConflict: 'currency,rate_date' });

  if (error) return reply({ ok: false, db_error: error.message, attempted: upserts.length }, 500);

  return reply({
    ok:        true,
    inserted:  upserts.length,
    window:    { start: startStr, end: endStr },
    currencies: CURRENCIES,
    errors,
  });
});
