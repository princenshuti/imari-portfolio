// tx — message-keyed translation for the whole app interior.
//
// tx('Net worth')                → French / Kinyarwanda text for the active locale
// tx('{0} open · {1} done', [a, b]) → positional interpolation
// tx('Hello {name}', { name })    → named interpolation
//
// The English string IS the key (see scripts/i18n-codemod.mjs, which wraps
// every user-visible literal). A missing entry falls back to the English
// text, so a partially translated catalogue never blanks the UI. Catalogues
// live in src/i18n/messages.<locale>.json and are loaded lazily by
// I18nProvider, so English users download nothing extra.
//
// Pure module state (no React) so the insight engine and other non-component
// code can translate too; the provider re-keys the app on locale change.
let current = 'en';
const dicts = { en: null };

export function setTxLocale(locale) { current = locale || 'en'; }
export function getTxLocale() { return current; }
export function registerMessages(locale, dict) { dicts[locale] = dict || null; }
export function hasMessages(locale) { return locale === 'en' || Boolean(dicts[locale]); }

const RE = /\{(\w+)\}/g;
export function tx(msg, vars) {
  if (typeof msg !== 'string') return msg;
  const d = dicts[current];
  let out = (d && Object.prototype.hasOwnProperty.call(d, msg) && d[msg]) || msg;
  if (vars) out = out.replace(RE, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return out;
}

/** Human name of a locale, for prompts and e-mails. */
export const LOCALE_NAMES = { en: 'English', fr: 'French', rw: 'Kinyarwanda' };
