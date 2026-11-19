// Real production components; API fixtures only, no financial writes to the working DB.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const output=fileURLToPath(new URL('../../tmp/financial-browser/',import.meta.url)); await mkdir(output,{recursive:true});
const entry='/__financial-ui.js';
const server=await createServer({logLevel:'error',cacheDir:output+'vite-cache',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{
  name:'financial-fixture',resolveId(id){if(id===entry)return '\0financial-ui.js';},
  load(id){if(id==='\0financial-ui.js')return `import React from'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import'/src/index.css';import Financial from'/src/pages/admin/FinancialSetup.jsx';createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,React.createElement('main',{className:'p-4'},React.createElement(Financial)))));`;},
  configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/__financial-ui?'))return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__financial-ui',`<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));});},
}]});
await server.listen();const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
const paged=(data,page=1,total=data.length,last=1)=>({data,current_page:page,total,last_page:last});
let browser;
try{
  browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'msedge',headless:true});
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:950},timezoneId:'America/Los_Angeles'});await context.addCookies([{name:'XSRF-TOKEN',value:'qa',url:origin}]);
    let agreement=null,bill=null,payment=null,movements=[],available=0,policy={version:0,fee_enabled:false,rate_bps:0,cap_centavos:null,approval_note:null,digital_enabled:true,digital_methods:null};
    let failContribution=true,failRead=false,stalePolicy=false;const writes=[],reads=[],errors=[];
    await context.route(/\/(?:api|sanctum)\//,async route=>{
      const req=route.request(),url=new URL(req.url()),path=url.pathname;
      const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(path==='/sanctum/csrf-cookie')return respond({});
      if(path.endsWith('/financial/options'))return respond({stores:[{store_id:1,store_name:'First Store',status:'active'},{store_id:2,store_name:'Second Store',status:'inactive'}],today:'2026-11-19'});
      if(req.method()==='POST'){
        const body=req.postDataJSON();writes.push({path,body});assert.match(body.idempotency_key,/^[a-f0-9-]{36}$/);assert.equal(body.actor_id,undefined);assert.ok(body.reason.length>=3);
        if(path.endsWith('/contribute')&&failContribution){failContribution=false;return route.abort('failed');}
        if(path.endsWith('/policy')&&stalePolicy)return respond({message:'This record changed. Refresh and review the latest version.'},409);
        await new Promise(r=>setTimeout(r,120));
        if(path.endsWith('/agreement'))agreement={amount_centavos:50000,period:body.period,starts_on:body.starts_on,status:body.status,version:1};
        if(path.endsWith('/bill'))bill={id:8,amount_centavos:50000,coverage_from:body.coverage_from,coverage_until:'2026-12-18',due_on:body.due_on,status:'pending'};
        if(path.endsWith('/payment')){payment={id:9,bill_id:8,version:1,amount_centavos:50000,paid_on:body.paid_on,method:body.method,evidence:body.evidence,actor:'admin@example.test',unallocated_centavos:0};bill.payment_id=9;}
        if(path.endsWith('/verify')){payment.version=2;payment.verified_at='2026-11-19 02:00:00';payment.verification_reason=body.reason;payment.unallocated_centavos=50000;bill.status='paid';bill.verified_at=payment.verified_at;}
        if(path.endsWith('/contribute')){available=10000;payment.unallocated_centavos=40000;movements=[{id:10,kind:'contribution',amount_centavos:10000,payment_id:9,actor:'admin@example.test',reason:body.reason,created_at:'2026-11-19 03:00:00'}];}
        if(path.endsWith('/return_contribution')){available=0;movements[0].returned_by=11;movements.push({...movements[0],id:11,kind:'contribution_return',related_id:10});}
        if(path.endsWith('/policy'))policy={...policy,version:1,fee_enabled:body.fee_enabled,rate_bps:body.rate_bps,approval_note:body.approval_note,digital_enabled:body.digital_enabled,digital_methods:body.digital_methods};
        return respond({result:{id:1}});
      }
      reads.push(url.search);
      if(failRead)return respond({message:'Temporary financial read error'},503);
      if(path.includes('/bills/'))return respond({bill,payments:paged(payment?[payment]:[]),void:null});
      const section=url.searchParams.get('section'),page=Number(url.searchParams.get('page')),mode=url.searchParams.get('mode');
      const scoped=path.endsWith('/1')&&mode==='test';
      if(section==='subscriptions')return respond({mode,agreement:scoped?agreement:null,records:paged(scoped&&bill?[bill]:[],page,scoped&&bill?21:0,scoped&&bill?2:1)});
      if(section==='funding')return respond({mode,budget:{available_centavos:scoped?available:0,reserved_centavos:0,net_funded_centavos:scoped?available:0},records:paged(scoped?movements:[])});
      if(section==='settings')return respond({mode,policy,merchant_methods:['gcash','card'],gateway:{available:policy.digital_enabled,channels:['gcash','card']}});
      return respond({mode,records:paged([])});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/__financial-ui?fixture');
    await page.getByText('No agreement for this store and mode.').waitFor();await page.getByLabel('Financial mode').selectOption('test');
    await page.getByRole('button',{name:'Edit agreement',exact:true}).click();await page.getByLabel('Agreed amount (PHP)').fill('500.00');await page.getByLabel('Reason',{exact:true}).fill('Reviewed subscription terms');
    await page.getByRole('dialog').getByRole('button',{name:'Edit agreement',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
    await page.getByRole('button',{name:'+ Add billing record',exact:true}).click();await page.getByLabel('Reason',{exact:true}).fill('Approved billing period');await page.getByRole('dialog').getByRole('button',{name:'Add billing record',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Record payment',exact:true}).click();await page.getByLabel('Private evidence / unique reference').fill('Test reference 123');await page.getByLabel('Reason',{exact:true}).fill('Recorded evidence');await page.getByRole('dialog').getByRole('button',{name:'Record payment',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Payments / history',exact:true}).click();await page.getByText('Evidence: Test reference 123',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Contribute funds',exact:true}).count(),0);
    await page.getByRole('button',{name:'Verify payment',exact:true}).click();await page.getByLabel('Verification attestation / reason').fill('Checked full bank receipt');await page.getByRole('dialog').getByRole('button',{name:'Verify payment',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Payments / history',exact:true}).click();await page.getByRole('button',{name:'Contribute funds',exact:true}).click();await page.getByLabel('Contribution (PHP)').fill('100.00');await page.getByLabel('Reason',{exact:true}).fill('Authorized explicit funding');await page.getByRole('dialog').getByRole('button',{name:'Contribute funds',exact:true}).click();await page.getByRole('alert').waitFor();
    const retryKey=writes.at(-1).body.idempotency_key;await page.getByRole('dialog').getByRole('button',{name:'Contribute funds',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(writes.at(-1).body.idempotency_key,retryKey);
    await page.getByRole('button',{name:'Incentive Funding',exact:true}).click();await page.getByRole('button',{name:'Return in full',exact:true}).waitFor();await page.screenshot({path:output+'funding-'+width+'.png',fullPage:true});
    await page.getByRole('button',{name:'Return in full',exact:true}).click();await page.getByLabel('Reason',{exact:true}).fill('Approved funding correction');await page.getByRole('dialog').getByRole('button',{name:'Return contribution',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByText('Configure Product Markup',{exact:true}).waitFor();await page.getByRole('button',{name:'Edit service charge and payment rules',exact:true}).click();await page.getByLabel('Enable service charge',{exact:true}).check();await page.getByLabel('Rate (basis points: 300 = 3%)').fill('300');await page.getByLabel('Store approval / reference').fill('Store Test approval');await page.getByLabel('Reason',{exact:true}).fill('Store approved test policy');
    stalePolicy=true;await page.getByRole('dialog').getByRole('button',{name:'Save financial settings',exact:true}).click();await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Reload latest records',exact:true}).click();stalePolicy=false;
    await page.getByRole('button',{name:'Edit service charge and payment rules',exact:true}).click();await page.getByLabel('Enable service charge',{exact:true}).check();await page.getByLabel('Rate (basis points: 300 = 3%)').fill('300');await page.getByLabel('Store approval / reference').fill('Store Test approval');await page.getByLabel('Reason',{exact:true}).fill('Store approved test policy');await page.getByRole('dialog').getByRole('button',{name:'Save financial settings',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});await page.getByText('3% of groceries, rounded half up | Policy 1',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Edit service charge and payment rules',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('button',{name:'Subscriptions',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('21 records | Page 2 of 2',{exact:true}).waitFor();assert.ok(reads.some(q=>q.includes('page=2')));
    await page.getByLabel('Financial store').selectOption('2');await page.getByText('No agreement for this store and mode.').waitFor();assert.equal(await page.getByRole('button',{name:'Payments / history',exact:true}).count(),0);
    failRead=true;await page.getByRole('button',{name:'Incentive Funding',exact:true}).click();await page.getByRole('alert').waitFor();failRead=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:'Incentive Funding (test)',exact:true}).waitFor();
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);await context.close();console.log('PASS: financial CRUD, private evidence review, explicit verification, stable failed-request retry, funding return, stale policy recovery, bounded dialogs, pagination, scope clearing and read retry at '+width+'px.');
  }
}finally{await browser?.close();await server.close();}
