/**
 * I18nContext — lightweight in-app translation.
 *
 * Bundled with the app, no library deps. Pattern:
 *   const { t, locale, setLocale } = useT();
 *   t('landing.hero.headline_1')            → "Stop guessing"
 *   t('onboarding.welcome', { name: 'Prince' }) → "Murakaza neza, Prince."
 *
 * Locale is persisted on profile.locale when the user is signed in (so it
 * syncs across devices via Supabase) and mirrored to localStorage so the
 * very-first render — before profile loads — picks the right strings.
 *
 * Scope of v1 (per UX review #53):
 *   ✅ Landing page, Sidebar, Login / NamePrompt, Onboarding wizard,
 *      Settings appearance + locale switcher.
 *   ⏳ App interior (Dashboard, Assets, Cash Flow, Goals, Tax Report,
 *      Advisor, Trends) — English-only until v2; needs Kinyarwanda-
 *      speaking reviewer for financial / RRA-specific vocabulary.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from '../locales/en.js';
import fr from '../locales/fr.js';
import rw from '../locales/rw.js';

const BUNDLES = { en, fr, rw };
const STORAGE_KEY = 'imari:locale';
const FALLBACK = 'en';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English',     nativeName: 'English' },
  { code: 'fr', label: 'French',      nativeName: 'Français' },
  { code: 'rw', label: 'Kinyarwanda', nativeName: 'Ikinyarwanda' },
];

/** Lookup a dotted-path key in a nested object. */
function lookup(bundle, key) {
  const parts = key.split('.');
  let v = bundle;
  for (const p of parts) {
    if (v == null) return undefined;
    v = v[p];
  }
  return typeof v === 'string' ? v : undefined;
}

/** Substitute {placeholder} tokens with values from params. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    params[name] != null ? String(params[name]) : `{${name}}`
  );
}

/** Pick the best initial locale: profile → localStorage → navigator.language → en. */
function detectLocale(profileLocale) {
  if (profileLocale && BUNDLES[profileLocale]) return profileLocale;
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && BUNDLES[cached]) return cached;
  } catch {}
  const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
  const base = nav.slice(0, 2).toLowerCase();
  if (BUNDLES[base]) return base;
  return FALLBACK;
}

const I18nContext = createContext(null);

export function I18nProvider({ profile, onChangeLocale, children }) {
  const [locale, setLocaleState] = useState(() => detectLocale(profile?.locale));

  // Sync down: when profile.locale changes externally (cloud sync from
  // another device), adopt it. Skip if user just changed it locally.
  useEffect(() => {
    if (profile?.locale && profile.locale !== locale && BUNDLES[profile.locale]) {
      setLocaleState(profile.locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.locale]);

  const setLocale = useCallback((next) => {
    if (!BUNDLES[next]) return;
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    onChangeLocale?.(next);
  }, [onChangeLocale]);

  const t = useCallback((key, params) => {
    const bundle = BUNDLES[locale] || BUNDLES[FALLBACK];
    const hit = lookup(bundle, key);
    if (hit != null) return interpolate(hit, params);
    // Fallback to English if the active locale is missing the key —
    // better than a blank cell while v1 translations are still being filled.
    if (locale !== FALLBACK) {
      const fb = lookup(BUNDLES[FALLBACK], key);
      if (fb != null) return interpolate(fb, params);
    }
    // Last resort: return the key itself so missing strings are visible in dev.
    return key;
  }, [locale]);

  const value = useMemo(() => ({ t, locale, setLocale }), [t, locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within <I18nProvider>');
  return ctx;
}
