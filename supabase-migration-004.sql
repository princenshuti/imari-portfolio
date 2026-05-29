-- Migration 004 — chat (B4), WhatsApp (§4), RRA EBM (§6), entitlements (§10).
-- All RLS-keyed on portfolio_members via the existing user_has_portfolio_access().

-- ── B4: in-portfolio member chat ──────────────────────────────────────────
create table if not exists public.portfolio_messages (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid not null references public.portfolios(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 2000),
  created_at     timestamptz not null default now()
);
create index if not exists idx_portfolio_messages on public.portfolio_messages(portfolio_id, created_at);
alter table public.portfolio_messages enable row level security;

drop policy if exists "members read messages" on public.portfolio_messages;
create policy "members read messages" on public.portfolio_messages
  for select using (public.user_has_portfolio_access(portfolio_id, 'viewer'));

drop policy if exists "members post messages" on public.portfolio_messages;
create policy "members post messages" on public.portfolio_messages
  for insert with check (sender_user_id = auth.uid() and public.user_has_portfolio_access(portfolio_id, 'viewer'));

-- Realtime delivery for the chat channel.
alter publication supabase_realtime add table public.portfolio_messages;

-- ── §4: WhatsApp links ────────────────────────────────────────────────────
create table if not exists public.whatsapp_links (
  portfolio_id  uuid primary key references public.portfolios(id) on delete cascade,
  phone_e164    text not null,
  verified_at   timestamptz,
  opt_in_nudges boolean not null default false,
  nudge_window  text not null default '18:00',
  last_nudge_on date
);
alter table public.whatsapp_links enable row level security;
drop policy if exists "owner manages whatsapp" on public.whatsapp_links;
create policy "owner manages whatsapp" on public.whatsapp_links
  for all using (public.user_has_portfolio_access(portfolio_id, 'owner'))
  with check (public.user_has_portfolio_access(portfolio_id, 'owner'));

-- ── §6: RRA EBM TIN link ──────────────────────────────────────────────────
create table if not exists public.rra_link (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  tin          text not null,
  consent_at   timestamptz not null default now(),
  last_sync    timestamptz
);
alter table public.rra_link enable row level security;
drop policy if exists "owner manages rra" on public.rra_link;
create policy "owner manages rra" on public.rra_link
  for all using (public.user_has_portfolio_access(portfolio_id, 'owner'))
  with check (public.user_has_portfolio_access(portfolio_id, 'owner'));

-- ── §10: entitlements (writes are server-side / service-role only) ─────────
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
-- No client INSERT/UPDATE policy: entitlements are set by the billing webhook
-- (service role), never by the browser — so a user can't grant themselves a tier.
