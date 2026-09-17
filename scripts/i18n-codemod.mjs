#!/usr/bin/env node
/**
 * i18n-codemod — wraps every user-visible English string in tx('…') so the
 * whole app interior translates from one catalogue keyed by the English text.
 *
 *   node scripts/i18n-codemod.mjs --dry      # report counts + write the key list
 *   node scripts/i18n-codemod.mjs            # rewrite files in place (recast keeps formatting)
 *   node scripts/i18n-codemod.mjs --file src/views/Goals.jsx --dry --print
 *
 * What gets wrapped (and only this):
 *   • JSX text with letters                              <p>Net worth</p>      → <p>{tx('Net worth')}</p>
 *   • allow-listed JSX attributes (placeholder, title, aria-label, label, hint, sub, …)
 *   • string / template / conditional / logical expressions that are direct
 *     JSX children or allow-listed attribute values
 *   • {x.label} style member reads of known text props, and CONST[key] lookups
 *   • object properties named headline/body/costStatement/label/title/subtitle/…
 *     when they are built inside a function (engine rules, page titles), never
 *     module-level data tables (those translate at render through the rule above)
 *   • first argument of showToast/setError/setMessage/setInfo/setMsg/setErr and new Error(…)
 * Never wrapped: anything inside t('key') calls, className/style/id/type/href
 * and other non-text attributes, string keys of dispatch actions, imports.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as recast from 'recast';
import * as babelParser from 'recast/parsers/babel.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SRC = resolve(root, 'src');
const TX_PATH = resolve(SRC, 'i18n/tx.js');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const PRINT = args.includes('--print');
const ONLY = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

const b = recast.types.builders, n = recast.types.namedTypes;
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'hint', 'sub', 'subtitle', 'description', 'confirmLabel', 'emptyText', 'message', 'helper', 'tooltip', 'caption', 'kicker', 'eyebrow', 'legend', 'summary', 'question', 'body', 'headline', 'cta', 'ctaLabel', 'actionLabel', 'okLabel', 'cancelLabel', 'prefix', 'suffix']);
const MEMBER_PROPS = new Set(['label', 'title', 'hint', 'sub', 'subtitle', 'description', 'desc', 'plural', 'tag', 'text', 'short', 'long', 'definition', 'summary', 'headline', 'body', 'costStatement', 'labelDesktop', 'labelMobile']);
const OBJ_PROPS = new Set(['headline', 'body', 'costStatement', 'label', 'title', 'subtitle', 'hint', 'description', 'placeholder', 'sub', 'text', 'summary', 'message']);
const CALLS = new Set(['showToast', 'setError', 'setMessage', 'setInfo', 'setMsg', 'setErr', 'setStatus', 'setNotice']);
const SKIP_FILES = /(\.test\.js$|\/locales\/|\/i18n\/|\/markdown\.js$|\/supabase\.js$|\/main\.jsx$|\/nav\.js$)/;

const hasLetters = s => /[A-Za-z]/.test(s);
const looksLikeText = s => hasLetters(s) && !/^[A-Z0-9_./:-]+$/.test(s) && !/^https?:|^data:|^#|^\/|^mailto:/.test(s) && !/^[a-z][a-zA-Z0-9]*$/.test(s) && s.length > 1;
const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&mdash;': '—', '&ndash;': '–', '&times;': '×', '&rarr;': '→', '&larr;': '←', '&middot;': '·', '&hellip;': '…', '&apos;': "'" };
const decode = s => s.replace(/&[a-z#0-9]+;/g, m => ENT[m] ?? m);

const keys = new Set();
let stats = { files: 0, changed: 0, jsxText: 0, attrs: 0, exprs: 0, members: 0, objProps: 0, calls: 0 };

function txCall(text, vars) {
  keys.add(text);
  const argsArr = [b.stringLiteral(text)];
  if (vars && vars.length) argsArr.push(b.arrayExpression(vars));
  return b.callExpression(b.identifier('tx'), argsArr);
}
function fromTemplate(tpl) {
  const parts = tpl.quasis.map(q => q.value.cooked ?? q.value.raw);
  let text = '';
  parts.forEach((p, i) => { text += p; if (i < tpl.expressions.length) text += `{${i}}`; });
  if (!looksLikeText(text.replace(/\{\d+\}/g, ''))) return null;
  return txCall(text, tpl.expressions.slice());
}
function isTx(node) { return n.CallExpression.check(node) && n.Identifier.check(node.callee) && node.callee.name === 'tx'; }
function insideT(path) {
  for (let p = path; p; p = p.parent) {
    const node = p.node;
    if (n.CallExpression.check(node) && (n.Identifier.check(node.callee) && (node.callee.name === 't' || node.callee.name === 'tx')
        || (n.MemberExpression.check(node.callee) && n.Identifier.check(node.callee.property) && node.callee.property.name === 't'))) return true;
    if (n.ImportDeclaration.check(node)) return true;
  }
  return false;
}
function insideFunction(path) {
  for (let p = path; p; p = p.parent) if (n.Function.check(p.node)) return true;
  return false;
}
/** Wrap an expression node when it is (or contains) translatable literals. Returns new node or null. */
function wrapExpr(node) {
  if (!node || isTx(node)) return null;
  if (n.StringLiteral.check(node) || (n.Literal.check(node) && typeof node.value === 'string')) {
    return looksLikeText(node.value) ? txCall(node.value) : null;
  }
  if (n.TemplateLiteral.check(node)) return fromTemplate(node);
  if (n.ConditionalExpression.check(node)) {
    const c = wrapExpr(node.consequent), a = wrapExpr(node.alternate);
    if (c) node.consequent = c; if (a) node.alternate = a;
    return (c || a) ? node : null;
  }
  if (n.LogicalExpression.check(node)) {
    const r = wrapExpr(node.right); const l = (n.StringLiteral.check(node.left) || n.TemplateLiteral.check(node.left) ) ? wrapExpr(node.left) : null;
    if (r) node.right = r; if (l) node.left = l;
    return (r || l) ? node : null;
  }
  if (n.MemberExpression.check(node)) {
    if (!node.computed && n.Identifier.check(node.property) && MEMBER_PROPS.has(node.property.name)) { stats.members++; return b.callExpression(b.identifier('tx'), [node]); }
    if (node.computed && n.Identifier.check(node.object) && /^[A-Z][A-Z0-9_]+$/.test(node.object.name)) { stats.members++; return b.callExpression(b.identifier('tx'), [node]); }
  }
  return null;
}

