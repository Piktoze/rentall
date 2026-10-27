import {databaseRuntime,checkDatabase,closeDatabase,REQUIRED_SCHEMA_VERSION} from '../db.js';

const check=checkDatabase();
if(!check.ok||check.migrationVersion<REQUIRED_SCHEMA_VERSION){
  console.error(JSON.stringify({ok:false,error:'Database initialization failed',driver:check.driver,source:check.source,migrationVersion:check.migrationVersion}));
  process.exitCode=1;
}else{
  console.log(JSON.stringify({ok:true,driver:databaseRuntime.driver,source:databaseRuntime.source,persistent:databaseRuntime.persistent,migrationVersion:check.migrationVersion}));
}
closeDatabase();
