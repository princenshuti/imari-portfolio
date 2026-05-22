-- Migration 001 — Add liabilities, goals, cashflows, snapshots, reachedMilestones columns
-- Run this in the Supabase SQL Editor for existing projects.
-- (New projects: run supabase-schema.sql instead — it already includes these.)

alter table public.portfolios
  add column if not exists liabilities       jsonb not null default '[]'::jsonb,
  add column if not exists goals             jsonb not null default '[]'::jsonb,
  add column if not exists cashflows         jsonb not null default '[]'::jsonb,
  add column if not exists snapshots         jsonb not null default '[]'::jsonb,
  add column if not exists reachedmilestones jsonb not null default '[]'::jsonb;
