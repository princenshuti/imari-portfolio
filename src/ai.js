import Anthropic from '@anthropic-ai/sdk';

const API_KEY_STORAGE = 'imari:anthropic:key';

/**
 * The key baked in at build time via VITE_ANTHROPIC_KEY.
 * When set, all users share it automatically — no per-user input needed.
 */
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_KEY || '';

/**
 * True when the app owner has embedded a shared key at build time.
 * Use this to hide the manual-entry field in Settings.
 */
export const hasEnvKey = Boolean(ENV_KEY);

/**
 * Returns the active API key.
 * Priority: build-time env key → user's localStorage key → ''
 */
export function getApiKey() {
  return ENV_KEY || localStorage.getItem(API_KEY_STORAGE) || '';
}

/** Only meaningful when hasEnvKey is false (user-managed key). */
export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

function makeClient(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function completeText(apiKey, prompt) {
  const client = makeClient(apiKey);
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

export async function completeChat(apiKey, systemPrompt, messages, userQuestion) {
  const client = makeClient(apiKey);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userQuestion },
    ],
  });
  return response.content[0].text;
}
