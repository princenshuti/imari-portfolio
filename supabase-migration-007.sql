-- Migration 007 — Family module Sprint 2: calendar, household tasks,
-- insurance policies, documents vault and wish list.
--
-- One generic row-level table (family_items) carries the five record kinds;
-- the typed columns (kind, title, due_date, amount, status) are what every
-- screen queries and sorts on, the jsonb `data` holds the kind-specific rest
-- and is capped at 8 KB. Same access rule as migration 006: portfolio
-- membership AND the 'family' entitlement; viewers read, editors write,
-- updated_by is always auth.uid().
--
-- Documents: metadata lives in family_items (kind = 'document'); the file
-- itself goes to the PRIVATE storage bucket family-docs under
-- <portfolio_id>/<item_id>/<filename>, read back only through short-lived
-- signed URLs. Storage policies resolve the portfolio from the first path
-- segment via a safe-cast helper, so a malformed path can never error into
-- an allow.
--
-- Calendar feed: family_calendar_tokens holds one random 256-bit capability
-- token per portfolio for the read-only ICS edge function (family-ics) —
-- calendar apps cannot send auth headers, so the URL is the secret. Editors
-- can create/rotate it; the function reads it with the service role.

-- ── Items ───────────────────────────────────────────────────────────────────
create table if not exists public.family_items (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  kind         text not null check (kind in ('event','task','policy','document','wish')),
  title        text not null check (char_length(title) between 1 and 120),
  due_date     date,
  amount       numeric check (amount is null or (amount >= 0 and amount < 1e15)),
  status       text not null default 'open' check (status in ('open','done','archived')),
  data         jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 8192),
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.family_items enable row level security;

drop policy if exists "family members read items" on public.family_items;
create policy "family members read items" on public.family_items
  for select using (
    public.user_has_portfolio_access(portfolio_id, 'viewer')
    and public.portfolio_has_feature(portfolio_id, 'family')
  );
drop policy if exists "family editors insert items" on public.family_items;
create policy "family editors insert items" on public.family_items
  for insert with check (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
    and updated_by = auth.uid()
  );
drop policy if exists "family editors update items" on public.family_items;
create policy "family editors update items" on public.family_items
  for update using (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
  ) with check (updated_by = auth.uid());
drop policy if exists "family editors delete items" on public.family_items;
create policy "family editors delete items" on public.family_items
  for delete using (public.user_has_portfolio_access(portfolio_id, 'editor'));

drop trigger if exists family_items_touch on public.family_items;
create trigger family_items_touch
  before update on public.family_items
  for each row execute function public.set_updated_at();

create index if not exists family_items_lookup_idx
  on public.family_items (portfolio_id, kind, due_date);

-- ── Calendar feed tokens ────────────────────────────────────────────────────
create table if not exists public.family_calendar_tokens (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  token        text not null unique check (token ~ '^[0-9a-f]{64}$'),
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.family_calendar_tokens enable row level security;
-- Only editors may see or change the secret; viewers get nothing.
drop policy if exists "family editors manage calendar token" on public.family_calendar_tokens;
create policy "family editors manage calendar token" on public.family_calendar_tokens
  for all using (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
  ) with check (
    public.user_has_portfolio_access(portfolio_id, 'editor')
    and public.portfolio_has_feature(portfolio_id, 'family')
  );

-- ── Documents bucket (private) ──────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-docs', 'family-docs', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Safe-cast the first path segment to a portfolio id and check access.
-- Returns false (never raises) for any malformed path.
create or replace function public.family_doc_access(object_name text, required_role text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := ((storage.foldername(object_name))[1])::uuid;
  return public.user_has_portfolio_access(pid, required_role)
     and public.portfolio_has_feature(pid, 'family');
exception when others then
  return false;
end;
$$;

drop policy if exists "family members read docs" on storage.objects;
create policy "family members read docs" on storage.objects
  for select using (bucket_id = 'family-docs' and public.family_doc_access(name, 'viewer'));
drop policy if exists "family editors upload docs" on storage.objects;
create policy "family editors upload docs" on storage.objects
  for insert with check (bucket_id = 'family-docs' and public.family_doc_access(name, 'editor'));
drop policy if exists "family editors delete docs" on storage.objects;
create policy "family editors delete docs" on storage.objects
  for delete using (bucket_id = 'family-docs' and public.family_doc_access(name, 'editor'));
-- No update policy: files are immutable; replace = delete + upload.

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'family_items'
  ) then
    alter publication supabase_realtime add table public.family_items;
  end if;
end $$;
