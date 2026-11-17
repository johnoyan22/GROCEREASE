// Production components in a real browser; HTTP fixtures, no changes to the working database.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const output = fileURLToPath(new URL('../../tmp/cop-browser/', import.meta.url)); await mkdir(output, { recursive: true });
const entry = '/__cop-ui.js';
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false }, plugins: [{
  name: 'cop-ui-fixture', resolveId(id) { if (id === entry) return '\0cop-ui.js'; },
  load(id) { if (id === '\0cop-ui.js') return `import React from 'react';import{createRoot}from'react-dom/client';import'/src/index.css';import Cop from'/src/pages/admin/CopManagement.jsx';createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement('main',{className:'p-4'},React.createElement(Cop))));`; },
  configureServer(vite) { vite.middlewares.use(async (req,res,next) => { if (!req.url?.startsWith('/__cop-ui?')) return next(); res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__cop-ui', `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`)); }); },
}] });
await server.listen(); const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const paged = (data, page = 1, total = data.length, last = Math.max(1, Math.ceil(total / 20))) => ({ data, current_page: page, total, last_page: last });
let browser;
try {
  browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'msedge', headless: true });
  for (const width of [1440,390,320]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'America/Los_Angeles' });
    await context.addCookies([{ name:'XSRF-TOKEN',value:'qa',url:origin }]);
    let policy = { version:1, enabled:true, maximum_centavos:150000, temporary_threshold:2, temporary_days:30, permanent_threshold:3 };
    let cop = { version:0, allowed:true, individual_restricted:false, individual_access:'available', sources:[], strike_count:0, lifetime_strike_count:0, reason:'Cash on Pickup is available.', platform_enabled:true, blocks:[], policy };
    const shopper = { user_id:5, name:'Zero Strike Shopper', email:'shopper@example.test' };
    const row = { id:7,order_id:9,order_reference:'GE-ORD-00000009',shopper_name:'LongName'.repeat(30),email:'shopper@example.test',store_name:'Actual Test Store',classification:'paid_unclaimed',payment_method:'digital',payment_state:'paid',payment_status:'paid',claim_deadline_at:'2026-11-16 16:00:00',incident_at:'2026-11-16 16:01:00',claim_status:'unclaimed_pending_resolution',strike_status:'not_applicable',resolved:false };
    const writes=[], reads=[], errors=[]; let failClaims=false, conflict=false, delayWrite=false, withStrike=false, corrected=false;
    await context.route(/\/(?:api|sanctum)\//, async route => {
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(path==='/sanctum/csrf-cookie') return respond({});
      if(request.method()==='PUT') {
        const body=request.postDataJSON(); writes.push({path,body});assert.equal(body.confirmed,true);assert.equal(body.actor_user_id,undefined);
        if(delayWrite) await new Promise(resolve=>setTimeout(resolve,400));
        if(conflict) return respond({message:'COP access changed. Reload this Shopper before deciding.'},409);
        if(path.endsWith('/policy')) { policy={...policy,version:2,enabled:body.enabled,maximum_centavos:Math.round(Number(body.maximum_php)*100),temporary_threshold:body.temporary_threshold,temporary_days:body.temporary_days,permanent_threshold:body.permanent_threshold}; }
        else if(path.endsWith('/restriction')) cop={...cop,version:cop.version+1,allowed:false,individual_restricted:true,individual_access:body.kind,disabled_until:body.until?'2099-01-01T09:30:00Z':null,sources:['manual'],reason:'Cash on Pickup is restricted.',blocks:[{source:'manual',reason:body.reason}]};
        else if(path.endsWith('/restoration')) cop={...cop,version:cop.version+1,allowed:true,individual_restricted:false,individual_access:'available',disabled_until:null,sources:[],reason:'Cash on Pickup is available.',blocks:[]};
        else if(path.endsWith('/correction')) { cop={...cop,version:cop.version+1,strike_count:0,lifetime_strike_count:0};corrected=true; }
        return respond({message:'COP decision saved.',policy,cop});
      }
      reads.push(url);
      if(path==='/api/admin/cop/policy')return respond({policy,stores:[{store_id:1,store_name:'Actual Test Store'}],history:paged([{policy,actor_user_id:policy.version===1?null:1,reason:'Approved rule review',effective_at:'2026-11-17 01:00:00'}])});
      if(path==='/api/admin/cop/failed-claims') {
        if(failClaims)return respond({message:'Temporary read error'},503);
        return respond({incidents:paged(url.searchParams.get('search')==='empty'?[]:[row],Number(url.searchParams.get('page')||1),url.searchParams.get('search')==='empty'?0:21,2)});
      }
      const history={strikes:paged(withStrike?[{id:19,order_id:9,strike_number_at_issue:1,effective_count:corrected?null:1,policy_version_id:1,cycle_id:2,issued_at:'2026-11-17 01:00:00',effective_kind:corrected?'corrected':'warning',voided_at:corrected?'2026-11-17 02:00:00':null,correction_reason:corrected?'Documented mistaken incident':null,voided_by_user_id:corrected?1:null}]:[]),events:paged([]),restrictions:paged([])};
      if(path==='/api/admin/cop/failed-claims/7')return respond({incident:{...row,reason:'Actual holding deadline expired.',evidence_source:'deadline_processing'},order_reference:row.order_reference,current:{claim_status:row.claim_status,payment_status:'paid',reservation_status:'active',refund_status:'pending_decision'},timeline:paged([{previous_status:'preparing',new_status:'ready_for_pickup',created_at:'2026-11-15 01:00:00'}]),resolution_logs:paged([]),...history});
      if(path==='/api/admin/cop/accounts')return respond({accounts:paged([{...shopper,cop}]),platform_enabled:policy.enabled});
      if(path==='/api/admin/cop/accounts/5')return respond({shopper,cop,...history});
      throw new Error('Unhandled COP browser request: '+path);
    });
    const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/__cop-ui?qa=1');await page.getByRole('heading',{name:'COP Management',exact:true}).waitFor();await page.getByText(row.order_reference,{exact:true}).waitFor();
    assert.equal(await page.getByText('Nov 17, 2026', {exact:false}).count()>0,true);
    await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Page 2 of 2',{exact:false}).waitFor();
    await page.getByLabel('Order / Shopper search').fill('empty');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.getByText('No failed claims match these filters.').waitFor();
    assert.equal(reads.filter(url=>url.pathname.endsWith('failed-claims')).at(-1).searchParams.get('page'),'1');
    await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByText(row.order_reference,{exact:true}).waitFor();
    await page.getByRole('button',{name:'View Details',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);await page.getByText('Actual holding deadline expired.').waitFor();
    assert.equal(await page.getByRole('dialog').getByRole('button',{name:/paid|handover|release|refund/i}).count(),0);
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Manage COP Rules',exact:true}).click();
    await page.getByLabel('Maximum order total (PHP)').fill('2000.01');await page.getByLabel('Change reason',{exact:true}).fill('Approved maximum change');
    assert.equal(await page.getByRole('button',{name:'Save COP rules',exact:true}).isDisabled(),true);
    await page.getByLabel('I reviewed the before/after rules and confirm this global change.').check();await page.getByRole('button',{name:'Save COP rules',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(writes[0].body.expected_version,1);assert.equal(writes[0].body.maximum_php,'2000.01');
    await page.getByRole('button',{name:'Rule history',exact:true}).click();await page.getByText('Version 2',{exact:false}).waitFor();await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'COP Access',exact:true}).click();await page.getByRole('button',{name:'Manage access',exact:true}).click();await page.getByRole('heading',{name:'COP Access: Zero Strike Shopper'}).waitFor();
    await page.getByRole('button',{name:'Restrict COP',exact:true}).click();await page.getByLabel('Until (Manila date and time)').fill('2099-01-01T17:30');await page.getByLabel('Decision reason',{exact:true}).fill('Reviewed zero strike manual case');await page.getByLabel('I reviewed the effect for Zero Strike Shopper and confirm this decision.').check();
    delayWrite=true;const submit=page.getByRole('button',{name:'Confirm restriction',exact:true});await submit.click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('dialog').waitFor({state:'detached'});delayWrite=false;
    assert.equal(writes.at(-1).body.until,'2099-01-01T17:30');assert.equal(writes.at(-1).body.expected_version,0);
    await page.getByRole('button',{name:'Manage access',exact:true}).click();await page.getByRole('button',{name:'Restore COP',exact:true}).click();await page.getByText('A no-show first legitimately issued after restoration joins the new cycle,',{exact:false}).waitFor();
    await page.getByLabel('Decision reason',{exact:true}).fill('Approved access restoration');await page.getByLabel('I reviewed the effect for Zero Strike Shopper and confirm this decision.').check();await page.getByRole('button',{name:'Confirm restoration',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
    assert.equal(writes.at(-1).body.expected_version,1);assert.match(writes.at(-1).path,/restoration$/);
    withStrike=true;cop={...cop,strike_count:1,lifetime_strike_count:1};
    await page.getByRole('button',{name:'Manage access',exact:true}).click();await page.getByText('Audit history (Manila dates)',{exact:true}).click();await page.getByRole('button',{name:'Correct erroneous strike #19',exact:true}).click();await page.getByLabel('Why was this incident erroneous?',{exact:true}).fill('Documented mistaken incident');await page.getByLabel('I reviewed the effect for Zero Strike Shopper and confirm this decision.').check();await page.getByRole('button',{name:'Confirm correction',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.match(writes.at(-1).path,/cop-strikes\/19\/correction$/);assert.equal(writes.at(-1).body.expected_version,2);
    await page.getByRole('button',{name:'Manage access',exact:true}).click();await page.getByRole('button',{name:'Restrict COP',exact:true}).click();await page.getByLabel('Restriction',{exact:true}).selectOption('until_restored');await page.getByLabel('Decision reason',{exact:true}).fill('Stale review conflict example');await page.getByLabel('I reviewed the effect for Zero Strike Shopper and confirm this decision.').check();conflict=true;
    await page.getByRole('button',{name:'Confirm restriction',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('dialog').count(),1);conflict=false;await page.getByRole('button',{name:'Reload current access',exact:true}).click();await page.getByRole('button',{name:'Restrict COP',exact:true}).waitFor();await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Failed Claims',exact:true}).click();await page.getByText(row.order_reference,{exact:true}).waitFor();failClaims=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByText('Temporary read error',{exact:true}).waitFor();failClaims=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByText(row.order_reference,{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);assert.deepEqual(errors,[]);
    await page.screenshot({path:output+'cop-'+width+'.png',fullPage:true});await context.close();console.log('PASS: COP rules, filtered/paged claims, zero-strike restriction/restoration, audited correction, stale conflict, dialog focus/escape, errors/retry and mobile overflow at '+width+'px.');
  }
} finally { await browser?.close(); await server.close(); }
