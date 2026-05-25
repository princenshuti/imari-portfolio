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

// ── In-memory per-user rate limit ────────────────────────────────────────────
// Bound spend: a malicious authenticated user can otherwise hammer the proxy
// (the 3 s client throttle is trivially bypassed). In-memory is per-instance
// so distributed; a Supabase table would be stricter but adds latency.
const RATE_WINDOW_MS  = 60_000;  // 1-minute sliding window
const RATE_MAX_REQS   = 12;      // ≤ 12 requests / minute / user
const userBuckets: Map<string, number[]> = new Map();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const arr = (userBuckets.get(userId) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX_REQS) return false;
  arr.push(now);
  userBuckets.set(userId, arr);
  // Opportunistic eviction so the map doesn't leak
  if (userBuckets.size > 5000) {
    for (const [k, v] of userBuckets) {
      if (!v.some(t => now - t < RATE_WINDOW_MS)) userBuckets.delete(k);
    }
  }
  return true;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
// Echo the request origin if it matches the allowed list. Falls back to '*'
// only when ALLOWED_ORIGINS is unset (dev convenience). Auth still required.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);

function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const origin = reqOrigin ?? '';
  const allowed = ALLOWED_ORIGINS.length === 0
    ? '*'
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req.headers.get('Origin'));
  const reply = (body: unknown, status = 200) => json(body, status, CORS);

  // Pre-flight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return reply({ error: 'Method not allowed' }, 405);

  // ── 1. Authenticate via Supabase JWT ─────────────────────────────────────
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return reply({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')      ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return reply({ error: 'Unauthorized' }, 401);

  // ── 1b. Per-user rate limit (defence vs. AI bill bomb) ────────────────────
  if (!checkRateLimit(user.id)) {
    return reply({ error: 'Rate limit exceeded. Please wait a minute before sending another request.' }, 429);
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply({ error: 'Invalid JSON body' }, 400); }

  const { userQuestion, systemPrompt, messages, model = 'claude-haiku-4-5-20251001' } =
    body as {
      userQuestion?: unknown;
      systemPrompt?: unknown;
      messages?: unknown;
      model?: unknown;
    };

  // ── 3. Validate & sanitize ────────────────────────────────────────────────
  if (typeof userQuestion !== 'string' || !userQuestion.trim())
    return reply({ error: 'userQuestion is required' }, 400);
  if (userQuestion.length > MAX_Q_LEN)
    return reply({ error: `Question too long (max ${MAX_Q_LEN} chars)` }, 400);
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model))
    return reply({ error: 'Model not permitted' }, 400);

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
  if (!ANTHROPIC_KEY) return reply({ error: 'AI service not configured on server' }, 503);

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
    return reply({ error: 'AI service unreachable' }, 502);
  }

  if (!anthropicRes.ok) {
    // Log full upstream detail server-side; return a generic message + correlation
    // id to the client so we don't leak account/org/model availability hints.
    const errBody = await anthropicRes.json().catch(() => ({} as Record<string, unknown>));
    const correlation = crypto.randomUUID();
    console.error(`[${correlation}] Anthropic error:`, anthropicRes.status, errBody);
    const status = anthropicRes.status === 429 ? 429 : 502;
    return reply({
      error: status === 429
        ? 'AI service is busy. Please try again in a moment.'
        : 'AI service error. Please try again.',
      requestId: correlation,
    }, status);
  }

  const data = await anthropicRes.json() as { content: Array<{ text: string }> };
  const text = data?.content?.[0]?.text ?? '';

  return reply({ text });
});
