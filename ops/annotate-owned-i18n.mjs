import fs from 'node:fs';

const file=new URL('../index.html',import.meta.url);
const i18n=fs.readFileSync(new URL('../modules/i18n-v161.js',import.meta.url),'utf8');
const match=i18n.match(/const dictionaries=(\{.*?\});\n  const meta=/s);
if(!match)throw new Error('Could not read translation dictionary');
const dictionaries=JSON.parse(match[1]);
const phrases=new Set(Object.keys(dictionaries.lt));
const source=fs.readFileSync(file,'utf8');
const lineStarts=[0];
for(let i=0;i<source.length;i++)if(source[i]==='\n')lineStarts.push(i+1);
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;');
const protectedToken=/(?:data-i18n-skip|contenteditable\s*=|\b(?:message-body|chat-message|booking-message|listing-user-description|listing-title|listing-description|supplier-description|user-content|review-text|address-value|city-value)\b)/i;
const deniedText=/^(?:LT|EN|ES|DE|RU|Vilnius|Kaunas|Klaipėda|Šiauliai|Panevėžys)$/i;
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const skipTags=new Set(['script','style','textarea','code','pre','option']);
const stack=[];
const edits=[];
const tokenPattern=/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+/g;
let token;
while((token=tokenPattern.exec(source))){
  const raw=token[0];
  if(raw.startsWith('<!--')||raw.startsWith('<!'))continue;
  if(raw.startsWith('</')){
    const frame=stack.pop();
    if(!frame||frame.protected||frame.hasChild||frame.texts.length!==1)continue;
    const text=frame.texts[0].trim();
    if(!text||deniedText.test(text)||!phrases.has(text)||/\bdata-i18n(?:-text)?\s*=/.test(frame.raw))continue;
    edits.push({at:frame.start+frame.raw.length-1,text:` data-i18n-text="${escape(text)}"`});
    continue;
  }
  if(raw.startsWith('<')){
    const tag=raw.match(/^<\s*([A-Za-z0-9-]+)/)?.[1]?.toLowerCase();
    if(!tag)continue;
    if(stack.length)stack.at(-1).hasChild=true;
    const inherited=stack.some(frame=>frame.protected);
    const isProtected=inherited||skipTags.has(tag)||protectedToken.test(raw);
    for(const [marker,attr] of [['data-i18n-placeholder','placeholder'],['data-i18n-aria-label','aria-label'],['data-i18n-title','title']]){
      if(isProtected||new RegExp(`\\b${marker}\\s*=`).test(raw))continue;
      const value=raw.match(new RegExp(`\\b${attr}="([^"]+)"`))?.[1]?.replaceAll('&quot;','"').replaceAll('&amp;','&');
      if(value&&phrases.has(value)&&!deniedText.test(value))edits.push({at:token.index+raw.length-1,text:` ${marker}="${escape(value)}"`});
    }
    if(!voidTags.has(tag)&&!raw.endsWith('/>'))stack.push({tag,start:token.index,raw,protected:isProtected,hasChild:false,texts:[]});
    continue;
  }
  if(stack.length&&raw.trim())stack.at(-1).texts.push(raw);
}
edits.sort((a,b)=>b.at-a.at);
let output=source;
for(const edit of edits)output=output.slice(0,edit.at)+edit.text+output.slice(edit.at);
fs.writeFileSync(file,output);
console.log(`Annotated ${edits.length} application-owned i18n nodes/attributes`);
