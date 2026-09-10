#!/usr/bin/env node
/**
 * i18n-pass2 — second sweep of the interior codemod.
 *
 * Pass 1 (i18n-codemod.mjs) wrapped JSX text, allow-listed attributes and a few
 * expression shapes. This pass catches what it left behind: prose held in plain
 * string/template literals inside functions — widget titles, KPI subtexts, CSV
 * headers, table columns, chip labels, prompt suggestions, toast bodies.
 *
 * It is deliberately conservative. A literal is wrapped only when it reads as
 * prose (a space between two letter runs) and it is NOT:
 *   • anywhere inside a style={...} attribute or a CSS-ish object property
 *   • a CSS value, module path, URL, selector or class name
 *   • an argument of import()/console/storage/DOM/Supabase-style calls
 *   • an object key, a comparison operand, or a member name
 *   • inside a file whose prose is machine-facing (LLM prompts, parsers, engines)
 *
 *   node scripts/i18n-pass2.mjs --dry     # counts + scripts/i18n-keys.pass2.json
 *   node scripts/i18n-pass2.mjs           # rewrite in place
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
const ONLY = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

const b = recast.types.builders, n = recast.types.namedTypes;

// Files this pass may touch: presentational code only.
const INCLUDE = /\/(views|components|family)\/[^/]+\.jsx$|\/App\.jsx$|\/features\.js$|\/severity\.js$|\/engine\/freshness\.js$|\/engine\/insights\/[^/]+\.js$|\/contexts\/MarketContext\.jsx$/;
// …minus prompt/parsers/pure-data modules, whose strings are machine-facing.
const EXCLUDE = /\/(ai|cloud|supabase|data|excel|glossary|nav)\.js$|\/services\/|\.test\.js$|\/i18n\//;

const NON_UI_KEYS = new Set(['className','style','id','type','kind','key','name','href','src','icon','glyph','color','font','path','target','rel','role','autoComplete','inputMode','pattern','accept','method','mode','fill','stroke','d','viewBox','transform','points','htmlFor','currency','locale','lang','dir','code','symbol','flag','ticker','url','endpoint','route','hash','storageKey','table','column','bucket','channel','event','action','field','sortKey','tone','variant','size','position','severity','status','state','filter','range','tab','view','page','model','provider','format','ext','mime','contentType','headers']);
const NON_UI_CALLS = new Set(['log','warn','error','info','debug','includes','startsWith','endsWith','indexOf','split','replace','replaceAll','match','test','localeCompare','getItem','setItem','removeItem','querySelector','querySelectorAll','getElementById','addEventListener','removeEventListener','from','channel','on','rpc','select','eq','neq','order','fetch','get','set','has','delete','add','toggle','contains','padStart','padEnd','createElement','setAttribute','getAttribute','matchMedia','RegExp','URL','encodeURIComponent','join','some','every','find','filter','map','reduce','sort','postMessage','send','invoke','upload','download','createSignedUrl','list','insert','update','upsert','downloadCSV','write','setProperty']);
// A style value never reads as prose; these guard the few that would.
const CSS_ONLY = /^(top|bottom|left|right|center|start|end)( (top|bottom|left|right|center))?$/i;
const CSSISH = /(solid|dashed|dotted|var\(--|\d+px|\d+ms|\d+s\b|color-mix|rgba?\(|cubic-bezier|linear-gradient|ease-|keyframes|monospace|sans-serif|\d+fr|\brepeat\(|\d+deg|translate|rotate\(|scale\(|https?:|^\.{0,2}\/|\.jsx?$|^@|^--)/;

// Prompt fragments that reach the model, not the reader: never translate.
const NEVER = new Set([
  '\nYou are a financial advisor. Only answer financial questions grounded in the data above.',
  ' (Ikinyarwanda; keep amounts, currency codes and institution names as given)',
  'financial and family-planning',
  'the user',
]);

const looksProse = (s) => {
  if (NEVER.has(s)) return false;
  if (!s || s.length < 3 || s.length > 260) return false;
  if (!/[A-Za-z]{2,}\s+\S/.test(s)) return false;          // at least two words
  if (!/[a-z]/.test(s)) return false;                      // not SCREAMING/GLYPHS
  if (CSS_ONLY.test(s.trim()) || CSSISH.test(s)) return false;
  return true;
};

const keys = new Set();
let stats = { files: 0, changed: 0, literals: 0, templates: 0 };
const txCall = (text, vars) => { keys.add(text); const a = [b.stringLiteral(text)]; if (vars?.length) a.push(b.arrayExpression(vars)); return b.callExpression(b.identifier('tx'), a); };

function fromTemplate(tpl) {
  const parts = tpl.quasis.map(q => q.value.cooked ?? q.value.raw);
  let text = ''; parts.forEach((p, i) => { text += p; if (i < tpl.expressions.length) text += `{${i}}`; });
  if (!looksProse(text.replace(/\{\d+\}/g, 'x'))) return null;
  return txCall(text, tpl.expressions.slice());
}

/** A JSX attribute value must stay an expression container, not a bare call. */
const place = (path, node) =>
  (path.parent && n.JSXAttribute.check(path.parent.node) && path.parent.node.value === path.node)
    ? b.jsxExpressionContainer(node) : node;

