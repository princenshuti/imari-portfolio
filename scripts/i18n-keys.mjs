#!/usr/bin/env node
/**
 * i18n-keys — the canonical interior key list.
 *
 * Two sources, unioned into scripts/i18n-keys.all.json:
 *   1. every string literal passed as the first argument of tx(…) in src
 *   2. scripts/i18n-data-keys.json — module-level data-table strings that are
 *      translated at the read site (tx(x.label)), so they never appear as a
 *      literal inside a tx() call
 *
 * Run after either codemod, then translate anything new before i18n-audit.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';
const traverse = traverseMod.default || traverseMod;

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SRC = resolve(root, 'src');

async function walk(dir, acc = []) {
  for (const e of await readdir(dir)) {
    const p = join(dir, e); const s = await stat(p);
    if (s.isDirectory()) await walk(p, acc); else if (/\.(js|jsx)$/.test(e)) acc.push(p);
  }
  return acc;
}

const keys = new Set();
const files = (await walk(SRC)).filter(f => !/\.test\.js$|\/i18n\//.test(f.replace(/\\/g, '/')));
for (const file of files) {
  const code = await readFile(file, 'utf8');
  if (!code.includes('tx(')) continue;
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'] }); } catch { continue; }
  traverse(ast, {
    CallExpression(path) {
      const c = path.node.callee;
      if (c.type !== 'Identifier' || c.name !== 'tx') return;
      const a = path.node.arguments[0];
      if (a && a.type === 'StringLiteral') keys.add(a.value);
    },
  });
}
const data = JSON.parse(await readFile(resolve(root, 'scripts/i18n-data-keys.json'), 'utf8'));
const all = [...new Set([...keys, ...data])].sort();
await writeFile(resolve(root, 'scripts/i18n-keys.all.json'), JSON.stringify(all, null, 1) + '\n');
console.log(`${all.length} keys (${keys.size} from tx() calls, ${data.length} data-table)`);
