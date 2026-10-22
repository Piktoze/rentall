import {defineRailway,github,preserve,project,service,volume} from 'railway/iac';

export default defineRailway(()=>{
  const data=volume('rentall-data',{
    region:'europe-west4',
    sizeMB:1024
  });

  const web=service('rentall',{
    source:github('Piktoze/rentall',{branch:'main'}),
    build:'npm ci --omit=dev',
    start:'npm start',
    healthcheck:'/api/readiness',
    healthcheckTimeout:120,
    replicas:{'europe-west4':1},
    volumeMounts:{'/data':data},
    env:{
      NODE_ENV:'production',
      RENTALL_DB_PATH:'/data/rentall.sqlite',
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
      EMAIL_PROVIDER:'resend',
      EMAIL_FROM:preserve(),
      RESEND_API_KEY:preserve(),
      EMAIL_WORKER_ENABLED:'true',
      EMAIL_WORKER_TOKEN:preserve(),
      SUPPORT_EMAIL:preserve(),
      MAPS_PROVIDER:'stub',
      SMS_PROVIDER:'disabled',
      PUSH_PROVIDER:'disabled'
    }
  });

  return project('rentall',{resources:[web,data]});
});
