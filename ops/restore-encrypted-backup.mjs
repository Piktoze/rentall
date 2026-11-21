import fs from 'node:fs';import {restoreEncryptedBundle} from '../modules/encrypted-backup-bundle.js';
const argv=process.argv.slice(2),args={};for(let i=0;i<argv.length;i+=2)args[argv[i].replace(/^--/,'')]=argv[i+1];
if(!args.bundle||!args['private-key']||!args.target)throw Error('Use --bundle file.enc --private-key private.pem --target NEW_FOLDER');
const result=await restoreEncryptedBundle({bundle:args.bundle,privateKey:fs.readFileSync(args['private-key']),target:args.target});
console.log(JSON.stringify({restored:true,fileCount:result.fileCount}));
