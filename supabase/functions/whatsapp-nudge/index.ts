/**
 * whatsapp-nudge — Supabase Edge Function (§4), invoked on a schedule (cron).
 *
 * For each opted-in, verified WhatsApp link: enforce quiet hours (21:00–07:00
 * Kigali) and max one nudge/day, then send a short daily check-in derived from
 * the portfolio's pinned Cost-of-Absence / daily summary. One source of truth
 * with the in-app card.
 *
 * EXTERNAL SETUP: WhatsApp Business API (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID),
 * SUPABASE_SERVICE_ROLE_KEY, and a scheduled trigger (Supabase cron / pg_cron).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WA_TOKEN    = Deno.env.get('WHATSAPP_TOKEN') ?? '';
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') ?? '';
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } });

// Kigali is UTC+2, no DST.
function kigaliHour(d = new Date()) { return (d.getUTCHours() + 2) % 24; }

async function sendText(to: string, body: string) {
  await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, text: { body } }),
  }).catch(() => {});
}

Deno.serve(async () => {
  const hour = kigaliHour();
  if (hour >= 21 || hour < 7) return new Response('quiet hours', { status: 200 });
  if (!WA_TOKEN || !WA_PHONE_ID) return new Response('not configured', { status: 503 });

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: links } = await admin.from('whatsapp_links')
    .select('portfolio_id, phone_e164, verified_at, opt_in_nudges, last_nudge_on')
    .eq('opt_in_nudges', true);

  let sent = 0;
  for (const link of links ?? []) {
    if (!link.verified_at) continue;
    if (link.last_nudge_on === todayStr) continue; // max one/day

    const { data: row } = await admin.from('portfolios')
      .select('profile, cashflows').eq('id', link.portfolio_id).maybeSingle();
    const name = (row?.profile as { name?: string } | null)?.name ?? 'there';
    const cashflows = Array.isArray(row?.cashflows) ? row!.cashflows : [];
    const today = cashflows
      .filter((c: Record<string, unknown>) => c.type === 'expense' && c.date === todayStr)
      .reduce((s: number, c: Record<string, unknown>) => s + (Number(c.amount) || 0), 0);

    const body = today > 0
      ? `Hi ${name} — today's logged spend: RWF ${today.toLocaleString()}. Reply "why" for detail, or text a new expense.`
      : `Hi ${name} — nothing logged today. Text an expense like "spent 5k lunch" to keep your numbers real. Reply stop to mute.`;
    await sendText(link.phone_e164, body);
    await admin.from('whatsapp_links').update({ last_nudge_on: todayStr }).eq('phone_e164', link.phone_e164);
    sent += 1;
  }
  return new Response(JSON.stringify({ sent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
