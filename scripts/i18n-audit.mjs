#!/usr/bin/env node
/**
 * i18n-audit — B2 trust gate.
 *
 * 1. Missing-keys report: every key in the canonical `en` bundle must exist
 *    (non-empty) in `fr` and `rw`. The app interior is intentionally English
 *    in v1 (NFR-I18N-2) — only the localized chrome lives in the bundles, so a
 *    missing key here is a real gap, not a deferred translation.
 * 2. Hardcoded-string lint: the fully-localized "chrome" files must route all
 *    user-facing strings through t(). New literals (vs a committed baseline)
 *    fail the build, so we never silently regress an already-translated screen.
 *
 * Usage:
 *   node scripts/i18n-audit.mjs            # report + gate (CI)
 *   node scripts/i18n-audit.mjs --update   # refresh the hardcoded baseline
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const BASELINE_PATH = resolve(here, 'i18n-baseline.json');

// Fully-localized surfaces — new hardcoded UI strings here fail CI.
const CHROME_FILES = [
  'src/views/Landing.jsx',
  'src/views/Login.jsx',
  'src/views/NamePrompt.jsx',
  'src/views/Onboarding.jsx',
  'src/components/Sidebar.jsx',
];

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

async function loadLocale(code) {
  const mod = await import(pathToFileURL(resolve(root, `src/locales/${code}.js`)).href);
  return flatten(mod.default || {});
}

async function auditKeys() {
  const en = await loadLocale('en');
  const enKeys = Object.keys(en);
  const report = {};
  for (const code of ['fr', 'rw']) {
    const bundle = await loadLocale(code);
    report[code] = enKeys.filter(k => bundle[k] == null || bundle[k] === '');
  }
  return report;
}

// Heuristic line scan: flag quoted literals in localized attributes and JSX
// text that read as real words and aren't routed through t(...).
const ATTR_RE = /\b(?:placeholder|title|aria-label|alt)\s*=\s*"([^"]*[A-Za-z]{2,}[^"]*)"/g;
const JSX_TEXT_RE = />\s*([A-Z][A-Za-z][^<>{}\n]{2,})</g;

function looksHuman(s) {
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[a-z]/.test(t)) return false;          // skip SCREAMING_CONST / glyphs
  return /\s/.test(t) || /[a-z]{3,}/.test(t);
}

async function scanFile(rel) {
  let src;
  try { src = await readFile(resolve(root, rel), 'utf8'); }
  catch { return []; }
  const violations = [];
  src.split('\n').forEach((line, i) => {
    if (line.includes('i18n-ignore') || line.includes('t(')) return;
    for (const re of [ATTR_RE, JSX_TEXT_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        if (looksHuman(m[1])) violations.push(`${rel}:${i + 1}  "${m[1].trim()}"`);
      }
    }
  });
  return violations;
}

async function auditHardcoded() {
  const found = [];
  for (const f of CHROME_FILES) found.push(...await scanFile(f));
  return found;
}

// ── Run ───────────────────────────────────────────────────────
const update = process.argv.includes('--update');
const missing = await auditKeys();
const hardcoded = await auditHardcoded();

if (update) {
  await writeFile(BASELINE_PATH, JSON.stringify(hardcoded, null, 2) + '\n');
  console.log(`i18n-audit: baseline updated (${hardcoded.length} known literals).`);
  process.exit(0);
}

let baseline = [];
try { baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8')); } catch { /* no baseline yet */ }
const baselineSet = new Set(baseline);
const newViolations = hardcoded.filter(v => !baselineSet.has(v));

let failed = false;
console.log('— i18n missing-keys report (chrome) —');
for (const code of ['fr', 'rw']) {
  const list = missing[code];
  console.log(`  ${code}: ${list.length} missing/empty`);
  list.forEach(k => console.log(`     · ${k}`));
  if (list.length) failed = true;
}

console.log('\n— hardcoded-string gate (chrome files) —');
if (newViolations.length) {
  console.log(`  ${newViolations.length} NEW hardcoded string(s) — wrap in t() or add // i18n-ignore:`);
  newViolations.forEach(v => console.log(`     · ${v}`));
  failed = true;
} else {
  console.log(`  OK — no new hardcoded strings (baseline: ${baseline.length}).`);
}

if (failed) { console.error('\ni18n-audit FAILED.'); process.exit(1); }
console.log('\ni18n-audit passed.');
