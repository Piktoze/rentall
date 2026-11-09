// Safe browser UI test: simulated session and privacy API; no staging database writes.
import {test,expect} from '@playwright/test';

const user={userId:'test-user',email:'customer@example.test',role:'customer'};
const admin={userId:'admin-test',email:'admin@example.test',role:'admin'};
const request={requestId:'dsr_12345678-1234-1234-1234-123456789abc',type:'access',
  status:'received',createdAt:'2026-11-09 10:00:00',dueAt:'2026-12-09 10:00:00'};
const decision={...request,accountEmail:user.email,userId:user.userId,
  details:'Mano duomenų kopija',overdue:0};

async function mockPrivacyApi(page,{role='customer'}={}){
  const actor=role==='admin'?admin:user;
  let saved=[];
  await page.route('**/api/auth/me',async route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:actor})}));
  await page.route('**/api/privacy/requests',async route=>{
    if(route.request().method()==='POST'){
      const body=route.request().postDataJSON();
      saved.push({...request,type:body.type});
      await route.fulfill({status:201,contentType:'application/json',
        body:JSON.stringify({requestId:request.requestId,type:body.type,status:'received'})});
    }else{
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({requests:saved})});
    }
  });
  await page.route('**/api/admin/privacy/health',async route=>
    route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({unreviewed:1,open:1,overdue:0,earliestDueAt:request.dueAt,
        automaticDeliveryReady:false})}));
  await page.route('**/api/admin/privacy/requests?offset=*',async route=>
    route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({requests:[decision],hasMore:false,nextOffset:50})}));
  await page.route('**/api/admin/privacy/requests/*/audit',async route=>
    route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({requestId:request.requestId,events:[{createdAt:'2026-11-09 11:00:00',
        actorUserId:admin.userId,previousStatus:'received',nextStatus:'in_review'}]})}));
}

test.describe('BDAR prašymų sąsaja (be realių įrašų)',()=>{
  test('svečias mato teisės langą, bet negali pateikti prašymo',async({page})=>{
    await page.route('**/api/auth/me',r=>r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({user:null})}));
    await page.goto('/');
    await page.locator('#rioPrivacyRequestBtn').click();
    await expect(page.locator('#rioPrivacyDialog')).toBeVisible();
    await expect(page.locator('#rioPrivacyForm')).toBeHidden();
    await expect(page.locator('#rioPrivacyIdentity')).toContainText('prisijunkite');
  });
  test('klientas pateikia sintetinį prašymą ir mato tik savo būseną',async({page})=>{
    await mockPrivacyApi(page);
    await page.goto('/');
    await page.locator('#rioPrivacyRequestBtn').click();
    await expect(page.locator('#rioPrivacyIdentity')).toContainText(user.email);
    await expect(page.locator('#rioPrivacyAdmin')).toBeHidden();
    await page.locator('#rioPrivacyType').selectOption('access');
    await page.locator('#rioPrivacyDetails').fill('Prašau duomenų kopijos');
    await page.locator('#rioPrivacySubmit').click();
    await expect(page.locator('#rioPrivacyMessage')).toContainText('užregistruotas');
    await expect(page.locator('#rioPrivacyHistory')).toContainText('Susipažinti su duomenimis');
    await expect(page.locator('#rioPrivacyHistory')).toContainText('2026-12-09');
  });
  test('administratorius mato eilę, pranešimų perspėjimą ir audito istoriją',async({page})=>{
    await mockPrivacyApi(page,{role:'admin'});
    await page.goto('/?privacy-requests=1');
    await expect(page.locator('#rioPrivacyDialog')).toBeVisible();
    await expect(page.locator('#rioPrivacyAdminHealth')).toContainText('Neperžiūrėti: 1');
    await expect(page.locator('#rioPrivacyAdminHealth')).toContainText('NĖRA patvirtintas');
    await expect(page.locator('#rioPrivacyAdminList')).toContainText(user.email);
    await page.getByRole('button',{name:'Peržiūrėti sprendimų istoriją'}).click();
    await expect(page.locator('#rioPrivacyAdminList')).toContainText('administratorius: admin-test');
  });
});
