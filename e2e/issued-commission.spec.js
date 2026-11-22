import {test,expect} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';
let gateCookie;
test.beforeAll(async({request})=>{
 const file=path.join(process.env.RIO_DOCUMENT_E2E_ROOT,'mail.json');fs.rmSync(file,{force:true});
 const challenge=await (await request.post('/__test-access/request',{data:{email:'gate@example.test'}})).json();
 await expect.poll(()=>fs.existsSync(file)).toBe(true);
 const code=JSON.parse(fs.readFileSync(file)).html.match(/<strong>(\d{8})<\/strong>/)[1];
 expect((await request.post('/__test-access/verify',{data:{challenge:challenge.challenge,code}})).ok()).toBeTruthy();
 gateCookie=(await request.storageState()).cookies.find(c=>c.name==='__Host-rio_test');expect(gateCookie.secure).toBe(true);
});
for(const width of [1280,390])test(`preloaded commercial archive, two credits, owner isolation and TEST segregation ${width}px`,async({browser})=>{
 const options={baseURL:'https://rentinorbit.test:34443',ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:'https://rentinorbit.test:34443'},viewport:{width,height:900},acceptDownloads:true};
 const owner=await browser.newContext(options),other=await browser.newContext(options),guest=await browser.newContext(options);
 try{
  for(const [context,role] of [[owner,'owner'],[other,'other']]){await context.addCookies([gateCookie]);expect((await context.request.post('/api/auth/login',{data:{email:`issued-${role}-${width}@example.test`,password:'SyntheticIssued123!'}})).ok()).toBeTruthy();}
  await guest.addCookies([gateCookie]);
  const page=await owner.newPage(),otherPage=await other.newPage();await page.goto('/?view=supplier-payouts');await otherPage.goto('/?view=supplier-payouts');
  const section=page.locator('#rioIssuedCommissionDocuments'),empty=otherPage.locator('#rioIssuedCommissionDocuments');
  await expect(section).toBeVisible();await expect(section).toContainText('SINTETINIAI');await expect(section.locator('a')).toHaveCount(3);
  await expect(section.locator('[data-issued-kind="credit"]')).toHaveCount(2);await expect(section).toContainText('Pradinė sąskaita: RIO-2099-');await expect(section).not.toContainText('TEST-RIO-');
  await expect(empty).toContainText('Išrašytų komisinio dokumentų dar nėra.');await expect(empty.locator('a')).toHaveCount(0);
  const data=await (await owner.request.get('/api/supplier/issued-commission-documents')).json();
  for(const doc of data.documents){expect(doc.number).toMatch(/^RIO-2099-/);expect((await other.request.get(doc.url)).status()).toBe(404);expect((await guest.request.get(doc.url)).status()).toBe(401);
   const pdfResponse=page.waitForResponse(r=>r.url().endsWith(doc.url)&&r.request().method()==='GET');const downloadPromise=page.waitForEvent('download',{timeout:10000}).catch(()=>null);await section.locator(`a[href="${doc.url}"]`).click();expect((await pdfResponse).status()).toBe(200);const download=await downloadPromise;expect(download).not.toBeNull();expect(download.suggestedFilename()).toBe('PREVIEW-'+doc.number+'.pdf');expect(await download.failure()).toBeNull();expect(fs.readFileSync(await download.path()).subarray(0,5).toString()).toBe('%PDF-');}
  // Existing TEST path remains independent and does not return commercial-shaped archive rows.
  const testData=await (await owner.request.get('/api/supplier/commission-documents')).json();expect(testData.testOnly).toBe(true);expect(testData.documents.every(d=>d.number.startsWith('TEST-RIO-'))).toBe(true);
  expect((await owner.request.post('/api/supplier/issued-commission-documents')).status()).toBe(404);
  expect(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await test.info().attach(`issued-documents-${width}`,{body:await section.screenshot(),contentType:'image/png'});
  await owner.request.post('/api/auth/logout');await page.reload();expect((await owner.request.get(data.documents[0].url)).status()).toBe(401);await expect(page.locator('#rioIssuedCommissionDocuments a')).toHaveCount(0);
 }finally{await Promise.allSettled([owner.close(),other.close(),guest.close()]);}
});
