// useFamily — one hook that owns the Family module's remote state for a view:
// loads logs + notes once, applies realtime rows from the other member, and
// exposes optimistic writers that roll back on error.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHabitLogs, fetchNotes, setHabit, setNote, subscribeFamily } from './cloud.js';
import { HABIT_IDS } from './habits.js';

export function useFamily(portfolioId, role) {
  const [logs, setLogs]   = useState(null);   // Map<week, Set<habitId>> — null while loading
  const [notes, setNotes] = useState({});     // { [key]: body }
  const [error, setError] = useState(null);
  const canEdit = role !== 'viewer';
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const [l, n] = await Promise.all([fetchHabitLogs(portfolioId), fetchNotes(portfolioId)]);
      if (!alive.current) return;
      setLogs(l); setNotes(n); setError(null);
    } catch (e) {
      if (alive.current) setError(e.message || 'Could not load family data');
    }
  }, [portfolioId]);

  useEffect(() => {
    alive.current = true;
    setLogs(null);
    reload();
    const off = subscribeFamily(portfolioId, (kind, p) => {
      const row = p.new && Object.keys(p.new).length ? p.new : null;
      if (kind === 'habit') {
        if (!row || !HABIT_IDS.has(row.habit_id)) return;
        setLogs(prev => {
          const next = new Map(prev || []);
          const set = new Set(next.get(row.week_start) || []);
          row.done ? set.add(row.habit_id) : set.delete(row.habit_id);
          next.set(row.week_start, set);
          return next;
        });
      } else if (kind === 'note') {
        const key = row?.key ?? p.old?.key;
        if (!key) return;
        setNotes(prev => {
          const next = { ...prev };
          if (row && p.eventType !== 'DELETE') next[key] = row.body; else delete next[key];
          return next;
        });
      }
    });
    return () => { alive.current = false; off(); };
  }, [portfolioId, reload]);

  const toggleHabit = useCallback(async (week, habitId, done) => {
    if (!canEdit) return;
    setLogs(prev => {
      const next = new Map(prev || []);
      const set = new Set(next.get(week) || []);
      done ? set.add(habitId) : set.delete(habitId);
      next.set(week, set);
      return next;
    });
    try { await setHabit(portfolioId, week, habitId, done); }
    catch (e) { setError(e.message); reload(); }
  }, [portfolioId, canEdit, reload]);

  const saveNote = useCallback(async (key, body) => {
    if (!canEdit) return;
    setNotes(prev => ({ ...prev, [key]: body }));
    try { await setNote(portfolioId, key, body); }
    catch (e) { setError(e.message); reload(); }
  }, [portfolioId, canEdit, reload]);

  return { logs, notes, error, canEdit, reload, toggleHabit, saveNote };
}

/** Debounced note editor state: keeps typing local, saves 700ms after the last key. */
export function useDebouncedNote(value, onSave, delay = 700) {
  const [draft, setDraft] = useState(value ?? '');
  const timer = useRef(null);
  const dirty = useRef(false);
  useEffect(() => { if (!dirty.current) setDraft(value ?? ''); }, [value]);
  const update = useCallback((v) => {
    dirty.current = true;
    setDraft(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { dirty.current = false; onSave(v); }, delay);
  }, [onSave, delay]);
  const flush = useCallback(() => {
    if (!dirty.current) return;
    clearTimeout(timer.current);
    dirty.current = false;
    onSave(draft);
  }, [draft, onSave]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [draft, update, flush];
}
