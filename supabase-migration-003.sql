-- Imari Portfolio — Migration 003
-- Server-side updated_at trigger (don't trust client clock).
-- Run this once in the Supabase SQL Editor. Idempotent.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_portfolios_updated_at on public.portfolios;
create trigger set_portfolios_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();
