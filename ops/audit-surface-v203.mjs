import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sourceFiles=['app.js',...fs.readdirSync(path.join(root,'modules')).filter(x=>x.endsWith('.js')).map(x=>`modules/${x}`)];
const sources=new Map(sourceFiles.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
const tests=[
  ...fs.readdirSync(root).filter(x=>/\.test\.(?:js|cjs|mjs)$/.test(x)),
  ...fs.readdirSync(path.join(root,'tests')).filter(x=>/\.test\.(?:js|cjs|mjs)$/.test(x)).map(x=>`tests/${x}`),
  ...fs.readdirSync(path.join(root,'e2e')).filter(x=>/\.spec\.(?:js|cjs|mjs)$/.test(x)).map(x=>`e2e/${x}`)
];
const testSources=new Map(tests.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
const lineAt=(text,index)=>text.slice(0,index).split('\n').length;
const attrs=raw=>Object.fromEntries([...raw.matchAll(/([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m=>[m[1],m[2]??m[3]??m[4]??true]));
const plain=raw=>raw.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const keyFor=(a,label)=>String(a.id||a.name||Object.entries(a).find(([k])=>k.startsWith('data-'))?.[1]||label||'').trim();
const findTests=key=>key?[...testSources].filter(([,text])=>text.includes(key)).map(([file])=>file).slice(0,8):[];
const severity=key=>/(pay|stripe|refund|cancel|return|complete|book|auth|login|register|admin|delete)/i.test(key)?'P1':'P2';
const expected=(tag,a,label)=>{
  if(tag==='button')return a.type==='submit'?`Submit ${label||a.id||'form'}`:`Run ${label||a.id||'UI action'}`;
  return `Capture ${a.name||a.id||a.type||tag} input`;
};
const jsAll=[...sources.values()].join('\n');

const staticControls=[];
for(const m of html.matchAll(/<(button|input|select|textarea)\b([^>]*)>([\s\S]*?<\/\1>)?/gi)){
  const tag=m[1].toLowerCase(),a=attrs(m[2]),label=tag==='input'?(a['aria-label']||a.placeholder||a.value||''):plain(m[3]||'');
  const key=keyFor(a,label),actionAttr=Object.keys(a).find(name=>name.startsWith('data-'));
  const refs=[key,actionAttr].filter(Boolean).reduce((sum,needle)=>sum+jsAll.split(needle).length-1,0);
  staticControls.push({kind:tag,source:`index.html:${lineAt(html,m.index)}`,id:a.id||null,name:a.name||null,actionKey:key||null,label,expected:expected(tag,a,label),observed:refs?`Source binding/reference found (${refs})`:(tag==='button'&&a.type!=='submit'?'No source binding found; manual verification required':'Native form behavior'),tests:findTests(key),severity:severity(key)});
}

const dynamicControls=[];
for(const [file,text] of sources){
  for(const m of text.matchAll(/<(button|input|select|textarea)\b([^>]*)>/gi)){
    const tag=m[1].toLowerCase(),a=attrs(m[2]),key=keyFor(a,'');
    dynamicControls.push({kind:tag,source:`${file}:${lineAt(text,m.index)}`,id:a.id||null,name:a.name||null,actionKey:key||null,label:a['data-i18n-text']||a['aria-label']||a.placeholder||'',expected:expected(tag,a,''),observed:key&&text.split(key).length>2?'Template action token has a source handler/reference':'Rendered template; browser outcome required',tests:findTests(key),severity:severity(key)});
  }
}

const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const apiRoutes=[];
for(const m of server.matchAll(/app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)){
  const method=m[1].toUpperCase(),route=m[2],key=route.replace(/:[^/]+/g,'').replace(/^\/api\//,'');
  apiRoutes.push({method,path:route,source:`server.js:${lineAt(server,m.index)}`,expected:`${method} ${route} enforces authorization, validation and documented state transition`,observed:'Express handler present',tests:findTests(route).length?findTests(route):findTests(key),severity:severity(`${method} ${route}`)});
}

const report={generatedAt:new Date().toISOString(),methodology:'Static source trace. Observed means a handler/reference exists; browser/API outcome is recorded by linked tests and release evidence, not inferred from element presence.',counts:{staticButtons:staticControls.filter(x=>x.kind==='button').length,staticFormFields:staticControls.filter(x=>x.kind!=='button').length,dynamicButtons:dynamicControls.filter(x=>x.kind==='button').length,dynamicFormFields:dynamicControls.filter(x=>x.kind!=='button').length,uniqueApiRoutes:new Set(apiRoutes.map(x=>`${x.method} ${x.path}`)).size},discrepancy:'149/141/83 are the exact index.html button/form-field and unique Express route counts. JavaScript templates add controls that the original static count omitted.',staticControls,dynamicControls,apiRoutes};
const outDir=path.join(root,'audit');fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'v203-control-inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts));
