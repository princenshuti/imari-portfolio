/**
 * family-ics — Supabase Edge Function (deploy with --no-verify-jwt)
 *
 * Read-only iCalendar feed of a household's dates so Google/Apple Calendar
 * can subscribe. Calendar apps cannot send auth headers, so the URL carries a
 * 256-bit capability token (public.family_calendar_tokens, editors create /
 * rotate it in the app). Flow:
 *   GET /family-ics?t=<64 hex>  →  text/calendar
 *
 * Security:
 *   - token must match ^[0-9a-f]{64}$ before any query; unknown → 404 (same
 *     body/timing as a malformed token, no oracle)
 *   - the portfolio must still hold the 'family' entitlement
 *   - service-role client (RLS bypass) reads only the rows for that portfolio
 *   - output is escaped per RFC 5545; no request data is echoed back
 *   - GET/HEAD only, private cache 15 min, tiny per-token rate limit
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const HORIZON_DAYS     = 400;
const PAST_DAYS        = 30;

// Best-effort in-isolate rate limit (per token, 60 req / 5 min).
const hits = new Map<string, { n: number; t: number }>();
function limited(key: string): boolean {
  const now = Date.now(); const h = hits.get(key);
  if (!h || now - h.t > 300_000) { hits.set(key, { n: 1, t: now }); return false; }
  h.n++; return h.n > 60;
}

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

type Row = { id: string; kind: string; title: string; due_date: string | null; status: string; data: Record<string, unknown> | null };
type Ev = { uid: string; date: string; summary: string; desc?: string; rrule?: string };

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const isoToDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const esc = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 250);
const fold = (line: string) => line.match(/.{1,70}/g)!.join('\r\n ');

function nextYearly(iso: string, today: Date): string {
  const d = isoToDate(iso); d.setUTCFullYear(today.getUTCFullYear());
  if (d < today) d.setUTCFullYear(today.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
function nextOccurrence(dateIso: string, recurring: string, today: Date): Date | null {
  const anchor = isoToDate(dateIso); if (Number.isNaN(anchor.getTime())) return null;
  if (!recurring || recurring === 'once') return anchor >= today ? anchor : null;
  const step = recurring === 'quarterly' ? 3 : recurring === 'monthly' ? 1 : 12;
  const day = anchor.getUTCDate(); let y = anchor.getUTCFullYear(), m = anchor.getUTCMonth();
  for (let g = 0; g < 1200; g++) {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const c = new Date(Date.UTC(y, m, Math.min(day, last)));
    if (c >= today) return c;
    m += step; if (m > 11) { y += Math.floor(m / 12); m %= 12; }
  }
  return null;
}
const RRULE: Record<string, string> = { monthly: 'FREQ=MONTHLY', quarterly: 'FREQ=MONTHLY;INTERVAL=3', annually: 'FREQ=YEARLY' };

function inWindow(iso: string, today: Date): boolean {
  const d = (isoToDate(iso).getTime() - today.getTime()) / 86400000;
  return d >= -PAST_DAYS && d <= HORIZON_DAYS;
}

function buildEvents(items: Row[], pf: { goals?: any[]; liabilities?: any[]; cashflows?: any[]; assets?: any[] }, today: Date): Ev[] {
  const out: Ev[] = [];
  const add = (uid: string, date: string | null, summary: string, desc = '', rrule?: string) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (!rrule && !inWindow(date, today)) return;
    out.push({ uid, date, summary, desc, rrule });
  };
  for (const it of items) {
    if (!it.due_date || it.status === 'archived') continue;
    const d = it.data ?? {};
    switch (it.kind) {
      case 'event':    add(`ev-${it.id}`, d.repeat === 'yearly' ? nextYearly(it.due_date, today) : it.due_date, it.title, String(d.notes ?? ''), d.repeat === 'yearly' ? 'FREQ=YEARLY' : undefined); break;
      case 'task':     if (it.status !== 'done') add(`task-${it.id}`, it.due_date, `Task: ${it.title}`, `Owner: ${d.assignee ?? 'me'}`); break;
      case 'policy':   add(`pol-${it.id}`, it.due_date, `Renew insurance: ${it.title}`, String(d.insurer ?? '')); break;
      case 'document': add(`doc-${it.id}`, it.due_date, `Expires: ${it.title}`, String(d.holder ?? '')); break;
      case 'wish':     if (it.status !== 'done') add(`wish-${it.id}`, it.due_date, `Wish target: ${it.title}`); break;
    }
  }
  for (const g of pf.goals ?? []) if (!g.achieved && g.deadline) add(`goal-${g.id}`, g.deadline, `Goal deadline: ${g.title ?? 'Goal'}`);
  for (const l of pf.liabilities ?? []) if (l.endDate) add(`loan-${l.id}`, l.endDate, `Loan ends: ${l.name ?? l.lender ?? 'Loan'}`);
  for (const cf of pf.cashflows ?? []) {
    if (cf.type !== 'expense' || !cf.recurring || cf.recurring === 'once') continue;
    const n = nextOccurrence(cf.date, cf.recurring, today);
    if (n) add(`bill-${cf.id}`, n.toISOString().slice(0, 10), `Bill: ${cf.notes || cf.category || 'expense'}`, `${cf.amount} ${cf.currency ?? 'RWF'} · ${cf.recurring}`, RRULE[cf.recurring]);
  }
  const assets = pf.assets ?? [];
  const y = today.getUTCFullYear();
  if (assets.some((a: any) => String(a.kind).startsWith('realestate'))) add('rra-fat', nextYearly(`${y}-03-31`, today), 'RRA fixed-asset tax declaration due', 'Rwanda Revenue Authority', 'FREQ=YEARLY');
  if (assets.some((a: any) => a.kind === 'vehicle')) add('rra-levy', nextYearly(`${y}-12-31`, today), 'Vehicle road levy due', 'Rwanda Revenue Authority', 'FREQ=YEARLY');
  return out;
}

function toICS(events: Ev[], name: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Imari//Family Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(name)}`), 'X-PUBLISHED-TTL:PT15M', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
  ];
  for (const e of events) {
    const d = isoToDate(e.date); const next = new Date(d.getTime() + 86400000);
    lines.push('BEGIN:VEVENT', fold(`UID:${esc(e.uid)}@imari.family`), `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(next)}`, fold(`SUMMARY:${esc(e.summary)}`));
    if (e.desc) lines.push(fold(`DESCRIPTION:${esc(e.desc)}`));
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[0-9a-f]{64}$/.test(t)) return notFound();
  if (limited(t)) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '300' } });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('Server not configured', { status: 500 });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: tok } = await sb.from('family_calendar_tokens').select('portfolio_id').eq('token', t).maybeSingle();
  if (!tok) return notFound();
  const pid = tok.portfolio_id as string;

  const [{ data: ent }, { data: items }, { data: pf }] = await Promise.all([
    sb.from('entitlements').select('tier,features').eq('portfolio_id', pid).maybeSingle(),
    sb.from('family_items').select('id,kind,title,due_date,status,data').eq('portfolio_id', pid).not('due_date', 'is', null).neq('status', 'archived').limit(2000),
    sb.from('portfolios').select('name,goals,liabilities,cashflows,assets').eq('id', pid).single(),
  ]);
  const entitled = ent && (ent.tier === 'diaspora' || (Array.isArray(ent.features) && ent.features.includes('family')));
  if (!entitled || !pf) return notFound();

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const ics = toICS(buildEvents((items ?? []) as Row[], pf, today), `${pf.name ?? 'Family'} · Imari`);
  return new Response(req.method === 'HEAD' ? null : ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="imari-family.ics"',
      'Cache-Control': 'private, max-age=900',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
});
