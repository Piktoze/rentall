import {AsyncLocalStorage} from 'node:async_hooks';
// One Node writer process. All HTTP handlers and background writers share this admission gate.
export function createBackupWriteCoordinator(){
 const context=new AsyncLocalStorage();let paused=false,pending=false,active=0;
 let idleWaiters=[],admission=[];const capabilities=new WeakSet();
 const idle=()=>{if(active===0){for(const r of idleWaiters.splice(0))r();}};
 async function acquire(){
  while(pending||paused)await new Promise(resolve=>admission.push(resolve));
  active++;let released=false;
  return ()=>{if(released)return;released=true;active--;idle();};
 }
 async function writer(fn,trackNested=false){
  const parent=context.getStore()?.active;
  if(parent&&!trackNested)return fn();
  let release;if(parent){active++;let done=false;release=()=>{if(!done){done=true;active--;idle();}};}else release=await acquire();
  const lease={active:true};
  try{return await context.run(lease,fn);}finally{lease.active=false;release();}
 }
 function assertWritable(){if(paused)throw Object.assign(Error('BACKUP_WRITES_PAUSED'),{code:'BACKUP_WRITES_PAUSED'});}
 async function snapshot(fn,{drainTimeoutMs=60000}={}){
  if(context.getStore()?.active)throw Error('BACKUP_CANNOT_START_INSIDE_WRITER');
  if(pending||paused)throw Error('BACKUP_ALREADY_RUNNING');pending=true;
  try{
   if(active){let timer,notify;try{await Promise.race([new Promise(resolve=>{notify=resolve;idleWaiters.push(notify);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('BACKUP_DRAIN_TIMEOUT')),drainTimeoutMs);timer.unref?.();})]);}finally{clearTimeout(timer);idleWaiters=idleWaiters.filter(x=>x!==notify);}}
   paused=true;const token=Object.freeze({});capabilities.add(token);
   try{return await fn(token);}finally{capabilities.delete(token);}
  }finally{paused=false;pending=false;for(const r of admission.splice(0))r();}
 }
 function http(){return async(req,res,next)=>{
  // Health is read-only, keeping probes responsive during a backup.
  if(req.path==='/healthz')return next();
  const release=await acquire(),lease={active:true};let done=false;
  const finish=()=>{if(done)return;done=true;lease.active=false;release();};
  res.once('finish',finish);res.once('close',finish);
  if(req.destroyed){finish();return;}
  context.run(lease,next);
 };}
 function guardRoutes(app){
  for(const method of ['get','post','put','patch','delete','head','options']){const original=app[method].bind(app);app[method]=(...args)=>{
   if(args.length<2)return original(...args);
   const wrap=fn=>Array.isArray(fn)?fn.map(wrap):typeof fn!=='function'||fn.length===4?fn:function(req,res,next){
    if(req.path==='/healthz')return fn.call(this,req,res,next);
    writer(()=>fn.call(this,req,res,next),true).catch(next);
   };return original(args[0],...args.slice(1).map(wrap));
  };}return app;
 }
 function guardDatabase(db){
  const prepare=db.prepare.bind(db),exec=db.exec.bind(db),transaction=db.transaction.bind(db),pragma=db.pragma.bind(db);
  db.prepare=(...args)=>{const statement=prepare(...args);if(!statement.readonly){
   for(const method of ['run','get','all']){const fn=statement[method].bind(statement);statement[method]=(...params)=>{assertWritable();return fn(...params);};}
   const iterate=statement.iterate.bind(statement);statement.iterate=(...params)=>{assertWritable();const iterator=iterate(...params),next=iterator.next.bind(iterator);iterator.next=(...x)=>{assertWritable();return next(...x);};return iterator;};
  }return statement;};
  db.exec=(...args)=>{assertWritable();return exec(...args);};
  db.pragma=(...args)=>{assertWritable();return pragma(...args);};
  db.transaction=fn=>{const tx=transaction(fn),wrapped=(...args)=>{assertWritable();return tx(...args);};for(const k of ['deferred','immediate','exclusive'])wrapped[k]=(...args)=>{assertWritable();return tx[k](...args);};return wrapped;};
  return db;
 }
 return {writer,snapshot,http,guardRoutes,assertWritable,guardDatabase,verifyToken:token=>paused&&active===0&&capabilities.has(token),state:()=>({active,paused,pending,waiting:admission.length})};
}
export const backupWrites=createBackupWriteCoordinator();
