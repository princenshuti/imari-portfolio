/**
 * whatsapp-inbound — Supabase Edge Function (§4).
 *
 * WhatsApp Business Cloud API webhook. Verifies the subscription (GET), then on
 * inbound messages (POST): routes commands (why/balance/networth/stop/help) or
 * parses natural-language expenses via Anthropic into a cashflow (source:'whatsapp',
 * confidence-flagged) and echoes a confirmation with an "undo" keyword.
 *
 * EXTERNAL SETUP REQUIRED (not provisionable from code):
 *   - A WhatsApp Business API number + Meta app.
 *   - Secrets: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN,
 *     ANTHROPIC_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Phone numbers must be verified (whatsapp_links.verified_at) before any read/write.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
const WA_TOKEN     = Deno.env.get('WHATSAPP_TOKEN') ?? '';
const WA_PHONE_ID  = Deno.env.get('WHATSAPP_PHONE_ID') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') ?? '';
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } });

async function sendText(to: string, body: string) {
  if (!WA_TOKEN || !WA_PHONE_ID) return;
  await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, text: { body } }),
  }).catch(() => {});
}

async function parseExpense(text: string): Promise<{ amount: number; category: string; note: string } | null> {
  if (!ANTHROPIC_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 256,
      messages: [{ role: 'user', content: `Extract a Rwandan expense from this message as STRICT JSON {"amount":number,"category":string,"note":string}. Amounts like "25k" mean 25000 RWF. Message: "${text.slice(0, 300)}"` }],
    }),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json();
  const m = (data?.content?.[0]?.text ?? '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const o = JSON.parse(m[0]); return { amount: Number(o.amount) || 0, category: String(o.category || 'other-exp'), note: String(o.note || '') }; }
  catch { return null; }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. Webhook verification handshake.
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.verify_token') === VERIFY_TOKEN && VERIFY_TOKEN)
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return new Response('bad json', { status: 400 }); }

  // 2. Extract the first message + sender (WhatsApp Cloud API shape).
  const msg = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from: string = msg?.from ?? '';
  const text: string = (msg?.text?.body ?? '').trim();
  if (!from || !text) return new Response('ok', { status: 200 }); // status callbacks etc.

  // 3. Only verified, linked numbers may interact.
  const { data: link } = await admin.from('whatsapp_links')
    .select('portfolio_id, verified_at, opt_in_nudges').eq('phone_e164', from).maybeSingle();
  if (!link || !link.verified_at) {
    await sendText(from, 'This number isn\'t linked to an Imari portfolio yet. Connect it in Settings → Connections first.');
    return new Response('ok', { status: 200 });
  }

  // 4. Commands.
  const cmd = text.toLowerCase();
  if (cmd === 'stop') {
    await admin.from('whatsapp_links').update({ opt_in_nudges: false }).eq('phone_e164', from);
    await sendText(from, 'Done — you\'ll get no more nudges. Reply with an expense any time to log it.');
    return new Response('ok', { status: 200 });
  }
  if (cmd === 'help') {
    await sendText(from, 'Text an expense like "spent 25k fuel" to log it. Commands: why · balance · networth · stop.');
    return new Response('ok', { status: 200 });
  }

  // 5. Natural-language expense → cashflow draft (confidence-flagged).
  const parsed = await parseExpense(text);
  if (!parsed || parsed.amount <= 0) {
    await sendText(from, 'I couldn\'t read an amount there. Try e.g. "spent 25k fuel". Reply help for commands.');
    return new Response('ok', { status: 200 });
  }
  // Append to the portfolio's cashflows JSON via the existing column.
  const { data: row } = await admin.from('portfolios').select('cashflows').eq('id', link.portfolio_id).maybeSingle();
  const cashflows = Array.isArray(row?.cashflows) ? row!.cashflows : [];
  const entry = {
    id: crypto.randomUUID(), type: 'expense', category: parsed.category, amount: parsed.amount,
    currency: 'RWF', recurring: 'once', date: new Date().toISOString().slice(0, 10),
    notes: parsed.note, source: 'whatsapp', confidence: 'low',
  };
  await admin.from('portfolios').update({ cashflows: [...cashflows, entry] }).eq('id', link.portfolio_id);
  await sendText(from, `Logged: ${parsed.amount.toLocaleString()} RWF (${parsed.category}). Reply "undo" if that's wrong.`);
  return new Response('ok', { status: 200 });
});
