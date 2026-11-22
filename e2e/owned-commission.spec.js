import {test,expect} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';
let gateCookie;
// Obtain one real OTP gate session; independent contexts then have separate app identities.
test.beforeAll(async({request})=>{
 const challenge=await (await request.post('/__test-access/request',{data:{email:'gate@example.test'}})).json();
 const file=path.join(process.env.RIO_DOCUMENT_E2E_ROOT,'mail.json');
 await expect.poll(()=>fs.existsSync(file)).toBe(true);
 const code=JSON.parse(fs.readFileSync(file)).html.match(/<strong>(\d{8})<\/strong>/)[1];
 const response=await request.post('/__test-access/verify',{data:{challenge:challenge.challenge,code}});expect(response.ok()).toBeTruthy();
 gateCookie=(await request.storageState()).cookies.find(c=>c.name==='__Host-rio_test');
 if(!gateCookie)gateCookie=(await request.storageState()).cookies[0];
 expect(gateCookie.secure).toBe(true);
});
for(const width of [1280,390])test(`own order invoice and credit, empty state and owner isolation ${width}px`,async({browser})=>{
 const owner=await browser.newContext({baseURL:'https://rentinorbit.test:34443',ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:'https://rentinorbit.test:34443'},viewport:{width,height:900},acceptDownloads:true});
 const other=await browser.newContext({baseURL:'https://rentinorbit.test:34443',ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:'https://rentinorbit.test:34443'},viewport:{width,height:900}});
 const guest=await browser.newContext({baseURL:'https://rentinorbit.test:34443',ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:'https://rentinorbit.test:34443'},viewport:{width,height:900}});
 try{
  for(const [context,role] of [[owner,'owner'],[other,'other']]){await context.addCookies([gateCookie]);const registration=await context.request.post('/api/auth/register',{data:{email:`docs-${role}-${width}@example.test`,password:'SyntheticDocuments123!',role:'supplier',termsAccepted:true}});expect(registration.ok()).toBeTruthy();}
  await guest.addCookies([gateCookie]); // Private gate passed, still no app login.
  const page=await owner.newPage(),otherPage=await other.newPage();await page.goto('/?view=supplier-payouts');await otherPage.goto('/?view=supplier-payouts');
  const section=page.locator('#rioOwnedCommissionDocuments'),otherSection=otherPage.locator('#rioOwnedCommissionDocuments');
  await expect(section).toBeVisible();await expect(section).toContainText('Komisinio dokumentų dar nėra.');await expect(section.locator('a')).toHaveCount(0);
  await expect(otherSection).toContainText('Komisinio dokumentų dar nėra.');
  await section.getByRole('button',{name:'Sukurti mano sintetinį užbaigtą TEST užsakymą'}).click();
  await expect(section.locator('[data-commission-booking]')).toHaveCount(1);await expect(section.locator('a')).toHaveCount(2);
  const cards=section.locator('[data-commission-booking]');await expect(cards).toContainText('TEST-ORDER-');await expect(cards).toContainText('Pradinė sąskaita: TEST-RIO-');await expect(cards).toContainText('15,00');await expect(cards).toContainText('−5,00');
  const urls=await section.locator('a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  for(const url of urls){
   expect((await other.request.get(url)).status()).toBe(404);expect((await guest.request.get(url)).status()).toBe(401);
   const link=section.locator(`a[href="${url}"]`),downloadPromise=page.waitForEvent('download');await link.click();const download=await downloadPromise;
   expect(download.suggestedFilename()).toMatch(/^TEST-RIO-\d{4}-\d{6}\.pdf$/);expect(await download.failure()).toBeNull();
   const file=await download.path();expect(fs.readFileSync(file).subarray(0,5).toString()).toBe('%PDF-');
  }
  await expect(otherSection.locator('a')).toHaveCount(0);const guestPage=await guest.newPage();await guestPage.goto('/?view=supplier-payouts');await expect(guestPage.locator('#rioOwnedCommissionDocuments a')).toHaveCount(0);
  await section.getByRole('button').click();await expect(section.locator('[data-commission-booking]')).toHaveCount(1);await expect(section.locator('a')).toHaveCount(2);
  expect(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await owner.request.post('/api/auth/logout');await page.reload();expect((await owner.request.get(urls[0])).status()).toBe(401);
  await expect(page.locator('#rioOwnedCommissionDocuments a')).toHaveCount(0);
 }finally{await owner.close();await other.close();await guest.close();}
});
