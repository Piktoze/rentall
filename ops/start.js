import {assertProductionConfig,assertProductionStorage,productionConfigReport} from '../config.js';

try{
  const config=assertProductionConfig();
  const storage=assertProductionStorage();
  console.log(JSON.stringify({
    type:'startup_preflight',
    environment:config.production?'production':'development',
    deployment:config.deployment,
    railway:config.railway,
    configurationReady:config.ready,
    storageReady:storage.ready,
    database:config.database,
    uploads:config.uploads,
    stripe:config.stripe,
    email:config.email,
    maps:config.maps,
    notifications:config.notifications
  }));
  await import('../server.js');
}catch(error){
  const report=productionConfigReport();
  console.error(JSON.stringify({
    type:'startup_blocked',
    code:String(error?.code||'STARTUP_FAILED'),
    blocking:Array.isArray(error?.blocking)?error.blocking:[],
    environment:report.production?'production':'development',
    deployment:report.deployment
  }));
  process.exit(1);
}
