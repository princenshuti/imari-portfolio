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
const API_KEY_STORAGE = 'imari:anthropic:key';
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_KEY || '';

/**
 * True when AI is available for users.
 * - Supabase configured → edge function provides the key server-side.
 * - Supabase not configured → need a local key (env or localStorage).
 */
export const hasEnvKey = isConfigured || Boolean(ENV_KEY);

/**
 * Returns a truthy value if AI can be used, empty string if not.
 * Callers use this only to decide whether to show the "add your key" message.
 * The actual key is NEVER passed to the Anthropic API in the browser when
 * Supabase is configured.
 */
export function getApiKey() {
  if (isConfigured) return '__via_proxy__';        // edge function handles auth
  return ENV_KEY || localStorage.getItem(API_KEY_STORAGE) || '';
}

/** Only meaningful in local-dev / no-Supabase mode. */
export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
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
  if (error) throw new Error(error.message || 'AI request failed');
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function completeText(_apiKey, prompt) {
  if (isConfigured && supabase) {
    return callProxy(null, [], prompt, 'claude-haiku-4-5-20251001');
  }
  const key = ENV_KEY || localStorage.getItem(API_KEY_STORAGE) || '';
  if (!key) throw new Error('No API key available');
  return callDirect(key, null, [], prompt, 'claude-haiku-4-5-20251001');
}

export async function completeChat(_apiKey, systemPrompt, messages, userQuestion) {
  if (isConfigured && supabase) {
    return callProxy(systemPrompt, messages, userQuestion, 'claude-sonnet-4-6');
  }
  const key = ENV_KEY || localStorage.getItem(API_KEY_STORAGE) || '';
  if (!key) throw new Error('No API key available');
  return callDirect(key, systemPrompt, messages, userQuestion, 'claude-sonnet-4-6');
}
