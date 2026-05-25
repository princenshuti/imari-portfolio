-- Imari Portfolio — Migration 002
-- BNR exchange-rate sync
-- Run this once in your Supabase project's SQL Editor. Idempotent.

-- ───── Table ──────────────────────────────────────────────────
create table if not exists public.exchange_rates (
  currency      text        not null,
  rate_date     date        not null,
  buying_rate   numeric(14,4) not null,
  average_rate  numeric(14,4) not null,
  selling_rate  numeric(14,4) not null,
  source        text        not null default 'bnr',
  fetched_at    timestamptz not null default now(),
  primary key (currency, rate_date)
);

create index if not exists idx_exchange_rates_currency_date
  on public.exchange_rates (currency, rate_date desc);

-- ───── RLS ────────────────────────────────────────────────────
-- Any authenticated user can read; only service-role can write.
alter table public.exchange_rates enable row level security;

drop policy if exists "read rates for authenticated" on public.exchange_rates;
create policy "read rates for authenticated"
  on public.exchange_rates for select
  to authenticated
  using (true);

-- (No INSERT/UPDATE/DELETE policies → only service-role bypasses RLS and can write.)

-- ───── Extensions required for scheduled HTTP call ────────────
-- pg_cron : cron-style scheduler
-- pg_net  : async HTTP from Postgres
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ───── Daily schedule ─────────────────────────────────────────
-- Calls the bnr-rates Edge Function every day at 06:15 UTC (08:15 Kigali),
-- giving BNR time to publish that day's rates.
--
-- BEFORE RUNNING: replace the two placeholders below with your project values.
--   <PROJECT_REF>            → e.g. abcd1234 (from your Supabase project URL)
--   <SUPABASE_ANON_KEY>      → your anon key (the function verifies JWT inside)
--
-- If a previous schedule with this name exists, drop it first so the URL stays current.
select cron.unschedule('bnr-rates-daily')
  where exists (select 1 from cron.job where jobname = 'bnr-rates-daily');

select cron.schedule(
  'bnr-rates-daily',
  '15 6 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/bnr-rates',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body    := jsonb_build_object('source', 'cron')
  );
  $$
);

-- ───── Manual test (uncomment to run on demand) ───────────────
-- select net.http_post(
--   url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/bnr-rates',
--   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SUPABASE_ANON_KEY>'),
--   body    := jsonb_build_object('source','manual')
-- );
