// Real production UI; mocked HTTP with actual backend-rendered PDF bytes from isolated QA.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../tmp/reports-browser/', import.meta.url)); await mkdir(output, { recursive: true });
const pdf = await readFile(new URL('../../tmp/pdfs/reports/payments.pdf', import.meta.url));
const entry = '/__reports-ui.js';
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false }, plugins: [{
  name: 'reports-ui-fixture', resolveId(id) { if (id === entry) return '\0reports-ui.js'; },
  load(id) { if (id !== '\0reports-ui.js') return; return `import React from 'react';import{createRoot}from'react-dom/client';import'/src/index.css';import Reports from'/src/components/reports/ReportsWorkspace.jsx';
    const role=new URLSearchParams(location.search).get('role');createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement('main',{className:'mx-auto max-w-6xl p-4'},React.createElement(Reports,{role}))));`; },
  configureServer(vite) { vite.middlewares.use(async (req,res,next) => { if (!req.url?.startsWith('/__reports-ui?')) return next(); res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__reports-ui',`<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`)); }); },
}] });
await server.listen();const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
const catalog = [
  ['current_stock','Current Stock Summary',false,['inventory_worker','supervisor']],['batches','Batches and Expiry',false,['inventory_worker','supervisor']],
  ['stock_changes','Stock Requests and Changes',true,['inventory_worker','supervisor']],['availability','Availability Activity',true,['inventory_worker','supervisor']],
  ['payments','Payments and Pickup Summary',true,['admin','supervisor']],['order_operations','Order Operations Summary',true,['supervisor']],
  ['store_operations','Store Operations Summary',true,['admin']],['cop','COP Summary',true,['admin']],
];
let browser;
try {
  browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'msedge',headless:true});
  for (const width of [1440,390,320]) for (const role of ['inventory_worker','supervisor','admin']) {
    const context=await browser.newContext({viewport:{width,height:950},timezoneId:'America/Los_Angeles',acceptDownloads:true});
    await context.addCookies([{name:'XSRF-TOKEN',value:'qa',url:origin}]);
    let saved, delayed=false, failPdf=false, expiredPdf=false, empty=false, generation=0;
    const writes=[],errors=[],downloads=[];
    await context.route(/\/(?:api|sanctum)\//,async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Accept, Content-Type, X-XSRF-TOKEN','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
      const respond=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
      if(request.method()==='OPTIONS'||path==='/sanctum/csrf-cookie')return respond({});
      if(path==='/api/reports/options')return respond({types:catalog.filter(row=>row[3].includes(role)).map(([id,label,period])=>({id,label,period})),from:'2026-11-01',until:'2026-11-17',store:role==='admin'?null:{store_id:1,store_name:'Saved Store'},stores:role==='admin'?[{store_id:1,store_name:'Saved Store'}]:[]});
      if(path==='/api/reports'){
        const body=request.postDataJSON();writes.push(body);generation++;
        if(role!=='admin')assert.equal(body.store_id,undefined);
        assert.equal(body.rows,undefined);assert.equal(body.generated_by,undefined);
        const type=catalog.find(row=>row[0]===body.type);if(!type[2]){assert.equal(body.from,undefined);assert.equal(body.until,undefined);}
        saved={id:String(generation).padStart(64,'a'),title:type[1],type:body.type,role,generated_at:new Date().toISOString(),expires_at:new Date(Date.now()+900000).toISOString(),generated_by:'Saved Staff '+ 'LongName'.repeat(30),store_label:'Saved Store',filters:body,notes:[],metrics:[{label:'Backend total across all rows',value:26000,format:'money'}],sections:[{key:'summary',title:'Saved grouped summary',basis:'CURRENT as of generation; period metrics use their recorded event dates.',columns:[{key:'name',label:'Name',format:'text'},{key:'amount',label:'Amount',format:'money'}],rows:empty?[]:Array.from({length:25},(_,i)=>({name:'Saved product '+(i+1),amount:1000})),row_count:empty?0:26,page:1,last_page:empty?1:2}]};
        const result=structuredClone(saved);if(delayed)await new Promise(resolve=>setTimeout(resolve,500));return respond({report:result},201);
      }
      if(path.endsWith('/pdf')){
        if(expiredPdf)return respond({message:'This report expired. Generate again.'},410);
        if(failPdf)return respond({message:'PDF renderer temporarily unavailable. Retry export.'},503);
        downloads.push(path);return route.fulfill({status:200,headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="GrocerEase-report.pdf"'},body:pdf});
      }
      if(path.startsWith('/api/reports/')){const report=structuredClone(saved);report.sections[0]={...report.sections[0],rows:[{name:'Saved product 26',amount:1000}],page:2};assert.equal(url.searchParams.get('pages[summary]'),'2');return respond({report});}
      throw new Error('Unexpected report fixture URL '+path);
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/__reports-ui?role='+role);
    const type=page.getByLabel('Report type',{exact:true}),generate=page.getByRole('button',{name:'Generate Report',exact:true}),exportButton=page.getByRole('button',{name:'Export PDF',exact:true});
    await type.waitFor();assert.equal(await exportButton.isDisabled(),true);
    assert.deepEqual(await type.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),catalog.filter(row=>row[3].includes(role)).map(row=>row[0]));
    assert.equal(await page.getByLabel('Report store',{exact:true}).count(),role==='admin'?1:0);
    await generate.click();await page.getByRole('region',{name:'Generated report',exact:true}).waitFor();
    assert.ok((await page.getByRole('region',{name:'Generated report',exact:true}).innerText()).includes('260.00'));
    await page.getByRole('button',{name:'Next Saved grouped summary page',exact:true}).click();await page.getByText('Saved product 26',{exact:true}).waitFor();
    if(role==='admin')await page.getByLabel('Report store',{exact:true}).selectOption('1');else await page.getByLabel('Report search',{exact:true}).fill('Rice');
    assert.equal(await exportButton.isDisabled(),true);await page.getByText(/preview is stale/).waitFor();
    // Reverting the filter still requires explicit generation.
    if(role==='admin')await page.getByLabel('Report store',{exact:true}).selectOption('');else await page.getByLabel('Report search',{exact:true}).fill('');
    assert.equal(await exportButton.isDisabled(),true);
    await generate.click();await exportButton.waitFor();await page.getByRole('button',{name:'Next Saved grouped summary page',exact:true}).waitFor();
    failPdf=true;await exportButton.click();await page.getByRole('alert').filter({hasText:'PDF renderer temporarily unavailable'}).waitFor();assert.equal(await page.getByRole('region',{name:'Generated report',exact:true}).count(),1);
    failPdf=false;const downloadEvent=page.waitForEvent('download');await exportButton.click();const downloaded=await downloadEvent;assert.equal(downloaded.suggestedFilename(),'GrocerEase-report.pdf');assert.equal(downloads.length,1);
    if(role!=='admin'){
      assert.equal(await page.getByLabel('Report from date',{exact:true}).isDisabled(),true);
      await type.selectOption('availability');assert.equal(await page.getByLabel('Report from date',{exact:true}).isDisabled(),false);
    }
    empty=true;await generate.click();await page.getByText('No matching records.',{exact:true}).waitFor();
    await page.screenshot({path:output+`${role}-${width}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    empty=false;delayed=true;const previous=writes.length;await generate.click();await page.waitForFunction(count=>document.querySelector('button[type=submit]')?.disabled!==false,previous).catch(()=>{});
    await type.selectOption(role==='admin'?'cop':'batches');await page.waitForTimeout(650);assert.equal(await exportButton.isDisabled(),true);delayed=false;
    await generate.click();await page.getByRole('button',{name:'Next Saved grouped summary page',exact:true}).waitFor();expiredPdf=true;await exportButton.click();await page.getByRole('alert').filter({hasText:'expired'}).waitFor();assert.equal(await page.getByRole('region',{name:'Generated report',exact:true}).count(),0);
    assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${role} ${width}px: types/scope, snapshot pagination/totals, stale/reverted/late filters, empty state, PDF retry/download/expiry and overflow.`);
  }
}finally{await browser?.close();await server.close();}
