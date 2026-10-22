import {productionConfigReport} from '../config.js';

const report=productionConfigReport();
console.log(JSON.stringify(report,null,2));
if(!report.production||!report.ready)process.exitCode=1;