/** true when this literal sits somewhere a translation would be wrong. */
function blocked(path) {
  // Ancestor rules — a style attribute or an import taints everything below it.
  for (let p = path; p; p = p.parent) {
    const node = p.node;
    if (n.ImportDeclaration.check(node)) return true;
    if (n.JSXAttribute.check(node)) {
      const an = node.name && (node.name.name || node.name.namespace?.name);
      if (an === 'style' || an === 'className') return true;
    }
    if (n.CallExpression.check(node) || n.OptionalCallExpression.check(node)) {
      const c = node.callee;
      if (c && c.type === 'Import') return true;
      const cn = n.Identifier.check(c) ? c.name : '';
      if (cn === 'tx' || cn === 't') return true;            // already translated
    }
  }
  // Immediate-parent rules — these describe THIS literal's role, so a legitimate
  // UI array reached through .map()/.filter() is not tainted by the call itself.
  const parent = path.parent && path.parent.node;
  if (!parent) return true;
  if (n.TaggedTemplateExpression.check(parent)) return true;
  if (n.ObjectProperty.check(parent) || n.Property.check(parent)) {
    if (parent.key === path.node) return true;
    const k = parent.key;
    const kn = n.Identifier.check(k) ? k.name : (n.StringLiteral.check(k) ? k.value : '');
    if (NON_UI_KEYS.has(kn)) return true;
  }
  if (n.JSXAttribute.check(parent)) {
    const an = parent.name && (parent.name.name || parent.name.namespace?.name);
    if (NON_UI_KEYS.has(an)) return true;
  }
  if (n.BinaryExpression.check(parent) && /^[=!]==?$/.test(parent.operator)) return true;
  if (n.SwitchCase.check(parent) && parent.test === path.node) return true;
  if ((n.MemberExpression.check(parent) || n.OptionalMemberExpression.check(parent)) && parent.property === path.node) return true;
  if (n.CallExpression.check(parent) || n.OptionalCallExpression.check(parent) || n.NewExpression.check(parent)) {
    const c = parent.callee;
    const cn = n.Identifier.check(c) ? c.name
      : ((n.MemberExpression.check(c) || n.OptionalMemberExpression.check(c)) && n.Identifier.check(c.property) ? c.property.name : '');
    if (NON_UI_CALLS.has(cn)) return true;
    if (n.MemberExpression.check(c) && n.Identifier.check(c.object)
      && /^(console|localStorage|sessionStorage|document|window|navigator|supabase|JSON|Object|Array|Math|Date|history|location|crypto|Intl)$/.test(c.object.name)) return true;
  }
  if (n.VariableDeclarator.check(parent) && n.Identifier.check(parent.id)
    && /(_RE|Regex|Key|KEY|_ID|Id|Url|URL|Path|Route|Class|Selector|Topic|Bucket|Table)$/.test(parent.id.name)) return true;
  return false;
}
const insideFunction = (path) => { for (let p = path; p; p = p.parent) if (n.Function.check(p.node)) return true; return false; };

async function processFile(file) {
  const src = await readFile(file, 'utf8');
  const ast = recast.parse(src, { parser: babelParser });
  let touched = 0;
  recast.types.visit(ast, {
    visitStringLiteral(path) {
      if (!looksProse(path.node.value) || !insideFunction(path) || blocked(path)) return false;
      path.replace(place(path, txCall(path.node.value))); stats.literals++; touched++; return false;
    },
    visitTemplateLiteral(path) {
      if (!insideFunction(path) || blocked(path)) { this.traverse(path); return; }
      const w = fromTemplate(path.node);
      if (w) { path.replace(place(path, w)); stats.templates++; touched++; return false; }
      this.traverse(path);
    },
  });
  if (!touched) return { changed: false };
  const rel = relative(dirname(file), TX_PATH).replace(/\\/g, '/');
  const spec = rel.startsWith('.') ? rel : `./${rel}`;
  const body = ast.program.body;
  if (!body.some(s => n.ImportDeclaration.check(s) && s.source.value === spec)) {
    let last = -1; body.forEach((s, i) => { if (n.ImportDeclaration.check(s)) last = i; });
    body.splice(last + 1, 0, b.importDeclaration([b.importSpecifier(b.identifier('tx'))], b.stringLiteral(spec)));
  }
  if (!DRY) await writeFile(file, recast.print(ast, { quote: 'single' }).code);
  return { changed: true, touched };
}

async function walk(dir, acc = []) {
  for (const e of await readdir(dir)) {
    const p = join(dir, e); const s = await stat(p);
    if (s.isDirectory()) await walk(p, acc); else if (/\.(js|jsx)$/.test(e)) acc.push(p);
  }
  return acc;
}
const files = ONLY ? [resolve(root, ONLY)]
  : (await walk(SRC)).map(f => f.replace(/\\/g, '/')).filter(f => INCLUDE.test(f) && !EXCLUDE.test(f));
for (const f of files) { stats.files++; const r = await processFile(f); if (r.changed) { stats.changed++; if (DRY) console.log(`  ${relative(root, f)}: ${r.touched}`); } }
const list = [...keys].sort();
await writeFile(resolve(root, 'scripts/i18n-keys.pass2.json'), JSON.stringify(list, null, 1) + '\n');
console.log(JSON.stringify({ ...stats, uniqueKeys: list.length, dry: DRY }, null, 1));
