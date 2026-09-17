-- Migration 008 — server-side input guards (defence in depth).
-- The client sanitises, but the database is the boundary an attacker with a
-- valid session talks to directly. These checks bound what one portfolio can
-- store and validate invitation e-mails, without touching normal use:
--   * per-column size caps on the portfolio document (photos/attachments are
--     base64 data URIs, so assets/cashflows get generous limits)
--   * portfolio name ≤ 120 chars
--   * invitation e-mail must look like an e-mail and be ≤ 254 chars

create or replace function public.portfolio_size_guard()
returns trigger
language plpgsql
as $$
begin
  if pg_column_size(new.assets)      > 12 * 1024 * 1024 then raise exception 'assets too large (max 12 MB)';      end if;
  if pg_column_size(new.cashflows)   >  6 * 1024 * 1024 then raise exception 'cashflows too large (max 6 MB)';    end if;
  if pg_column_size(new.profile)     >  2 * 1024 * 1024 then raise exception 'profile too large (max 2 MB)';      end if;
  if pg_column_size(new.liabilities) >  1 * 1024 * 1024 then raise exception 'liabilities too large (max 1 MB)';  end if;
  if pg_column_size(new.goals)       >  1 * 1024 * 1024 then raise exception 'goals too large (max 1 MB)';        end if;
  if pg_column_size(new.snapshots)   >  2 * 1024 * 1024 then raise exception 'snapshots too large (max 2 MB)';    end if;
  if pg_column_size(new.chat)        >  1 * 1024 * 1024 then raise exception 'chat too large (max 1 MB)';         end if;
  if pg_column_size(new.catrules)    >  256 * 1024     then raise exception 'rules too large (max 256 KB)';       end if;
  if pg_column_size(new.budgets)     >  64 * 1024      then raise exception 'budgets too large (max 64 KB)';      end if;
  if new.name is not null and char_length(new.name) > 120 then raise exception 'portfolio name too long (max 120)'; end if;
  return new;
end;
$$;

drop trigger if exists portfolios_size_guard on public.portfolios;
create trigger portfolios_size_guard
  before insert or update on public.portfolios
  for each row execute function public.portfolio_size_guard();

alter table public.portfolio_invitations
  drop constraint if exists portfolio_invitations_email_check;
alter table public.portfolio_invitations
  add constraint portfolio_invitations_email_check
  check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
