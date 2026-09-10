#!/usr/bin/env node
/**
 * i18n-merge — builds src/i18n/messages.{fr,rw}.json from the review chunks in
 * scripts/i18n/ (fr_1…fr_N, rw_1…rw_N), keyed by scripts/i18n-keys.all.json.
 * Reports anything a chunk is missing and any placeholder mismatch, then writes
 * the catalogues in key order.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const keys = JSON.parse(await readFile(resolve(root, 'scripts/i18n-keys.all.json'), 'utf8'));
const files = (await readdir(resolve(here, 'i18n'))).filter(f => /\.json$/.test(f));
let failed = false;

for (const lang of ['fr', 'rw']) {
  const merged = {};
  const chunks = files.filter(f => f.startsWith(`${lang}_`))
    .sort((a, b) => Number(a.match(/_(\d+)/)[1]) - Number(b.match(/_(\d+)/)[1]));
  for (const c of chunks) Object.assign(merged, JSON.parse(await readFile(resolve(here, 'i18n', c), 'utf8')));
  const missing = keys.filter(k => !merged[k]);
  // A translation may drop a placeholder (English plural suffixes have no
  // equivalent in fr/rw), but inventing one that the caller never passes would
  // print a literal "{3}" to the user — that is an error.
  const vars = (s) => new Set(s.match(/\{\d+\}/g) || []);
  const mismatched = keys.filter(k => merged[k] && [...vars(merged[k])].some(v => !vars(k).has(v)));
  const out = {};
  for (const k of keys) if (merged[k]) out[k] = merged[k];
  await writeFile(resolve(root, `src/i18n/messages.${lang}.json`), JSON.stringify(out));
  console.log(`${lang}: ${Object.keys(out).length}/${keys.length} keys from ${chunks.length} chunks`
    + (missing.length ? ` — MISSING ${missing.length}` : '')
    + (mismatched.length ? ` — INVENTED PLACEHOLDER ${mismatched.length}` : ''));
  if (missing.length) { failed = true; console.log('  missing:', JSON.stringify(missing.slice(0, 12), null, 1)); }
  if (mismatched.length) { failed = true; console.log('  invented:', JSON.stringify(mismatched.slice(0, 12), null, 1)); }
}
process.exit(failed ? 1 : 0);
