import {productionConfigReport,productionStorageReport} from '../config.js';

const report=productionConfigReport();
const storage=productionStorageReport();
console.log(JSON.stringify({configuration:report,storage},null,2));
if(!report.production||!report.ready||!storage.ready)process.exitCode=1;
