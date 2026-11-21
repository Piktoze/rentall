import {createEncryptedBundle} from './encrypted-backup-bundle.js';
export async function coordinatedEncryptedBackup({coordinator,db,uploads,output,publicKey,buildBundle=createEncryptedBundle}){
 return coordinator.snapshot(async token=>{
  if(!coordinator.verifyToken(token))throw Error('BACKUP_COORDINATOR_LEASE_REQUIRED');
  return buildBundle({db,uploads,output,publicKey,quiesced:true,coordinationProof:()=>coordinator.verifyToken(token)});
 });
}
