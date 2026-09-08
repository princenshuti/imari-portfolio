/**
 * ai.js — Anthropic AI integration
 *
 * Security model:
 *  • When Supabase is configured (deployed app): ALL calls go through the
 *    Supabase Edge Function `ai-proxy`. The Anthropic key lives in a server
 *    secret and NEVER reaches the browser bundle.
 *  • When Supabase is not configured (local dev / no-auth mode): falls back
 *    to the direct Anthropic SDK using VITE_ANTHROPIC_KEY or a localStorage
 *    key entered by the user.
 *
 * Callers must not import Anthropic directly — always use completeText /
 * completeChat so the proxy path is used when available.
 */
import { supabase, isConfigured } from './supabase.js';

// ── Local-dev fallback key (never used in production with Supabase) ───────────
// Key baked in at build time via VITE_ANTHROPIC_KEY in .env.local (never .env)
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_KEY || '';

// In-memory store for keys entered via the Settings UI in local-dev mode.
// Intentionally NOT persisted to localStorage/sessionStorage/cookies —
// prevents CodeQL js/clear-text-storage-of-sensitive-data and limits the
// exposure window to the current page session.
let _memKey = '';

/**
 * True when AI is available:
 * - Supabase configured  → edge function provides the key server-side
 * - Supabase not configured → VITE_ANTHROPIC_KEY env var or in-session manual entry
 */
export const hasEnvKey = isConfigured || Boolean(ENV_KEY);

/**
 * Returns a truthy value when AI can be used; empty string when it cannot.
 * Callers use this only to decide whether to show the "add your key" prompt.
 * The real key is NEVER sent from the browser when Supabase is configured.
 */
export function getApiKey() {
  if (isConfigured) return '__via_proxy__';   // edge function handles auth
  return ENV_KEY || _memKey || '';
}

/**
 * Store the key in memory only (cleared on page refresh).
 * Only meaningful in local-dev / no-Supabase mode.
 * For persistence, set VITE_ANTHROPIC_KEY in .env.local instead.
 */
export function setApiKey(key) {
  _memKey = key.trim();
}

// ── Client-side rate limiter (3 s cooldown between requests) ─────────────────
let _lastReqAt = 0;
const MIN_INTERVAL_MS = 3000;

function throttle() {
  const now = Date.now();
  if (now - _lastReqAt < MIN_INTERVAL_MS) {
    throw new Error('Please wait a moment before asking again.');
  }
  _lastReqAt = now;
}

// ── Edge-function path (production) ──────────────────────────────────────────
async function callProxy(systemPrompt, messages, userQuestion, model) {
  throttle();
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: {
      systemPrompt,
      // Only the last 10 turns, content capped at 4000 chars each
      messages: (messages || []).slice(-10).map(m => ({
        role:    m.role,
        content: String(m.content).slice(0, 4000),
      })),
      userQuestion: String(userQuestion).slice(0, 2000),
      model,
    },
  });
  if (error) {
    // FunctionsHttpError carries the response on error.context — read its body
    // so the user sees the real cause (e.g. "AI service not configured")
    // instead of the generic "non-2xx status code".
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (body?.error) throw new Error(body.error);
      } catch (e) {
        if (e.message && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
    throw new Error(error.message || 'AI request failed');
  }
  if (data?.error) throw new Error(data.error);
  return data.text;
}

// ── Direct SDK path (local dev / no-Supabase) ─────────────────────────────────
async function callDirect(apiKey, systemPrompt, messages, userQuestion, model) {
  throttle();
  // Dynamic import keeps the SDK out of the main bundle when the proxy is used
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const reqMessages = [
    ...(messages || []).slice(-10).map(m => ({
      role:    m.role,
      content: String(m.content).slice(0, 4000),
    })),
    { role: 'user', content: String(userQuestion).slice(0, 2000) },
  ];

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt
      ? [{ type: 'text', text: String(systemPrompt).slice(0, 8000), cache_control: { type: 'ephemeral' } }]
      : undefined,
    messages: reqMessages,
  });
  return response.content[0].text;
}

