// family/cloud.js — Supabase access for the Family module (migration 006).
// Every query is scoped by portfolio_id; RLS (membership + 'family'
// entitlement) is the real boundary — these filters only keep payloads small.
// Writes are row-level upserts so two members editing the same week commute.
import { supabase } from '../supabase.js';
import { HABIT_IDS, MAX_NOTE, cleanText, isISODate } from './habits.js';

const need = (portfolioId) => {
  if (!supabase) throw new Error('Cloud sync is not configured');
  if (!portfolioId) throw new Error('No portfolio');
};
const throwIf = ({ error }) => { if (error) throw error; };

/** All habit logs for a portfolio → Map<weekKey, Set<habitId>>. ≤ 33 rows/week. */
export async function fetchHabitLogs(portfolioId) {
  need(portfolioId);
  const { data, error } = await supabase
    .from('family_habit_logs')
    .select('week_start,habit_id,done')
    .eq('portfolio_id', portfolioId)
    .eq('done', true)
    .limit(20000);
  if (error) throw error;
  return rowsToLogs(data || []);
}

export function rowsToLogs(rows) {
  const logs = new Map();
  for (const r of rows) {
    if (!r.done || !HABIT_IDS.has(r.habit_id)) continue;
    if (!logs.has(r.week_start)) logs.set(r.week_start, new Set());
    logs.get(r.week_start).add(r.habit_id);
  }
  return logs;
}

export async function setHabit(portfolioId, weekStart, habitId, done) {
  need(portfolioId);
  if (!isISODate(weekStart) || !HABIT_IDS.has(habitId)) throw new Error('Invalid habit');
  throwIf(await supabase
    .from('family_habit_logs')
    .upsert({ portfolio_id: portfolioId, week_start: weekStart, habit_id: habitId, done: !!done },
            { onConflict: 'portfolio_id,week_start,habit_id' }));
}

/** Notes → { [key]: body }. Optional prefix filter ('plan:', 'milestone:', 'week:'). */
export async function fetchNotes(portfolioId, prefix = '') {
  need(portfolioId);
  let q = supabase.from('family_notes').select('key,body').eq('portfolio_id', portfolioId).limit(2000);
  if (prefix) q = q.like('key', `${prefix}%`);
  const { data, error } = await q;
  if (error) throw error;
  return Object.fromEntries((data || []).map(n => [n.key, n.body]));
}

export async function setNote(portfolioId, key, body) {
  need(portfolioId);
  if (!/^[a-z0-9_:-]{1,60}$/.test(key)) throw new Error('Invalid note key');
  const clean = cleanText(body, MAX_NOTE);
  if (!clean) {
    throwIf(await supabase.from('family_notes').delete().eq('portfolio_id', portfolioId).eq('key', key));
    return;
  }
  throwIf(await supabase
    .from('family_notes')
    .upsert({ portfolio_id: portfolioId, key, body: clean }, { onConflict: 'portfolio_id,key' }));
}

/** Bulk import (legacy dashboard). Chunked so a 200-week export stays well under request limits. */
export async function importLegacy(portfolioId, { logs, notes }) {
  need(portfolioId);
  const CHUNK = 500;
  for (let i = 0; i < logs.length; i += CHUNK) {
    throwIf(await supabase.from('family_habit_logs')
      .upsert(logs.slice(i, i + CHUNK).map(l => ({ ...l, portfolio_id: portfolioId })),
              { onConflict: 'portfolio_id,week_start,habit_id' }));
  }
  for (let i = 0; i < notes.length; i += CHUNK) {
    throwIf(await supabase.from('family_notes')
      .upsert(notes.slice(i, i + CHUNK).map(n => ({ ...n, portfolio_id: portfolioId })),
              { onConflict: 'portfolio_id,key' }));
  }
  return { logs: logs.length, notes: notes.length };
}

/** Live updates from the other member. Returns an unsubscribe fn. */
export function subscribeFamily(portfolioId, onChange) {
  if (!supabase || !portfolioId) return () => {};
  const filter = `portfolio_id=eq.${portfolioId}`;
  const channel = supabase.channel(`family:${portfolioId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'family_habit_logs', filter }, p => onChange('habit', p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'family_notes', filter }, p => onChange('note', p))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
