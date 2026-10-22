import {databaseRuntime,checkDatabase,closeDatabase} from '../db.js';

const check=checkDatabase();
if(!check.ok||check.migrationVersion<146){
  console.error(JSON.stringify({ok:false,error:'Database initialization failed',driver:check.driver,source:check.source,migrationVersion:check.migrationVersion}));
  process.exitCode=1;
}else{
  console.log(JSON.stringify({ok:true,driver:databaseRuntime.driver,source:databaseRuntime.source,persistent:databaseRuntime.persistent,migrationVersion:check.migrationVersion}));
}
closeDatabase();
