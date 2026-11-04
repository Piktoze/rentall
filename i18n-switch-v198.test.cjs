const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('modules/i18n-v161.js','utf8');
const storage=new Map([['rentinorbit_language','lt']]);
const nodes=[];
function node(text){return {nodeType:3,nodeValue:text,parentElement:{tagName:'SPAN',closest(){return null;}}};}
function link(path){let href=path;return {nodeType:1,matches:q=>q==='a[href]',getAttribute:n=>n==='href'?href:null,setAttribute:(n,v)=>{if(n==='href')href=v;},url:()=>href};}
const links=[link('/terms'),link('/privacy?tab=important#privacy'),link('/cookies'),link('/help')];
const selector={value:'lt',innerHTML:'',cloneNode(){return {...this,replaceWith(){},addEventListener(){}}},replaceWith(){},addEventListener(){}};
const document={
 readyState:'complete',documentElement:{lang:'lt'},title:'',
 body:{nodeType:1,tagName:'BODY',querySelectorAll:q=>q==='a[href]'?links:[],getAttribute(){return null},hasAttribute(){return false}},
 getElementById:id=>id==='lang'?selector:null,
 querySelector:s=>null,
 querySelectorAll:s=>s==='a[href]'?links:[],
 createTreeWalker(){let i=0;return {nextNode(){return nodes[i++]||null;}}},
 addEventListener(){},dispatchEvent(){}
};
const ctx={window:{},document,navigator:{language:'lt-LT'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},NodeFilter:{SHOW_TEXT:4,SHOW_ELEMENT:1},MutationObserver:class{observe(){}},CustomEvent:class{constructor(n,v){this.name=n;this.detail=v.detail}},requestAnimationFrame:fn=>fn(),URLSearchParams,console};
nodes.push(node('Cancel booking'));
vm.runInNewContext(source,ctx);
const i18n=ctx.window.RentInOrbitI18n;
assert.equal(nodes[0].nodeValue,'Atšaukti rezervaciją');
for(const [lang,expected] of [['es','Cancelar reserva'],['de','Buchung stornieren'],['ru','Отменить бронирование'],['en','Cancel booking'],['lt','Atšaukti rezervaciją']]){
 i18n.apply(lang);assert.equal(nodes[0].nodeValue,expected,`loop ${lang}`);
 assert.equal(document.documentElement.lang,lang);
 assert.ok(links.every(l=>l.url().includes('lang='+lang)),`links ${lang}`);
}
assert.equal(links[1].url(),'/privacy?tab=important&lang=lt#privacy');
// A widget inserted Lithuanian text directly while LT was active, then the user switches to EN.
const dynamic=node('Mokėjimas gautas'); nodes.push(dynamic);
i18n.apply('en');assert.equal(dynamic.nodeValue,'Payment received');
i18n.apply('es');assert.equal(dynamic.nodeValue,'Pago recibido');
i18n.apply('lt');assert.equal(dynamic.nodeValue,'Mokėjimas gautas');
// If a component replaces an existing text node the original source must refresh.
nodes[0].nodeValue='Refund';i18n.apply('es');assert.equal(nodes[0].nodeValue,'Reembolso');
i18n.apply('de');assert.equal(nodes[0].nodeValue,'Rückerstattung');
console.log('PASS: LT/EN/ES/DE/RU round trips, dynamic text, component edits and legal links');
