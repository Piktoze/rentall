(function migratePreRebrandStorage(){
  try{
    const legacyPrefix=['rent','all_'].join('');
    const currentPrefix='rentinorbit_';
    const keys=[];
    for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
    for(const key of keys){
      if(!key||!key.startsWith(legacyPrefix)) continue;
      const next=currentPrefix+key.slice(legacyPrefix.length);
      if(localStorage.getItem(next)==null) localStorage.setItem(next,localStorage.getItem(key));
      localStorage.removeItem(key);
    }
  }catch{}
})();
