// Streaming DB+uploads bundle. No default database path; caller must supply a quiesced source.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {pipeline} from 'node:stream/promises';import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';
const magic=Buffer.from('RIOBKP1\n');
export const sha256File=async file=>{const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');};
function files(root,prefix=''){const out=[];for(const e of fs.readdirSync(root,{withFileTypes:true})){if(!/^[A-Za-z0-9._-]+$/.test(e.name)||e.name==='..'||e.name==='.')throw Error('BACKUP_UNSAFE_FILENAME');const relative=path.posix.join(prefix,e.name);if(e.isSymbolicLink())throw Error('BACKUP_SYMLINK_FORBIDDEN');if(e.isDirectory())out.push(...files(path.join(root,e.name),relative));else if(e.isFile())out.push(relative);else throw Error('BACKUP_UNSUPPORTED_FILE');}return out.sort();}
export async function createEncryptedBundle({db,uploads,output,publicKey,quiesced,coordinationProof}){
 if(fs.lstatSync(uploads).isSymbolicLink())throw Error('BACKUP_SOURCE_SYMLINK');
 if(quiesced!==true||!db?.backup||!path.isAbsolute(uploads))throw Error('BACKUP_QUIESCED_EXPLICIT_SOURCE_REQUIRED');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-bundle-'));let child;
 try{
  if(coordinationProof&&!coordinationProof())throw Error('BACKUP_COORDINATION_LOST');
  await db.backup(path.join(root,'database.sqlite'));fs.chmodSync(path.join(root,'database.sqlite'),0o600);fs.mkdirSync(path.join(root,'uploads'),{mode:0o700});
  const manifest={version:1,createdAt:new Date().toISOString(),files:[]};
  for(const relative of files(uploads)){
   if(coordinationProof&&!coordinationProof())throw Error('BACKUP_COORDINATION_LOST');
   const source=path.join(uploads,relative),target=path.join(root,'uploads',relative),before=await sha256File(source);
   fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.copyFileSync(source,target);fs.chmodSync(target,0o600);
   if(before!==await sha256File(source)||before!==await sha256File(target))throw Error('BACKUP_SOURCE_CHANGED');
   manifest.files.push({path:'uploads/'+relative,sha256:before,bytes:fs.statSync(target).size});
  }
  manifest.files.push({path:'database.sqlite',sha256:await sha256File(path.join(root,'database.sqlite')),bytes:fs.statSync(path.join(root,'database.sqlite')).size});
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest),{mode:0o600});
  const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),wrapped=crypto.publicEncrypt({key:publicKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},key);
  const header=Buffer.from(JSON.stringify({version:1,cipher:'aes-256-gcm',wrap:'rsa-oaep-sha256',iv:iv.toString('base64'),wrappedKey:wrapped.toString('base64')})),len=Buffer.alloc(4);len.writeUInt32BE(header.length);
  fs.writeFileSync(output,Buffer.concat([magic,len,header]),{flag:'wx',mode:0o600});
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.concat([magic,len,header]));
  child=spawn('tar',['-czf','-','-C',root,'manifest.json','database.sqlite','uploads'],{stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',x=>error+=x);const completed=once(child,'close');
  await pipeline(child.stdout,cipher,fs.createWriteStream(output,{flags:'a'}));const [code]=await completed;if(code!==0)throw Error('BACKUP_TAR_FAILED');
  fs.appendFileSync(output,cipher.getAuthTag());key.fill(0);
  return {sha256:await sha256File(output),bytes:fs.statSync(output).size,fileCount:manifest.files.length};
 }catch(e){child?.kill('SIGKILL');fs.rmSync(output,{force:true});throw e;}
 finally{fs.rmSync(root,{recursive:true,force:true});}
}
export async function restoreEncryptedBundle({bundle,privateKey,target}){
 const resolved=path.resolve(target);let current=path.parse(resolved).root;for(const segment of resolved.slice(current.length).split(path.sep)){current=path.join(current,segment);try{if(fs.lstatSync(current).isSymbolicLink())throw Error('BACKUP_RESTORE_SYMLINK');}catch(e){if(e.code!=='ENOENT')throw e;}}if(resolved==='/data'||resolved.startsWith('/data/'))throw Error('BACKUP_RESTORE_DATA_FORBIDDEN');
 if(fs.existsSync(resolved))throw Error('BACKUP_RESTORE_FRESH_TARGET_REQUIRED');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-unbundle-')),archive=path.join(root,'bundle.tar.gz');
 try{
  const fd=fs.openSync(bundle,'r'),prefix=Buffer.alloc(12);fs.readSync(fd,prefix,0,12,0);
  if(!prefix.subarray(0,8).equals(magic))throw Error('BACKUP_FORMAT_INVALID');const n=prefix.readUInt32BE(8);if(n<1||n>65536)throw Error('BACKUP_HEADER_INVALID');
  const header=Buffer.alloc(n);fs.readSync(fd,header,0,n,12);const size=fs.fstatSync(fd).size,tag=Buffer.alloc(16);if(size<=28+n)throw Error('BACKUP_TRUNCATED');fs.readSync(fd,tag,0,16,size-16);fs.closeSync(fd);
  const meta=JSON.parse(header);if(meta.version!==1||meta.cipher!=='aes-256-gcm'||meta.wrap!=='rsa-oaep-sha256')throw Error('BACKUP_ALGORITHM_INVALID');
  const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(meta.wrappedKey,'base64'));
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(meta.iv,'base64'));decipher.setAAD(Buffer.concat([prefix,header]));decipher.setAuthTag(tag);
  await pipeline(fs.createReadStream(bundle,{start:12+n,end:size-17}),decipher,fs.createWriteStream(archive,{flags:'wx',mode:0o600}));key.fill(0);
  // Authentication completes BEFORE tar may create any restored file.
  const listing=spawnSync('tar',['-tzf',archive],{encoding:'utf8'}),types=spawnSync('tar',['-tvzf',archive],{encoding:'utf8'});
  if(listing.status!==0||types.status!==0||types.stdout.split('\n').filter(Boolean).some(x=>!['-','d'].includes(x[0])))throw Error('BACKUP_ARCHIVE_INVALID');
  for(const item of listing.stdout.split('\n').filter(Boolean))if(!/^(manifest\.json|database\.sqlite|uploads\/?|uploads\/[A-Za-z0-9._/-]+)$/.test(item)||item.split('/').includes('..'))throw Error('BACKUP_ARCHIVE_PATH_INVALID');
  fs.mkdirSync(resolved,{mode:0o700});const extraction=spawnSync('tar',['-xzf',archive,'--no-same-owner','--no-same-permissions','-C',resolved]);if(extraction.status!==0)throw Error('BACKUP_EXTRACTION_FAILED');
  const manifest=JSON.parse(fs.readFileSync(path.join(resolved,'manifest.json'),'utf8'));
  if(manifest.version!==1||!Array.isArray(manifest.files))throw Error('BACKUP_MANIFEST_INVALID');
  const actual=files(resolved).filter(x=>x!=='manifest.json').sort(),expected=manifest.files.map(x=>x.path).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('BACKUP_MANIFEST_FILES_MISMATCH');
  for(const f of manifest.files)if(fs.statSync(path.join(resolved,f.path)).size!==f.bytes||await sha256File(path.join(resolved,f.path))!==f.sha256)throw Error('BACKUP_FILE_HASH_MISMATCH');
  return {fileCount:manifest.files.length,manifest};
 }catch(e){fs.rmSync(resolved,{recursive:true,force:true});throw e;}
 finally{fs.rmSync(root,{recursive:true,force:true});}
}
