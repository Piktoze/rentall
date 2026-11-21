import fs from 'node:fs';
// Read filesystem capacity metadata only. Never lists/opens/modifies /data files.
export function stagingCapacityReview(env=process.env,statfs=fs.statfsSync){
 if(env.RAILWAY_PROJECT_ID!=='a9cc79be-565a-4b5b-a237-09d91977f68b'||env.RAILWAY_ENVIRONMENT_ID!=='ca5aa000-83a9-40b9-b9b6-74b3602f3dde'||env.RAILWAY_SERVICE_ID!=='dc5bb7ad-5e0c-4c52-81b1-4fe9700f7b77')return null;
 const s=statfs('/data');return {type:'staging_volume_capacity_review',mount:'/data',readOnly:true,capacityBytes:Number(s.blocks)*Number(s.bsize),availableBytes:Number(s.bavail)*Number(s.bsize),freeBytes:Number(s.bfree)*Number(s.bsize),legacySchedulerEnabled:env.BACKUP_SCHEDULER_ENABLED==='true',encryptedSchedulerEnabled:env.ENCRYPTED_BACKUP_SCHEDULER_ENABLED==='true'};
}
