// Production shared payment component, HTTP fixtures only; no working DB or real provider calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const output=fileURLToPath(new URL('../../tmp/xendit-browser/',import.meta.url));await mkdir(output,{recursive:true});
const entry='/__xendit-ui.js';
const server=await createServer({logLevel:'error',cacheDir:output+'vite-cache',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{
  name:'xendit-ui',resolveId(id){if(id===entry)return '\0xendit-ui';},load(id){if(id==='\0xendit-ui')return `import React from'react';import{createRoot}from'react-dom/client';import'/src/index.css';import Payment from'/src/components/orders/OrderPayment.jsx';const returned=new URLSearchParams(location.search).has('payment_order');const order={order_id:7,payment_method:'digital',payment_status:'unpaid',status:'waiting',payment_checkout:{provider:'xendit',mode:'test',status:'pending',expires_at:'2099-12-31T00:00:00Z'}};createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement('main',{className:'p-4'},React.createElement(Payment,{order,autoStart:!returned}))));`;},
  configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/__xendit-ui?'))return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__xendit-ui',`<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));});},
}]});await server.listen();const origin=server.resolvedUrls.local[0].replace(/\/$/,'');let browser;
try{
  browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'msedge',headless:true});
  for(const width of [390,1440]){
    const context=await browser.newContext({viewport:{width,height:850}});await context.addCookies([{name:'XSRF-TOKEN',value:'test',url:origin}]);
    let posts=0,gets=0,paid=false;const errors=[];const hosted='https://checkout-staging.xendit.co/sessions/ps-1234567890abcdef12345678';
    await context.route('https://checkout-staging.xendit.co/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Hosted TEST fixture</h1>'}));
    await context.route(/\/(?:api|sanctum)\//,async route=>{
      const r=route.request();const respond=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      if(r.url().endsWith('/sanctum/csrf-cookie'))return respond({});
      assert.match(r.url(),/\/api\/shopper\/orders\/7\/payment-session$/);
      if(r.method()==='POST'){posts++;assert.deepEqual(r.postDataJSON(),{});await new Promise(resolve=>setTimeout(resolve,150));}else gets++;
      return respond({payment:{provider:'xendit',mode:'test',verified:paid,status:paid?'paid':'pending_payment',expires_at:'2099-12-31T00:00:00Z',checkout_url:paid?null:hosted}});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/__xendit-ui?fresh');
    const link=page.getByRole('link',{name:'Pay with Xendit (Test)',exact:true});await link.waitFor();assert.equal(posts,1);assert.equal(gets,0);assert.equal(await link.getAttribute('target'),null);
    await link.click();await page.getByRole('heading',{name:'Hosted TEST fixture'}).waitFor();assert.equal(context.pages().length,1);
    await page.goto(origin+'/__xendit-ui?payment_order=7&payment_return=success');await page.getByRole('link',{name:'Pay with Xendit (Test)',exact:true}).waitFor();assert.equal(posts,1);assert.equal(gets,1);
    assert.equal(await page.getByText('TEST payment verified.',{exact:false}).count(),0);
    paid=true;await page.getByRole('button',{name:'Refresh payment status',exact:true}).click();await page.getByText('TEST payment verified. Preparation, QR/PIN verification and physical handover are still required.',{exact:true}).waitFor();
    assert.equal(posts,1);assert.equal(await page.getByRole('link',{name:'Pay with Xendit (Test)',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:/Mark Paid|Complete order/}).count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await page.screenshot({path:output+'payment-'+width+'.png',fullPage:true});await context.close();
    console.log('PASS '+width+'px: one automatic prepare under StrictMode, same-tab TEST redirect, existing-order return/GET, no client success claim, verified refresh and unchanged pickup requirement.');
  }
}finally{await browser?.close();await server.close();}
