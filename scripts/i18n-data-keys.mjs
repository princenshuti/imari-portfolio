#!/usr/bin/env node
/**
 * i18n-data-keys — collects the module-level data-table strings the interior
 * renders through tx(x.label) / tx(X[k].hint) style member reads.
 *
 * The codemod wraps the *read site*, so these values never appear as literals
 * in a tx('…') call and would otherwise be missing from the catalogue. This
 * walks every module-level object/array in src and takes the string values of
 * text-bearing keys (label, hint, group, note, …), skipping anything inside a
 * function (already handled by the codemods) and machine-facing modules.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';
const traverse = traverseMod.default || traverseMod;

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SRC = resolve(root, 'src');
const SKIP = /(\.test\.js$|\/i18n\/|\/locales\/|\/services\/(supabase|cloud|receiptOcr|advisorContext)\.js$|\/ai\.js$|\/main\.jsx$)/;
const TEXT_KEYS = new Set(['label','labelDesktop','labelMobile','hint','group','note','sub','subtitle','title','headline','body','desc','description','plural','short','long','definition','summary','text','why','law','area','badge','placeholder','question','answer','tag','name','cta','example','unit','caption','message','costStatement','tooltip','helper','prompt']);
// `name`/`prompt` are text on some tables and identifiers on others — keep the
// human-looking ones only.
const isProse = (s) => typeof s === 'string' && s.length > 1 && s.length < 300
  && /[A-Za-z]/.test(s) && /[a-z]/.test(s)
  && !/^[a-z][a-zA-Z0-9]*$/.test(s)                      // camelCase identifier
  && !/^[A-Z0-9_./:-]+$/.test(s)                          // CONST / code
  && !/^(https?:|data:|mailto:|#|\/)/.test(s)
  && !/(solid |dashed |var\(--|\d+px|color-mix|rgba?\(|cubic-bezier)/.test(s);

async function walk(dir, acc = []) {
  for (const e of await readdir(dir)) {
    const p = join(dir, e); const s = await stat(p);
    if (s.isDirectory()) await walk(p, acc); else if (/\.(js|jsx)$/.test(e)) acc.push(p);
  }
  return acc;
}

const keys = new Set();
const files = (await walk(SRC)).filter(f => !SKIP.test(f.replace(/\\/g, '/')));
for (const file of files) {
  const code = await readFile(file, 'utf8');
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'] }); }
  catch (e) { console.error('parse fail', relative(root, file), e.message); continue; }
  traverse(ast, {
    ObjectProperty(path) {
      if (path.getFunctionParent()) return;                     // module level only
      const k = path.node.key;
      const name = k.type === 'Identifier' ? k.name : (k.type === 'StringLiteral' ? k.value : null);
      if (!name || !TEXT_KEYS.has(name) || path.node.computed) return;
      const v = path.node.value;
      if (v.type === 'StringLiteral' && isProse(v.value)) keys.add(v.value);
    },
  });
}
const list = [...keys].sort();
await writeFile(resolve(root, 'scripts/i18n-data-keys.json'), JSON.stringify(list, null, 1) + '\n');
console.log(`${list.length} data-table keys from ${files.length} files`);
