-- Migration 006 — Family module (Sprint 1): weekly habit scorecard + shared
-- family notes/milestones, shared by every member of a portfolio.
--
-- Design notes
--   * Family data lives in its OWN row-level tables, never inside
--     portfolios.* jsonb: the portfolio row is saved compare-and-swap on
--     updated_at, so two spouses ticking habits the same evening would
--     clobber each other. One row per (week, habit) makes edits commute.
--   * Access = portfolio membership (viewer reads, editor/owner writes) AND
--     the portfolio must hold the 'family' entitlement feature. Entitlements
--     are service-role only (migration 004), so a user cannot self-enable.
--   * updated_by is auth.uid() on every write (default + with check) — the client
--     can't attribute a change to someone else.
--   * Bounded text: habit ids ≤ 40 chars, note keys are slugs, bodies ≤ 4000.

-- ── Prerequisites (idempotent) ──────────────────────────────────────────────
-- Production was found at 2026-09-08 to have migration 005's columns but not
-- migration 003's trigger function nor migration 004's entitlements table, so
-- both are (re)declared here. Safe to run on a database that already has them.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.entitlements (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  tier         text not null default 'free' check (tier in ('free', 'diaspora')),
  features     jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists "members read entitlements" on public.entitlements;
create policy "members read entitlements" on public.entitlements
  for select using (public.user_has_portfolio_access(portfolio_id, 'viewer'));
-- No client INSERT/UPDATE policy: entitlements are set server-side only.

-- ── Feature helper ──────────────────────────────────────────────────────────
create or replace function public.portfolio_has_feature(p_id uuid, feature text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.portfolio_id = p_id
      and (e.tier = 'diaspora' or e.features ? feature)
  );
$$;

-- ── Weekly habit logs ───────────────────────────────────────────────────────
create table if not exists public.family_habit_logs (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  week_start   date not null,
  habit_id     text not null check (habit_id ~ '^[a-z0-9_-]{1,40}$'),
  done         boolean not null default false,
  updated_by   uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (portfolio_id, week_start, habit_id)
);
alter table public.family_habit_logs enable row level security;

drop policy if exists "family members read habit logs" on public.family_habit_logs;
create policy "family members read habit logs" on public.family_habit_logs
  for select using (
    public.user_has_portfolio_access(portfolio_id, 'viewer')
    and public.portfolio_has_feature(portfolio_id, 'family')
  );

drop policy if exists "family editors write habit logs" on public.family_habit_logs;
create policy "family editors write habit logs" on public.family_habit_logs
  for insert with check (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
    and updated_by = auth.uid()
  );

drop policy if exists "family editors update habit logs" on public.family_habit_logs;
create policy "family editors update habit logs" on public.family_habit_logs
  for update using (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
  ) with check (updated_by = auth.uid());

drop policy if exists "family editors delete habit logs" on public.family_habit_logs;
create policy "family editors delete habit logs" on public.family_habit_logs
  for delete using (public.user_has_portfolio_access(portfolio_id, 'editor'));

drop trigger if exists family_habit_logs_touch on public.family_habit_logs;
create trigger family_habit_logs_touch
  before update on public.family_habit_logs
  for each row execute function public.set_updated_at();

create index if not exists family_habit_logs_week_idx
  on public.family_habit_logs (portfolio_id, week_start);

-- ── Shared notes (planning fields, weekly reflections, milestone done-dates) ─
-- key conventions (client-side, src/family/habits.js):
--   plan:<field>        shared planning textareas
--   week:<YYYY-MM-DD>   weekly reflection
--   milestone:<id>      body = ISO date the milestone was reached
create table if not exists public.family_notes (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9_:-]{1,60}$'),
  body         text not null default '' check (char_length(body) <= 4000),
  updated_by   uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (portfolio_id, key)
);
alter table public.family_notes enable row level security;

drop policy if exists "family members read notes" on public.family_notes;
create policy "family members read notes" on public.family_notes
  for select using (
    public.user_has_portfolio_access(portfolio_id, 'viewer')
    and public.portfolio_has_feature(portfolio_id, 'family')
  );

drop policy if exists "family editors write notes" on public.family_notes;
create policy "family editors write notes" on public.family_notes
  for insert with check (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
    and updated_by = auth.uid()
  );

drop policy if exists "family editors update notes" on public.family_notes;
create policy "family editors update notes" on public.family_notes
  for update using (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
  ) with check (updated_by = auth.uid());

drop policy if exists "family editors delete notes" on public.family_notes;
create policy "family editors delete notes" on public.family_notes
  for delete using (public.user_has_portfolio_access(portfolio_id, 'editor'));

drop trigger if exists family_notes_touch on public.family_notes;
create trigger family_notes_touch
  before update on public.family_notes
  for each row execute function public.set_updated_at();

-- ── Realtime: both spouses see each other's ticks live ──────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'family_habit_logs'
  ) then
    alter publication supabase_realtime add table public.family_habit_logs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'family_notes'
  ) then
    alter publication supabase_realtime add table public.family_notes;
  end if;
end $$;

-- ── Enabling the module for one household (run as service role / SQL editor)
-- Replace the email with the portfolio owner's login. Idempotent.
--
--   insert into public.entitlements (portfolio_id, features)
--   select p.id, '["family"]'::jsonb
--   from public.portfolios p
--   join auth.users u on u.id = p.owner_id
--   where u.email = 'owner@example.com'
--   on conflict (portfolio_id) do update
--     set features = (
--       select jsonb_agg(distinct f) from jsonb_array_elements(
--         public.entitlements.features || '["family"]'::jsonb) f
--     ),
--     updated_at = now();
