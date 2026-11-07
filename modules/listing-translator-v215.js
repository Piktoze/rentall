// V215: translate supplier-owned listing descriptions with on-device browser AI.
// No remote calls, no assumptions about the original language, no rewrites of
// legal terms, prices, reservation identifiers or editable supplier data.
(function(){
  const language=()=>window.RentInOrbitI18n?.getLanguage?.()||'lt';
  const labels={
    lt:{translate:'Versti skelbimą',original:'Originalo kalba',unavailable:'Vertimas šiame įrenginyje negalimas.'},
    en:{translate:'Translate listing',original:'Original language',unavailable:'Translation is unavailable on this device.'},
    es:{translate:'Traducir anuncio',original:'Idioma original',unavailable:'La traducción no está disponible en este dispositivo.'},
    de:{translate:'Inserat übersetzen',original:'Originalsprache',unavailable:'Übersetzung ist auf diesem Gerät nicht verfügbar.'},
    ru:{translate:'Перевести объявление',original:'Язык оригинала',unavailable:'Перевод на этом устройстве недоступен.'}
  };
  const cache=new Map();
  const supported=new Set(['lt','en','es','de','ru']);
  const current=()=>labels[language()]||labels.lt;
  const nativeTranslator=()=>window.Translator;
  async function detectLanguage(text){
    const detector=window.LanguageDetector;
    if(!detector?.availability)return null;
    try{
      const state=await detector.availability();
      if(state!=='available')return null;
      const instance=await detector.create();
      try{return (await instance.detect(text))?.[0]?.detectedLanguage||null}
      finally{instance.destroy?.()}
    }catch{return null}
  }
  async function translator(source,target,allowDownload){
    const Translator=nativeTranslator();
    if(!Translator?.availability)return null;
    const key=source+':'+target;
    if(cache.has(key))return cache.get(key);
    const opts={sourceLanguage:source,targetLanguage:target};
    try{
      const availability=await Translator.availability(opts);
      if(availability==='unavailable'||(!allowDownload&&availability!=='available'))return null;
      const instance=await Translator.create(opts);
      cache.set(key,instance);
      return instance;
    }catch{return null}
  }
  async function translateCard(card,allowDownload=false){
    const title=card.querySelector('h4[data-i18n-skip]');
    const desc=card.querySelector('p[data-i18n-skip]');
    if(!title)return;
    if(!card.dataset.originalListingTitle)card.dataset.originalListingTitle=title.textContent||'';
    if(desc&&!card.dataset.originalListingDescription)card.dataset.originalListingDescription=desc.textContent||'';
    const target=language(),original=card.dataset.originalListingTitle;
    title.textContent=original;
    if(desc)desc.textContent=card.dataset.originalListingDescription||'';
    card.dataset.rioTranslatedLang=target;
    let source=card.dataset.sourceLang;
    if(!supported.has(source))source=await detectLanguage(original+' '+(card.dataset.originalListingDescription||''));
    if(!card.isConnected||language()!==target)return;
    if(!supported.has(source)||source===target)return;
    const translatorInstance=await translator(source,target,allowDownload);
    if(!card.isConnected||language()!==target)return;
    const existing=card.querySelector('[data-translate-listing]');
    existing?.remove();
    if(!translatorInstance){
      if(!nativeTranslator()?.availability)return;
      const availability=await nativeTranslator().availability({sourceLanguage:source,targetLanguage:target}).catch(()=> 'unavailable');
      if(availability!=='downloadable'&&availability!=='downloading')return;
      const button=document.createElement('button');
      button.type='button';button.className='secondary rio-translate-listing';
      button.dataset.translateListing='true';button.textContent=current().translate;
      button.addEventListener('click',async()=>{button.disabled=true;await translateCard(card,true);button.disabled=false});
      card.appendChild(button);
      return;
    }
    try{
      const translatedTitle=await translatorInstance.translate(original);
      const translatedDescription=desc?.textContent?await translatorInstance.translate(card.dataset.originalListingDescription):'';
      if(!card.isConnected||language()!==target)return;
      title.textContent=translatedTitle;
      if(desc&&translatedDescription)desc.textContent=translatedDescription;
    }catch{/* Show supplier's original words if translation fails. */}
  }
  async function translateDetail(){
    const host=document.getElementById('listingDetailContent');
    if(!host||!host.querySelector('.v92-listing-main h2'))return;
    const title=host.querySelector('.v92-listing-main h2');
    const description=host.querySelector('.v92-description');
    if(!host.dataset.rioOriginalTitle)host.dataset.rioOriginalTitle=title.textContent||'';
    if(description&&!host.dataset.rioOriginalDescription)host.dataset.rioOriginalDescription=description.textContent||'';
    const original=host.dataset.rioOriginalTitle,target=language();
    title.textContent=original;
    if(description)description.textContent=host.dataset.rioOriginalDescription||'';
    let source=host.dataset.sourceLang;
    if(!supported.has(source))source=await detectLanguage(original+' '+(host.dataset.rioOriginalDescription||''));
    if(!host.isConnected||language()!==target||source===target||!supported.has(source))return;
    const model=await translator(source,target,false);
    if(!model||language()!==target)return;
    try{
      const titleValue=await model.translate(original);
      const descriptionValue=description?.textContent?await model.translate(host.dataset.rioOriginalDescription):'';
      if(language()!==target)return;
      title.textContent=titleValue;
      if(description&&descriptionValue)description.textContent=descriptionValue;
    }catch{}
  }
  function update(){
    for(const card of document.querySelectorAll('#listingPreviewGrid .listing-card[data-listing-id]')){
      if(card.dataset.rioTranslatedLang===language())continue;
      card.dataset.rioTranslatedLang=language();
      translateCard(card).catch(()=>{});
    }
  }
  document.addEventListener('rentinorbit:language-changed',()=>{
    for(const card of document.querySelectorAll('#listingPreviewGrid .listing-card')){
      card.dataset.rioTranslatedLang='';
      card.querySelector('[data-translate-listing]')?.remove();
    }
    update();
    translateDetail().catch(()=>{});
  });
  function init(){
    const grid=document.getElementById('listingPreviewGrid');
    if(!grid)return;
    const observer=new MutationObserver(()=>{queueMicrotask(update)});
    observer.observe(grid,{childList:true,subtree:false});
    const details=document.getElementById('listingDetailContent');
    if(details){
      const detailObserver=new MutationObserver(records=>{
        if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&n.matches?.('.v92-listing-layout')))){
          delete details.dataset.rioOriginalTitle;
          delete details.dataset.rioOriginalDescription;
          translateDetail().catch(()=>{});
        }
      });
      detailObserver.observe(details,{childList:true,subtree:false});
    }
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();