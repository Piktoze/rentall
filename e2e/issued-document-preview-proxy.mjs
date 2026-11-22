// Isolated CI adapter: preloads fixed archive rows before browsing, and authenticates
// the real issued-document router against the private app's actual session endpoint.
import express from 'express';import fs from 'node:fs';
import {prepareIssuedArchive} from './issued-document-records.mjs';
import {installIssuedCommissionDocuments} from '../modules/issued-commission-documents.js';
export async function prepareIssuedPreviewProxy({mailPath}){
 const origin='http://127.0.0.1:34444',publicOrigin='https://rentinorbit.test:34443';
 for(let i=0;i<200;i++){try{if((await fetch(origin+'/healthz')).status===200)break;}catch{}if(i===199)throw Error('PRIVATE_FIXTURE_START_TIMEOUT');await new Promise(r=>setTimeout(r,50));}
 fs.rmSync(mailPath,{force:true});
 const request=(url,body,cookie='')=>fetch(origin+url,{method:'POST',headers:{Origin:publicOrigin,'Content-Type':'application/json',cookie},body:JSON.stringify(body)});
 const challenge=await (await request('/__test-access/request',{email:'gate@example.test'})).json();
 for(let i=0;i<100&&!fs.existsSync(mailPath);i++)await new Promise(r=>setTimeout(r,20));
 const code=JSON.parse(fs.readFileSync(mailPath)).html.match(/<strong>(\d{8})<\/strong>/)[1];
 const verified=await request('/__test-access/verify',{challenge:challenge.challenge,code});if(verified.status!==200)throw Error('PRIVATE_FIXTURE_GATE_FAILED');
 const cookie=verified.headers.get('set-cookie').split(';')[0],owners=[];
 for(const width of [1280,390])for(const role of ['owner','other']){
  const r=await request('/api/auth/register',{email:`issued-${role}-${width}@example.test`,password:'SyntheticIssued123!',role:'supplier',termsAccepted:true},cookie);
  if(!r.ok)throw Error('PRELOADED_FIXTURE_ACCOUNT_FAILED');const {user}=await r.json();if(role==='owner')owners.push(user);
 }
 const archive=prepareIssuedArchive(owners),app=express();
 const requireRole=(...roles)=>async(req,res,next)=>{try{
  const r=await fetch(origin+'/api/auth/me',{headers:{cookie:req.headers.cookie||'',Accept:'application/json'}});if(!r.ok)return res.sendStatus(401);
  const {user}=await r.json();if(!user)return res.sendStatus(401);if(!roles.includes(user.role))return res.sendStatus(403);req.appUser=user;next();
 }catch{res.sendStatus(503);}};
 installIssuedCommissionDocuments(app,{enabled:()=>true,requireRole,getDb:()=>archive.db,preview:true});
 app.use((req,res)=>res.sendStatus(404));
 return {handle:app,cleanup:()=>archive.cleanup()};
}
