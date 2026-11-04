import {bucket,defineRailway,github,preserve,project,ref,service,volume} from 'railway/iac';

export default defineRailway((ctx)=>{
  const staging=ctx.isEnvironment('staging');
  const data=volume('rentall-volume',{
    region:'iad',
    sizeMB:500
  });
  const backups=staging?bucket('rentinorbit-staging-backups',{
    region:'iad',
  }):null;

  const web=service('rentall',{
    source:github('Piktoze/rentall',{branch:staging?'staging/v203':'main'}),
    build:'node --check server.js && node --check db.js && node --check app.js && node release/rc-gate.js',
    start:'npm start',
    healthcheck:'/api/readiness',
    healthcheckTimeout:120,
    replicas:{iad:1},
    volumeMounts:{'/data':data},
    env:{
      NODE_ENV:'production',
      DB_PATH:preserve(),
      RENTINORBIT_DB_PATH:'/data/rentinorbit.sqlite',
      UPLOADS_DIR:'/data/uploads',
      TRUST_PROXY_HOPS:'1',
      APP_URL:preserve(),
      PUBLIC_BASE_URL:preserve(),
      SESSION_SECRET:preserve(),
      STRIPE_MODE:preserve(),
      STRIPE_SECRET_KEY:preserve(),
      STRIPE_PUBLISHABLE_KEY:preserve(),
      STRIPE_WEBHOOK_SECRET:preserve(),
      STRIPE_CONNECT_V2_PROVISIONING:preserve(),
      STRIPE_CONNECT_PREVIEW_API_VERSION:preserve(),
      STRIPE_CONNECT_V2_VERSION:preserve(),
      EMAIL_PROVIDER:'resend',
      EMAIL_FROM:preserve(),
      RESEND_API_KEY:preserve(),
      EMAIL_WORKER_ENABLED:'true',
      EMAIL_WORKER_TOKEN:preserve(),
      SUPPORT_EMAIL:preserve(),
      MAPS_PROVIDER:'stub',
      SMS_PROVIDER:'disabled',
      PUSH_PROVIDER:'disabled',
      NODE_OPTIONS:preserve(),
      PLATFORM_FEE_PERCENT:preserve(),
      RAILPACK_NODE_VERSION:preserve(),
      RENTALL_SECURITY_DEPOSITS_ENABLED:preserve(),
      RENTALL_SEED_DEMO_USERS:preserve(),
      RENTINORBIT_DEMO_PAYMENTS:preserve(),
      RENTINORBIT_STAGING:preserve(),
      STAGING_HOTFIX_REV:preserve(),
      STAGING_PATCH_1:preserve(),
      STAGING_PATCH_2:preserve(),
      STAGING_PATCH_3:preserve(),
      STAGING_PATCH_4:preserve(),
      STAGING_PATCH_5:preserve(),
      STAGING_PATCH_CANCEL_EMAIL:preserve(),
      STAGING_PATCH_CANCEL_UI_REFRESH:preserve(),
      STAGING_PATCH_CONFIRMED_EMAIL:preserve(),
      STAGING_PATCH_CUSTOMER_PAY_DEEPLINK:preserve(),
      STAGING_PATCH_CUSTOMER_PAY_INLINE:preserve(),
      STAGING_PATCH_DIAG:preserve(),
      STAGING_PATCH_EMAIL_RETRY:preserve(),
      STAGING_PATCH_I18N_DYNAMIC:preserve(),
      STAGING_PATCH_JSON:preserve(),
      STAGING_PATCH_LIFECYCLE_GUARDS:preserve(),
      STAGING_PATCH_PICKUP_SERVER:preserve(),
      STAGING_PATCH_POSTPAYMENT_EMAIL:preserve(),
      STAGING_PATCH_SUPPLIER_DEEPLINK:preserve(),
      STAGING_PATCH_SUPPLIER_EMAIL_ESCAPE:preserve(),
      STAGING_PATCH_TERMINAL_PAYMENT_GUARD:preserve(),
      STAGING_SUPPLIER_FIRST_PATCH_B64:preserve(),
      ...(staging?{
        APP_VERSION:'v203-staging',
        DB_BACKUP_ENABLED:'true',
        DB_BACKUP_MAX_AGE_HOURS:'12',
        DB_BACKUP_EVIDENCE_PATH:'/tmp/rentinorbit-backups/last-verified-backup.json',
        BACKUP_DIR:'/tmp/rentinorbit-backups',
        BACKUP_SCHEDULER_ENABLED:'true',
        BACKUP_INTERVAL_HOURS:'6',
        BACKUP_RETENTION_COUNT:'28',
        BACKUP_S3_ENABLED:'true',
        BACKUP_S3_ACCESS_KEY_ID:ref(backups,'accessKeyId'),
        BACKUP_S3_SECRET_ACCESS_KEY:ref(backups,'secretAccessKey'),
        BACKUP_S3_BUCKET:ref(backups,'bucketName'),
        BACKUP_S3_ENDPOINT:ref(backups,'endpoint'),
        BACKUP_S3_REGION:ref(backups,'region'),
        BACKUP_S3_URL_STYLE:ref(backups,'urlStyle')
      }:{})
    }
  });

  return project('nurturing-strength',{resources:[web,data,...(backups?[backups]:[])]});
});
