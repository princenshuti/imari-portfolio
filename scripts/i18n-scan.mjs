// i18n-scan: list English-looking string literals / template literals in src
// that are NOT already inside tx()/t() calls. Triage helper, not a gate.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';
const traverse = traverseMod.default || traverseMod;

const ROOT = 'src';
const SKIP = [/^src\/i18n\//, /^src\/locales\//, /\.test\.js$/, /^src\/engine\/insights\/_shared\.js$/];
const NON_UI_PROPS = new Set(['className','style','href','src','id','kind','type','key','name','value','group','icon','glyph','color','font','path','target','rel','role','autoComplete','inputMode','pattern','accept','method','mode','align','fill','stroke','d','viewBox','transform','points','x','y','dx','dy','cx','cy','r','width','height','fontFamily','fontWeight','textAnchor','dominantBaseline','preserveAspectRatio','xmlns','htmlFor','currency','locale','lang','dir','code','symbol','flag','ticker','source','url','endpoint','route','hash','storageKey','table','column','bucket','channel']);
const looksEnglish = (s) => /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(s) && /[a-z]/.test(s) && !/^[a-z0-9_\-./:]+$/.test(s) && !/^(var\(|#|rgb|hsl|linear-gradient|url\()/.test(s) && !/^[A-Z_]+$/.test(s);
const files = [];
(function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(/\.(js|jsx)$/.test(p)) files.push(p);} })(ROOT);
const out = [];
for (const f of files) {
  if (SKIP.some(r=>r.test(f))) continue;
  const code = fs.readFileSync(f,'utf8');
  let ast; try { ast = parse(code,{sourceType:'module',plugins:['jsx']}); } catch(e){ console.error('parse fail',f,e.message); continue; }
  const insideTx = (p) => { let q=p; while (q) { if (q.isCallExpression()) { const c=q.node.callee; const n=c.type==='Identifier'?c.name:(c.type==='MemberExpression'&&c.property.type==='Identifier'?c.property.name:''); if (['tx','t','txn'].includes(n)) return true; if (['log','warn','error','info','debug','test','describe','it','expect','matchMedia','querySelector','querySelectorAll','getItem','setItem','removeItem','addEventListener','removeEventListener','includes','startsWith','endsWith','indexOf','split','replace','match','localeCompare','from','channel','on','rpc','select','eq','order','fetch','get','set','has','delete','trim','padStart','padEnd','toLocaleString','toLocaleDateString','Intl','NumberFormat','DateTimeFormat','RegExp','encodeURIComponent','decodeURIComponent','createElement','setAttribute','getAttribute','dispatchEvent','postMessage'].includes(n)) return true; } if (q.isImportDeclaration()) return true; if (q.isTSTypeAnnotation && q.isTSTypeAnnotation()) return true; q=q.parentPath; } return false; };
  const isNonUiContext = (p) => {
    const par = p.parentPath;
    if (!par) return false;
    if (par.isObjectProperty() && par.node.key === p.node) return true; // key
    if (par.isObjectProperty() && par.node.key.type==='Identifier' && NON_UI_PROPS.has(par.node.key.name)) return true;
    if (par.isJSXAttribute() && NON_UI_PROPS.has(par.node.name.name)) return true;
    if (par.isBinaryExpression() && ['===','!==','==','!='].includes(par.node.operator)) return true;
    if (par.isSwitchCase()) return true;
    if (par.isMemberExpression() && par.node.property === p.node) return true;
    if (par.isNewExpression() && par.node.callee.name==='RegExp') return true;
    if (par.isVariableDeclarator() && /^[A-Z_]+$/.test(par.node.id.name||'') && /^[a-z0-9_\-]+$/.test(p.node.value||'')) return true;
    return false;
  };
  traverse(ast, {
    StringLiteral(p){ const v=p.node.value; if(!looksEnglish(v)) return; if(isNonUiContext(p)||insideTx(p)) return; out.push(`${f}:${p.node.loc.start.line}\t${JSON.stringify(v).slice(0,110)}`); },
    TemplateLiteral(p){ const raw=p.node.quasis.map(q=>q.value.cooked).join('{}'); if(!looksEnglish(raw)) return; if(insideTx(p)) return; if(p.parentPath.isTaggedTemplateExpression()) return; const par=p.parentPath; if(par.isJSXAttribute()&&NON_UI_PROPS.has(par.node.name.name)) return; if(par.isObjectProperty()&&par.node.key.type==='Identifier'&&NON_UI_PROPS.has(par.node.key.name)) return; out.push(`${f}:${p.node.loc.start.line}\tTPL ${JSON.stringify(raw).slice(0,110)}`); },
  });
}
console.log(out.join('\n')); console.error(`\n${out.length} candidates in ${files.length} files`);
