import {test,expect} from '@playwright/test';
test.describe('Stripe test-mode launch gate',()=>{
 test.skip(!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET,'Stripe test credentials required');
 test('server reports payments configured and launch endpoint is reachable',async({request})=>{
   const cfg=await request.get('/api/runtime-config');expect(cfg.ok()).toBeTruthy();
   const body=await cfg.json();expect(body.paymentsConfigured).toBeTruthy();
   const gate=await request.get('/api/launch-readiness');expect([200,503]).toContain(gate.status());
 });
});