// ── Tool-enabled chat (Family module) ─────────────────────────────────────────
// The proxy owns the tool definitions; the browser only executes allow-listed
// names through RLS-scoped functions. Up to 3 rounds, then we stop.
async function invokeProxy(body) {
  const { data, error } = await supabase.functions.invoke('ai-proxy', { body });
  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try { const b = await error.context.json(); if (b?.error) throw new Error(b.error); }
      catch (e) { if (e.message && e.message !== 'Unexpected end of JSON input') throw e; }
    }
    throw new Error(error.message || 'AI request failed');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * completeChatTools — like completeChat, but lets the model call the family
 * tools. `onTool(name, input)` must return a short result string (or throw).
 * Resolves { text, actions: string[] }.
 */
export async function completeChatTools(systemPrompt, messages, userQuestion, { toolset = 'family', onTool, model = 'claude-sonnet-4-6' } = {}) {
  if (!(isConfigured && supabase)) {
    return { text: await completeChat(null, systemPrompt, messages, userQuestion), actions: [] };
  }
  throttle();
  const msgs = (messages || []).slice(-10).map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  let body = { systemPrompt, messages: msgs, userQuestion: String(userQuestion).slice(0, 2000), model, toolset };
  const actions = [];
  let lastText = '';
  for (let round = 0; round < 3; round++) {
    const res = await invokeProxy(body);
    lastText = res.text || lastText;
    const uses = Array.isArray(res.toolUses) ? res.toolUses : [];
    if (!uses.length) return { text: res.text || '', actions };
    const results = [];
    for (const tu of uses) {
      try { const out = await onTool(tu.name, tu.input || {}); actions.push(out); results.push({ tool_use_id: tu.id, content: String(out).slice(0, 2000) }); }
      catch (e) { const msg = `Error: ${e.message || 'failed'}`; actions.push(msg); results.push({ tool_use_id: tu.id, content: msg, is_error: true }); }
    }
    if (round === 0) msgs.push({ role: 'user', content: body.userQuestion });
    msgs.push({ role: 'assistant', content: [ ...(res.text ? [{ type: 'text', text: res.text }] : []), ...uses.map(tu => ({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input || {} })) ] });
    body = { systemPrompt, messages: msgs.slice(-10), toolResults: results, model, toolset };
  }
  return { text: lastText || 'Done.', actions };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function completeText(_apiKey, prompt) {
  if (isConfigured && supabase) {
    return callProxy(null, [], prompt, 'claude-haiku-4-5-20251001');
  }
  const key = ENV_KEY || _memKey;
  if (!key) throw new Error('No API key available');
  return callDirect(key, null, [], prompt, 'claude-haiku-4-5-20251001');
}

export async function completeChat(_apiKey, systemPrompt, messages, userQuestion) {
  if (isConfigured && supabase) {
    return callProxy(systemPrompt, messages, userQuestion, 'claude-sonnet-4-6');
  }
  const key = ENV_KEY || _memKey;
  if (!key) throw new Error('No API key available');
  return callDirect(key, systemPrompt, messages, userQuestion, 'claude-sonnet-4-6');
}

/**
 * Vision completion for receipt / statement OCR (§8/B13).
 * `image` = { data: base64 (no data: prefix), mediaType: 'image/png'|... }.
 * Uses Haiku (cheap) and routes through the proxy when configured.
 */
export async function completeVision(prompt, image, model = 'claude-haiku-4-5-20251001') {
  if (isConfigured && supabase) {
    throttle();
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: { userQuestion: String(prompt).slice(0, 2000), model, image },
    });
    if (error) {
      if (error.context && typeof error.context.json === 'function') {
        try { const b = await error.context.json(); if (b?.error) throw new Error(b.error); } catch (e) { if (e.message && e.message !== 'Unexpected end of JSON input') throw e; }
      }
      throw new Error(error.message || 'AI request failed');
    }
    if (data?.error) throw new Error(data.error);
    return data.text;
  }
  const key = ENV_KEY || _memKey;
  if (!key) throw new Error('No API key available');
  throttle();
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        { type: 'text', text: String(prompt).slice(0, 2000) },
      ],
    }],
  });
  return response.content[0].text;
}
