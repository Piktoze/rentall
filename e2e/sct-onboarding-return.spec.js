import {test,expect} from '@playwright/test';
for(const width of [1280,390])test(`authenticated Stripe onboarding return opens supplier payout settings at ${width}px`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 try{
  await page.goto('/');await page.locator(width<700?'[data-v120-mobile="account"]':'#supplierAuthBtn').click();
  await page.locator('#loginEmail').fill(`journey-supplier-${width}@example.test`);await page.locator('#loginPassword').fill('SyntheticJourney123!');
  await page.locator('#supplierLoginForm button[type="submit"]').click();
  await expect.poll(async()=>{const r=await page.request.get('/api/auth/me');return(await r.json()).user?.role;}).toBe('supplier');
  await page.goto('/?view=supplier-payouts&stripe_onboarding=return');
  await expect(page.locator('#supplierPaymentsPanel')).toHaveClass(/open/);await expect(page.locator('#supplierPaymentsPanel')).toBeVisible();
  await expect.poll(()=>new URL(page.url()).searchParams.has('stripe_onboarding')).toBe(false);
 }finally{await context.close();}
});
