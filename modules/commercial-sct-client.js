import Stripe from 'stripe';
const clients=new WeakMap();
// Construction does not perform HTTP or enable payments. No automatic key discovery.
export function createCommercialStripeClient(key){
 if(typeof key!=='string'||!/^[sr]k_live_[A-Za-z0-9_-]{8,}$/.test(key))throw new Error('COMMERCIAL_LIVE_SECRET_KEY_REQUIRED');
 const stripe=new Stripe(key,{maxNetworkRetries:0,timeout:20000});clients.set(stripe,key);return stripe;
}
export const isCommercialStripeClient=(stripe,key)=>clients.has(stripe)&&clients.get(stripe)===key;
