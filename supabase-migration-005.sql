-- Migration 005 — categorisation rules (F5) + budget envelopes (F6).
-- Follows migration-001's pattern: new top-level state keys get their own
-- jsonb columns so cloud sync round-trips them. The client degrades
-- gracefully (saves without these keys, warns in console) until this runs.

alter table public.portfolios
  add column if not exists catrules jsonb not null default '[]'::jsonb,
  add column if not exists budgets  jsonb not null default '{}'::jsonb;
