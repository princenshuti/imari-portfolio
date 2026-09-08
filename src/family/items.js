// family/items.js — Supabase access for Sprint 2 (migration 007): generic
// family_items CRUD, the private documents bucket, and the calendar-feed
// token. Every query is scoped by portfolio_id; RLS is the real boundary.
import { supabase } from '../supabase.js';
import { KIND_IDS, normalizeItem } from './planning.js';

const BUCKET = 'family-docs';
const need = (portfolioId) => {
  if (!supabase) throw new Error('Cloud sync is not configured');
  if (!portfolioId) throw new Error('No portfolio');
};
const throwIf = ({ error }) => { if (error) throw error; };
const isUuid = v => /^[0-9a-f-]{36}$/i.test(String(v));

export async function fetchItems(portfolioId) {
  need(portfolioId);
  const { data, error } = await supabase
    .from('family_items')
    .select('id,kind,title,due_date,amount,status,data,updated_at')
    .eq('portfolio_id', portfolioId)
    .in('kind', KIND_IDS)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(2000);
  if (error) throw error;
  return data || [];
}

/** Validate + upsert one item (form values or row). Returns the saved row. */
export async function saveItem(portfolioId, form) {
  need(portfolioId);
  const row = normalizeItem(form);
  const id = row.id && isUuid(row.id) ? row.id : crypto.randomUUID();
  const { data, error } = await supabase
    .from('family_items')
    .upsert({ ...row, id, portfolio_id: portfolioId }, { onConflict: 'id' })
    .select('id,kind,title,due_date,amount,status,data,updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function setItemStatus(portfolioId, id, status) {
  need(portfolioId);
  if (!isUuid(id) || !['open', 'done', 'archived'].includes(status)) throw new Error('Invalid update');
  throwIf(await supabase.from('family_items').update({ status }).eq('portfolio_id', portfolioId).eq('id', id));
}

export async function deleteItem(portfolioId, item) {
  need(portfolioId);
  if (!isUuid(item.id)) throw new Error('Invalid id');
  if (item.data?.file?.path) await removeDocFile(item.data.file.path).catch(() => {}); // metadata wins; orphan files are harmless
  throwIf(await supabase.from('family_items').delete().eq('portfolio_id', portfolioId).eq('id', item.id));
}

// ── Documents (private bucket, signed URLs) ─────────────────────────────────
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOC_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/** Upload a file for an existing document item; returns the file descriptor to store in data.file. */
export async function uploadDocFile(portfolioId, itemId, file) {
  need(portfolioId);
  if (!isUuid(itemId)) throw new Error('Save the document first');
  if (!DOC_MIME.has(file.type)) throw new Error('Only PDF, JPG, PNG or WebP files are accepted');
  if (file.size > DOC_MAX_BYTES) throw new Error('File too large (max 10 MB)');
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'file';
  const path = `${portfolioId}/${itemId}/${Date.now()}-${safeName}`;
  throwIf(await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' }));
  return { path, name: file.name.slice(0, 120), size: file.size, mime: file.type };
}

/** Short-lived (60 s) URL to open a stored file. */
export async function docFileUrl(path) {
  if (!supabase) throw new Error('Cloud sync is not configured');
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeDocFile(path) {
  if (!supabase) return;
  throwIf(await supabase.storage.from(BUCKET).remove([path]));
}

// ── Calendar feed token ─────────────────────────────────────────────────────
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function getCalendarToken(portfolioId) {
  need(portfolioId);
  const { data, error } = await supabase.from('family_calendar_tokens').select('token').eq('portfolio_id', portfolioId).maybeSingle();
  if (error) throw error;
  return data?.token || null;
}

/** Create the feed token, or replace it (old URL stops working immediately). */
export async function rotateCalendarToken(portfolioId) {
  need(portfolioId);
  const token = randomToken();
  throwIf(await supabase.from('family_calendar_tokens').upsert({ portfolio_id: portfolioId, token }, { onConflict: 'portfolio_id' }));
  return token;
}

export async function deleteCalendarToken(portfolioId) {
  need(portfolioId);
  throwIf(await supabase.from('family_calendar_tokens').delete().eq('portfolio_id', portfolioId));
}

export function calendarFeedUrl(token) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return base && token ? `${base}/functions/v1/family-ics?t=${token}` : '';
}

export function subscribeItems(portfolioId, onChange) {
  if (!supabase || !portfolioId) return () => {};
  const channel = supabase.channel(`family-items:${portfolioId}:${Math.random().toString(36).slice(2, 10)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'family_items', filter: `portfolio_id=eq.${portfolioId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
