-- Imari Portfolio — Supabase schema
-- Run this once in your Supabase project's SQL Editor.
-- Idempotent: safe to re-run.

-- ───── Tables ─────────────────────────────────────────────────
create table if not exists public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text default 'My Portfolio',
  profile     jsonb not null default '{}'::jsonb,
  assets      jsonb not null default '[]'::jsonb,
  fx          jsonb not null default '{}'::jsonb,
  chat        jsonb not null default '[]'::jsonb,
  insight     jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.portfolio_members (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('owner', 'editor', 'viewer')),
  email         text not null,
  created_at    timestamptz not null default now(),
  unique(portfolio_id, user_id)
);

create table if not exists public.portfolio_invitations (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  email         text not null,
  role          text not null check (role in ('editor', 'viewer')),
  invited_by    uuid not null references auth.users(id) on delete cascade,
  token         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '14 days')
);

create index if not exists idx_portfolio_members_user on public.portfolio_members(user_id);
create index if not exists idx_invitations_email on public.portfolio_invitations(lower(email));
create index if not exists idx_invitations_token on public.portfolio_invitations(token);

-- ───── Functions ──────────────────────────────────────────────

-- Add owner as member automatically when a portfolio is created.
create or replace function public.handle_new_portfolio()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.portfolio_members (portfolio_id, user_id, role, email)
  values (new.id, new.owner_id, 'owner', coalesce((select email from auth.users where id = new.owner_id), ''))
  on conflict (portfolio_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_portfolio_created on public.portfolios;
create trigger on_portfolio_created
  after insert on public.portfolios
  for each row execute function public.handle_new_portfolio();

-- Helper: check if the calling user has at-least the given role for a portfolio.
create or replace function public.user_has_portfolio_access(p_id uuid, required_role text default 'viewer')
returns boolean
language plpgsql security definer stable set search_path = public
as $$
declare
  user_role text;
begin
  select role into user_role from public.portfolio_members
    where portfolio_id = p_id and user_id = auth.uid();
  if user_role is null then return false; end if;
  if required_role = 'viewer' then return true; end if;
  if required_role = 'editor' then return user_role in ('owner', 'editor'); end if;
  if required_role = 'owner'  then return user_role = 'owner'; end if;
  return false;
end;
$$;

-- Accept an invitation by token. Returns the joined portfolio_id.
create or replace function public.accept_invitation(invitation_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  inv         record;
  user_email  text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select email into user_email from auth.users where id = auth.uid();

  select * into inv from public.portfolio_invitations
    where token = invitation_token
      and accepted_at is null
      and expires_at > now()
      and lower(email) = lower(user_email);
  if inv is null then raise exception 'Invalid, expired, or already-accepted invitation'; end if;

  insert into public.portfolio_members (portfolio_id, user_id, role, email)
    values (inv.portfolio_id, auth.uid(), inv.role, user_email)
    on conflict (portfolio_id, user_id) do update set role = excluded.role;

  update public.portfolio_invitations set accepted_at = now() where id = inv.id;
  return inv.portfolio_id;
end;
$$;

-- Allow anon access to invitation metadata by token (so the recipient sees a preview before signup)
create or replace function public.peek_invitation(invitation_token text)
returns table(portfolio_id uuid, email text, role text, expires_at timestamptz, accepted_at timestamptz)
language sql security definer stable set search_path = public
as $$
  select portfolio_id, email, role, expires_at, accepted_at
  from public.portfolio_invitations
  where token = invitation_token;
$$;

grant execute on function public.peek_invitation(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- ───── Row Level Security ─────────────────────────────────────
alter table public.portfolios               enable row level security;
alter table public.portfolio_members        enable row level security;
alter table public.portfolio_invitations    enable row level security;

-- Portfolios policies
drop policy if exists "Members can view portfolios"               on public.portfolios;
drop policy if exists "Editors can update portfolios"             on public.portfolios;
drop policy if exists "Auth users can create their portfolio"     on public.portfolios;
drop policy if exists "Owners can delete portfolios"              on public.portfolios;

create policy "Members can view portfolios"
  on public.portfolios for select
  using (public.user_has_portfolio_access(id, 'viewer'));

create policy "Editors can update portfolios"
  on public.portfolios for update
  using (public.user_has_portfolio_access(id, 'editor'));

create policy "Auth users can create their portfolio"
  on public.portfolios for insert
  with check (auth.uid() = owner_id);

create policy "Owners can delete portfolios"
  on public.portfolios for delete
  using (public.user_has_portfolio_access(id, 'owner'));

-- Members policies
drop policy if exists "Members can view membership" on public.portfolio_members;
drop policy if exists "Owners can manage members"   on public.portfolio_members;

create policy "Members can view membership"
  on public.portfolio_members for select
  using (public.user_has_portfolio_access(portfolio_id, 'viewer'));

create policy "Owners can manage members"
  on public.portfolio_members for all
  using (public.user_has_portfolio_access(portfolio_id, 'owner'))
  with check (public.user_has_portfolio_access(portfolio_id, 'owner'));

-- Invitations policies
drop policy if exists "Owners can view invitations"   on public.portfolio_invitations;
drop policy if exists "Owners can create invitations" on public.portfolio_invitations;
drop policy if exists "Owners can delete invitations" on public.portfolio_invitations;

create policy "Owners can view invitations"
  on public.portfolio_invitations for select
  using (public.user_has_portfolio_access(portfolio_id, 'owner'));

create policy "Owners can create invitations"
  on public.portfolio_invitations for insert
  with check (
    public.user_has_portfolio_access(portfolio_id, 'owner')
    and invited_by = auth.uid()
  );

create policy "Owners can delete invitations"
  on public.portfolio_invitations for delete
  using (public.user_has_portfolio_access(portfolio_id, 'owner'));

-- ───── Realtime: broadcast portfolio changes ──────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'portfolios'
  ) then
    alter publication supabase_realtime add table public.portfolios;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'portfolio_members'
  ) then
    alter publication supabase_realtime add table public.portfolio_members;
  end if;
end $$;
