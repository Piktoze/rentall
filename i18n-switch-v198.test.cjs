const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('modules/i18n-v161.js','utf8');
const storage=new Map([['rentinorbit_language','lt']]);

function element(markers={},text=''){
  const attrs={...markers};
  return {
    nodeType:1,textContent:text,innerHTML:text,dataset:{i18n:attrs['data-i18n']},
    matches(selector){
      if(selector==='a[href]')return false;
      const m=selector.match(/^\[([^\]]+)\]$/);return !!m&&Object.hasOwn(attrs,m[1]);
    },
    querySelectorAll(){return[]},
    getAttribute:name=>attrs[name]??null,
    setAttribute(name,value){attrs[name]=value},
    hasAttribute:name=>Object.hasOwn(attrs,name)
  };
}
function link(path){let href=path;return {nodeType:1,matches:q=>q==='a[href]',querySelectorAll(){return[]},getAttribute:n=>n==='href'?href:null,setAttribute:(n,v)=>{if(n==='href')href=v},url:()=>href};}
const keyed=element({'data-i18n':'nav_browse'},'Browse');
const owned=element({'data-i18n-text':'Cancel booking'},'Cancel booking');
const placeholder=element({'data-i18n-placeholder':'Write a message…','placeholder':'Write a message…'});
const userContent=element({},'Cancel booking');
const links=[link('/terms'),link('/privacy?tab=important#privacy'),link('/cookies'),link('/help')];
const all=[keyed,owned,placeholder,userContent,...links];
const selector={value:'lt',innerHTML:'',cloneNode(){return {...this,replaceWith(){},addEventListener(){}}},replaceWith(){},addEventListener(){}};
function matches(selector,node){return node.matches?.(selector)}
const document={
 readyState:'complete',documentElement:{lang:'lt'},title:'',
 body:{nodeType:1,querySelectorAll:q=>all.filter(n=>matches(q,n))},
 getElementById:id=>id==='lang'?selector:null,
 querySelector:s=>null,
 querySelectorAll:q=>all.filter(n=>matches(q,n)),
 addEventListener(){},dispatchEvent(){}
};
let mutationCallback;
class Observer{constructor(cb){mutationCallback=cb}observe(){}}
const ctx={window:{},document,navigator:{language:'lt-LT'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},MutationObserver:Observer,CustomEvent:class{constructor(n,v){this.name=n;this.detail=v.detail}},requestAnimationFrame:fn=>fn(),URLSearchParams,console};
vm.runInNewContext(source,ctx);
const i18n=ctx.window.RentInOrbitI18n;
for(const [lang,expected] of [['lt','Atšaukti rezervaciją'],['de','Buchung stornieren'],['en','Cancel booking'],['es','Cancelar reserva'],['ru','Отменить бронирование'],['lt','Atšaukti rezervaciją']]){
 i18n.apply(lang);
 assert.equal(owned.textContent,expected,`explicit text ${lang}`);
 assert.equal(document.documentElement.lang,lang);
 assert.ok(links.every(l=>l.url().includes('lang='+lang)),`legal links ${lang}`);
}
assert.equal(userContent.textContent,'Cancel booking','unmarked API/user content must never be translated');
assert.equal(keyed.innerHTML,'Naršyti');
assert.equal(placeholder.getAttribute('placeholder'),'Parašyk žinutę…');
assert.equal(links[1].url(),'/privacy?tab=important&lang=lt#privacy');

const dynamic=element({'data-i18n-text':'Payment received'},'Payment received');
mutationCallback([{type:'childList',addedNodes:[dynamic]}]);
assert.equal(dynamic.textContent,'Mokėjimas gautas','dynamic explicit node translated');
const dynamicUser=element({},'Payment received');
mutationCallback([{type:'childList',addedNodes:[dynamicUser]}]);
assert.equal(dynamicUser.textContent,'Payment received','dynamic unmarked content preserved');
console.log('PASS: explicit LT/DE/EN/ES/RU/LT pipeline, dynamic DOM, attributes, legal links and user-content isolation');
