import {test,expect} from '@playwright/test';
import {buildTestCommissionSamples} from '../modules/test-commission-samples.js';
// UI/download regression only. Private-mode authorization is covered by the real HTTP suite.
// The normal CI server has the private-only examples disabled, so only these synthetic endpoints are fulfilled.
for(const width of [1280,390])test(`supplier TEST invoice and partial credit downloads at ${width}px`,async({browser})=>{
 const samples=await buildTestCommissionSamples(),context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true}),page=await context.newPage();
 try{
  await page.route('**/api/supplier/accounting/test-examples',route=>route.fulfill({json:{synthetic:true,realSeriesUsed:false,documents:[{kind:'invoice',url:'/api/supplier/accounting/test-examples/invoice.pdf'},{kind:'credit',url:'/api/supplier/accounting/test-examples/credit.pdf'}]}}));
  await page.route('**/api/supplier/accounting/test-examples/*.pdf',route=>{const kind=route.request().url().endsWith('credit.pdf')?'credit':'invoice';return route.fulfill({status:200,contentType:'application/pdf',headers:{'Content-Disposition':`attachment; filename="${samples[kind].number}.pdf"`},body:samples[kind].pdf});});
  await page.goto('/');await page.locator(width<700?'[data-v120-mobile="account"]':'#supplierAuthBtn').click();await page.locator('#loginEmail').fill(`journey-supplier-${width}@example.test`);await page.locator('#loginPassword').fill('SyntheticJourney123!');await page.locator('#supplierLoginForm button[type="submit"]').click();
  await expect.poll(async()=>{const r=await page.request.get('/api/auth/me');return (await r.json()).user?.role;}).toBe('supplier');
  await page.goto('/?view=supplier-payouts&stripe_onboarding=return');const section=page.locator('#rioTestDocumentSamples');await expect(section).toBeVisible();await expect(section.locator('a')).toHaveCount(2);
  for(const kind of ['invoice','credit']){const downloadPromise=page.waitForEvent('download');await section.locator(`a[href$="/${kind}.pdf"]`).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe(samples[kind].number+'.pdf');expect(await download.failure()).toBeNull();}
  expect(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }finally{await context.close();}
});
