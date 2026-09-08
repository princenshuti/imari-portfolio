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
const MAX_TOOL_INPUT  = 4000;   // max JSON characters per tool_use input / tool_result content

// ── Tool definitions (server-owned; the browser can only pick a toolset) ──────
// Every tool maps to a form the user already has. The client executes them
// through the same RLS-scoped functions, so the model gains no new authority.
const FAMILY_TOOLS = [
  {
    name: 'family_add_item',
    description: 'Add one family record: a calendar event, a household task, an insurance policy, a document entry or a wish. Use the exact field names; dates are YYYY-MM-DD.',
    input_schema: { type: 'object', required: ['kind', 'title'], properties: {
      kind: { type: 'string', enum: ['event', 'task', 'policy', 'document', 'wish'] },
      title: { type: 'string', maxLength: 120 },
      due_date: { type: 'string', description: 'YYYY-MM-DD: event date, task due, renewal, expiry or wish target' },
      amount: { type: 'number', description: 'RWF: premium (policy) or estimated cost (wish)' },
      notes: { type: 'string', maxLength: 1000 },
      repeat: { type: 'string', enum: ['none', 'yearly', 'weekly', 'monthly'] },
      assignee: { type: 'string', enum: ['me', 'partner', 'help', 'other'] },
      priority: { type: 'string', enum: ['must', 'should', 'nice'] },
      for: { type: 'string', enum: ['family', 'me', 'partner', 'child', 'home'] },
      type: { type: 'string', description: 'policy: health|motor|home|life|other · document: id|passport|title|contract|school|medical|vehicle|other' },
      insurer: { type: 'string', maxLength: 80 }, frequency: { type: 'string', enum: ['monthly', 'quarterly', 'annually'] },
      cover: { type: 'number' }, holder: { type: 'string', maxLength: 60 },
    } },
  },
  {
    name: 'family_tick_habits',
    description: 'Tick (or untick) weekly scorecard habits by id for a week. Only when the user says they did (or did not do) something this week.',
    input_schema: { type: 'object', required: ['habit_ids'], properties: {
      habit_ids: { type: 'array', items: { type: 'string' }, maxItems: 33 },
      week: { type: 'string', description: 'Any date in the week, YYYY-MM-DD; defaults to the current week' },
      done: { type: 'boolean', default: true },
    } },
  },
  {
    name: 'family_update_plan',
    description: 'Replace the text of one shared planning field. Read the current text from FAMILY_DATA first and preserve what the user did not ask to change.',
    input_schema: { type: 'object', required: ['field', 'body'], properties: {
      field: { type: 'string', enum: ['shared_goals', 'partner_goals', 'mutual_support', 'meeting_notes', 'month_review'] },
      body: { type: 'string', maxLength: 4000 },
    } },
  },
];
const TOOLSETS: Record<string, typeof FAMILY_TOOLS> = { family: FAMILY_TOOLS };
const TOOL_NAMES = new Set(FAMILY_TOOLS.map(t => t.name));

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

  const { userQuestion, systemPrompt, messages, model = 'claude-haiku-4-5-20251001', image, toolset, toolResults } =
    body as {
      userQuestion?: unknown;
      systemPrompt?: unknown;
      messages?: unknown;
      model?: unknown;
      image?: unknown;
      toolset?: unknown;
      toolResults?: unknown;
    };

  // ── 3. Validate & sanitize ────────────────────────────────────────────────
  // A turn is either a user question OR the results of tool calls the model
  // requested on the previous turn (continuation) — never both.
  const tools = typeof toolset === 'string' ? TOOLSETS[toolset] : undefined;
  if (typeof toolset === 'string' && !tools) return reply({ error: 'Unknown toolset' }, 400);
  const safeToolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }> = [];
  if (Array.isArray(toolResults)) {
    if (!tools) return reply({ error: 'toolResults require a toolset' }, 400);
    for (const r of (toolResults as unknown[]).slice(0, 8)) {
      const tr = r as Record<string, unknown>;
      if (tr && typeof tr.tool_use_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(tr.tool_use_id) && typeof tr.content === 'string')
        safeToolResults.push({ type: 'tool_result', tool_use_id: tr.tool_use_id, content: tr.content.slice(0, MAX_TOOL_INPUT), ...(tr.is_error ? { is_error: true } : {}) });
    }
    if (!safeToolResults.length) return reply({ error: 'toolResults is empty' }, 400);
  } else {
    if (typeof userQuestion !== 'string' || !userQuestion.trim())
      return reply({ error: 'userQuestion is required' }, 400);
    if (userQuestion.length > MAX_Q_LEN)
      return reply({ error: `Question too long (max ${MAX_Q_LEN} chars)` }, 400);
  }
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model))
    return reply({ error: 'Model not permitted' }, 400);

  const safeSystem = typeof systemPrompt === 'string'
    ? systemPrompt.slice(0, MAX_SYS_LEN)
    : null;

  // Accept only well-formed user/assistant turns, drop anything else.
  // Content is a string, or (tool flows only) an array of text / tool_use /
  // tool_result blocks whose names are ours and whose sizes are capped.
  const sanitizeBlocks = (arr: unknown[]): unknown[] | null => {
    const out: unknown[] = [];
    for (const b of arr.slice(0, 8)) {
      const blk = b as Record<string, unknown>;
      if (!blk || typeof blk.type !== 'string') return null;
      if (blk.type === 'text' && typeof blk.text === 'string') out.push({ type: 'text', text: blk.text.slice(0, MAX_MSG_LEN) });
      else if (blk.type === 'tool_use' && tools && typeof blk.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(blk.id)
               && typeof blk.name === 'string' && TOOL_NAMES.has(blk.name) && blk.input && typeof blk.input === 'object'
               && JSON.stringify(blk.input).length <= MAX_TOOL_INPUT) out.push({ type: 'tool_use', id: blk.id, name: blk.name, input: blk.input });
      else if (blk.type === 'tool_result' && tools && typeof blk.tool_use_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(blk.tool_use_id) && typeof blk.content === 'string')
        out.push({ type: 'tool_result', tool_use_id: blk.tool_use_id, content: blk.content.slice(0, MAX_TOOL_INPUT) });
      else return null;
    }
    return out.length ? out : null;
  };
  const safeMessages: Array<{ role: string; content: unknown }> = [];
  if (Array.isArray(messages)) {
    for (const m of (messages as unknown[]).slice(-MAX_MSGS)) {
      const msg = m as Record<string, unknown>;
      if (!msg || typeof msg.role !== 'string' || !['user', 'assistant'].includes(msg.role)) continue;
      if (typeof msg.content === 'string' && msg.content.length <= MAX_MSG_LEN) safeMessages.push({ role: msg.role, content: msg.content });
      else if (Array.isArray(msg.content)) { const blocks = sanitizeBlocks(msg.content); if (blocks) safeMessages.push({ role: msg.role, content: blocks }); }
    }
  }

  // ── 4. Guard: key must be set ─────────────────────────────────────────────
  if (!ANTHROPIC_KEY) return reply({ error: 'AI service not configured on server' }, 503);

  // ── 4b. Optional vision input (§8/B13 — receipt / statement OCR) ──────────
  let userContent: unknown = safeToolResults.length ? safeToolResults : userQuestion;
  if (image && typeof image === 'object' && !safeToolResults.length) {
    const img = image as { data?: unknown; mediaType?: unknown };
    if (typeof img.data === 'string' && typeof img.mediaType === 'string') {
      if (img.data.length > 7_000_000) return reply({ error: 'Image too large (max ~5 MB)' }, 400);
      if (!/^image\/(png|jpeg|webp|gif)$/.test(img.mediaType)) return reply({ error: 'Unsupported image type' }, 400);
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
        { type: 'text', text: userQuestion },
      ];
    }
  }

  // ── 5. Call Anthropic ─────────────────────────────────────────────────────
  const reqBody: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    messages: [...safeMessages, { role: 'user', content: userContent }],
  };
  if (safeSystem) reqBody.system = safeSystem;
  if (tools) reqBody.tools = tools;

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

  const data = await anthropicRes.json() as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>; stop_reason?: string };
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim();
  const toolUses = tools
    ? blocks.filter(b => b.type === 'tool_use' && typeof b.name === 'string' && TOOL_NAMES.has(b.name))
            .map(b => ({ id: b.id, name: b.name, input: b.input ?? {} }))
    : [];

  return reply({ text, toolUses, stopReason: data?.stop_reason ?? null });
});
