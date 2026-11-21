// Run on the operator's own computer with existing S3 read credentials in environment.
// The decryption private key is never uploaded to Railway or the bucket.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {createBackupS3,downloadBackupObject} from './backup-s3.js';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>i%2?a:[...a,[x.replace(/^--/,''),all[i+1]]],[]));
if(args['generate-keypair']){
 const folder=path.resolve(args['generate-keypair']);fs.mkdirSync(folder,{recursive:true,mode:0o700});
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 fs.writeFileSync(path.join(folder,'private.pem'),privateKey,{flag:'wx',mode:0o600});fs.writeFileSync(path.join(folder,'public.pem'),publicKey,{flag:'wx',mode:0o644});
 console.log('Created local private.pem and public.pem. Keep private.pem outside Railway.');
}else{
 if(!args.key||!args.output||!args.key.startsWith('bundles-v1/'))throw Error('Use --key bundles-v1/... --output /local/path/bundle.enc');
 const {client,bucket}=createBackupS3();try{await downloadBackupObject(client,bucket,args.key,path.resolve(args.output));console.log('Encrypted backup downloaded; no private key was transmitted.');}finally{client.destroy();}
}
