/**
 * ai-proxy — Supabase Edge Function
 *
 * Proxies all Anthropic API calls so the key NEVER reaches the browser.
 * The key is stored as a Supabase secret: `supabase secrets set ANTHROPIC_KEY=sk-ant-…`
 *
 * Security enforced here (server-side, not bypassable):
 *  • JWT authentication — only authenticated Imari users can call this
 *  • Model allowlist — prevents escalation to expensive models
 *  • Input length caps — prevents prompt-stuffing abuse
 *  • max_tokens hard cap — limits cost per request
 *  • Message sanitization — only user/assistant roles accepted
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ────────────────────────────────────────────────────────────────
const ANTHROPIC_KEY   = Deno.env.get('ANTHROPIC_KEY') ?? '';
const ALLOWED_MODELS  = new Set(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6']);
const MAX_Q_LEN       = 2000;   // max user question characters
const MAX_SYS_LEN     = 8000;   // max system prompt characters
const MAX_TOKENS      = 1024;   // max output tokens per response
const MAX_MSG_LEN     = 4000;   // max characters per history message
const MAX_MSGS        = 10;     // max history messages sent to Anthropic

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Pre-flight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  // ── 1. Authenticate via Supabase JWT ─────────────────────────────────────
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')      ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { userQuestion, systemPrompt, messages, model = 'claude-haiku-4-5-20251001' } =
    body as {
      userQuestion?: unknown;
      systemPrompt?: unknown;
      messages?: unknown;
      model?: unknown;
    };

  // ── 3. Validate & sanitize ────────────────────────────────────────────────
  if (typeof userQuestion !== 'string' || !userQuestion.trim())
    return json({ error: 'userQuestion is required' }, 400);
  if (userQuestion.length > MAX_Q_LEN)
    return json({ error: `Question too long (max ${MAX_Q_LEN} chars)` }, 400);
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model))
    return json({ error: 'Model not permitted' }, 400);

  const safeSystem = typeof systemPrompt === 'string'
    ? systemPrompt.slice(0, MAX_SYS_LEN)
    : null;

  // Accept only well-formed user/assistant turns, drop anything else
  const safeMessages: Array<{ role: string; content: string }> = [];
  if (Array.isArray(messages)) {
    for (const m of (messages as unknown[]).slice(-MAX_MSGS)) {
      const msg = m as Record<string, unknown>;
      if (
        msg &&
        typeof msg.role    === 'string' &&
        typeof msg.content === 'string' &&
        ['user', 'assistant'].includes(msg.role) &&
        msg.content.length <= MAX_MSG_LEN
      ) {
        safeMessages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  // ── 4. Guard: key must be set ─────────────────────────────────────────────
  if (!ANTHROPIC_KEY) return json({ error: 'AI service not configured on server' }, 503);

  // ── 5. Call Anthropic ─────────────────────────────────────────────────────
  const reqBody: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    messages: [...safeMessages, { role: 'user', content: userQuestion }],
  };
  if (safeSystem) reqBody.system = safeSystem;

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          ANTHROPIC_KEY,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    console.error('Anthropic fetch failed:', e);
    return json({ error: 'AI service unreachable' }, 502);
  }

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.json().catch(() => ({}));
    console.error('Anthropic error:', anthropicRes.status, errBody);
    return json({ error: 'AI service error — try again' }, 502);
  }

  const data = await anthropicRes.json() as { content: Array<{ text: string }> };
  const text = data?.content?.[0]?.text ?? '';

  return json({ text });
});