async function processFile(file) {
  const src = await readFile(file, 'utf8');
  const ast = recast.parse(src, { parser: babelParser });
  let touched = 0;

  recast.types.visit(ast, {
    visitJSXText(path) {
      const raw = path.node.value;
      if (!hasLetters(raw) || insideT(path)) return false;
      const decoded = decode(raw);
      const lead = decoded.match(/^\s*/)[0], trail = decoded.match(/\s*$/)[0];
      const core = decoded.trim();
      if (!looksLikeText(core)) return false;
      const parts = [];
      if (lead) parts.push(b.jsxText(lead));
      parts.push(b.jsxExpressionContainer(txCall(core)));
      if (trail) parts.push(b.jsxText(trail));
      path.replace(...parts);
      stats.jsxText++; touched++;
      return false;
    },
    visitJSXAttribute(path) {
      const name = path.node.name && (path.node.name.name || path.node.name.namespace?.name);
      if (!ATTRS.has(name) || insideT(path)) { this.traverse(path); return; }
      const v = path.node.value;
      if (!v) return false;
      if (n.StringLiteral.check(v) || (n.Literal.check(v) && typeof v.value === 'string')) {
        if (looksLikeText(v.value)) { path.node.value = b.jsxExpressionContainer(txCall(v.value)); stats.attrs++; touched++; }
        return false;
      }
      if (n.JSXExpressionContainer.check(v)) {
        const w = wrapExpr(v.expression);
        if (w) { v.expression = w; stats.attrs++; touched++; }
        this.traverse(path); // still visit nested JSX (e.g. label={<span>…</span>})
        return;
      }
      this.traverse(path);
    },
    visitJSXExpressionContainer(path) {
      const parent = path.parent && path.parent.node;
      const isChild = parent && (n.JSXElement.check(parent) || n.JSXFragment.check(parent));
      if (isChild && !insideT(path)) {
        const w = wrapExpr(path.node.expression);
        if (w) { path.node.expression = w; stats.exprs++; touched++; return false; }
      }
      this.traverse(path);
    },
    visitObjectProperty(path) {
      const k = path.node.key; const keyName = n.Identifier.check(k) ? k.name : (n.StringLiteral.check(k) ? k.value : null);
      if (keyName && OBJ_PROPS.has(keyName) && !path.node.computed && insideFunction(path) && !insideT(path)) {
        const v = path.node.value;
        if (n.StringLiteral.check(v) || n.TemplateLiteral.check(v) || n.ConditionalExpression.check(v) || n.LogicalExpression.check(v)) {
          const w = wrapExpr(v);
          if (w) { path.node.value = w; stats.objProps++; touched++; return false; }
        }
      }
      this.traverse(path);
    },
    visitCallExpression(path) {
      const c = path.node.callee;
      const name = n.Identifier.check(c) ? c.name : (n.MemberExpression.check(c) && n.Identifier.check(c.property) ? c.property.name : null);
      if (name && CALLS.has(name) && path.node.arguments.length && !insideT(path)) {
        const w = wrapExpr(path.node.arguments[0]);
        if (w) { path.node.arguments[0] = w; stats.calls++; touched++; }
      }
      this.traverse(path);
    },
    visitNewExpression(path) {
      if (n.Identifier.check(path.node.callee) && path.node.callee.name === 'Error' && path.node.arguments.length) {
        const w = wrapExpr(path.node.arguments[0]);
        if (w) { path.node.arguments[0] = w; stats.calls++; touched++; }
      }
      this.traverse(path);
    },
  });

  if (!touched) return { changed: false };
  // Import tx once (ESM, relative path from this file).
  const relImport = relative(dirname(file), TX_PATH).replace(/\\/g, '/');
  const spec = relImport.startsWith('.') ? relImport : `./${relImport}`;
  const body = ast.program.body;
  const already = body.some(s => n.ImportDeclaration.check(s) && s.source.value === spec);
  if (!already) {
    const imp = b.importDeclaration([b.importSpecifier(b.identifier('tx'))], b.stringLiteral(spec));
    let lastImport = -1; body.forEach((s, i) => { if (n.ImportDeclaration.check(s)) lastImport = i; });
    body.splice(lastImport + 1, 0, imp);
  }
  const out = recast.print(ast, { quote: 'single' }).code;
  if (PRINT) console.log(out);
  if (!DRY) await writeFile(file, out);
  return { changed: true, touched };
}

async function walk(dir, acc = []) {
  for (const e of await readdir(dir)) {
    const p = join(dir, e); const s = await stat(p);
    if (s.isDirectory()) await walk(p, acc); else if (/\.(js|jsx)$/.test(e)) acc.push(p);
  }
  return acc;
}

const files = ONLY ? [resolve(root, ONLY)] : (await walk(SRC)).filter(f => !SKIP_FILES.test(f.replace(/\\/g, '/')));
for (const f of files) {
  stats.files++;
  const r = await processFile(f);
  if (r.changed) { stats.changed++; if (DRY && !PRINT) console.log(`  ${relative(root, f)}: ${r.touched}`); }
}
const list = [...keys].sort();
await writeFile(resolve(root, 'scripts/i18n-keys.json'), JSON.stringify(list, null, 1) + '\n');
console.log(JSON.stringify({ ...stats, uniqueKeys: list.length, dry: DRY }, null, 1));
