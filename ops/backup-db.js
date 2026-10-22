import fs from'fs';import path from'path';
const db=process.env.DB_PATH||path.resolve('rentall.db'),dir=process.env.BACKUP_DIR||path.resolve('backups');
if(!fs.existsSync(db))throw new Error(`Database not found: ${db}`);
fs.mkdirSync(dir,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const out=path.join(dir,`rentall-${stamp}.db`);
fs.copyFileSync(db,out);const stat=fs.statSync(out);if(!stat.size)throw new Error('Backup is empty');
console.log(JSON.stringify({ok:true,backup:out,bytes:stat.size}));
