import fs from 'node:fs';import path from 'node:path';
import {buildTestCommissionSamples} from '../modules/test-commission-samples.js';
const output=path.resolve(process.argv[2]||'output/pdf');if(output==='/data'||output.startsWith('/data/'))throw Error('TEST_OUTPUT_DATA_FORBIDDEN');fs.mkdirSync(output,{recursive:true});
const samples=await buildTestCommissionSamples();for(const kind of ['invoice','credit']){const file=path.join(output,samples[kind].number+'.pdf');fs.writeFileSync(file,samples[kind].pdf,{flag:'wx',mode:0o600});console.log(JSON.stringify({kind,number:samples[kind].number,file,bytes:samples[kind].pdf.length,realSeriesUsed:false}));}
