import Anthropic from '@anthropic-ai/sdk';

const API_KEY_STORAGE = 'imari:anthropic:key';

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

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
