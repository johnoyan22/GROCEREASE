// Real insecure HTTP origin and production checkout; mocked API, no working order writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const host='grocerease-lan.test',entry='/__http-checkout.js';
const server=await createServer({logLevel:'error',cacheDir:fileURLToPath(new URL('../../tmp/checkout-http-vite/',import.meta.url)),server:{host:'127.0.0.1',port:0,hmr:false,allowedHosts:[host]},plugins:[{
 name:'checkout-http-fixture',resolveId(id){if(id===entry)return '\0checkout-http.js';},load(id){if(id==='\0checkout-http.js')return `import React from'react';import{createRoot}from'react-dom/client';import'/src/index.css';import Checkout from'/src/components/Shoppers/ShopperCheckout.jsx';const cart={store_id:1,items:[{store_inventory_id:7,quantity:2}]};const placed=()=>{};createRoot(document.getElementById('root')).render(React.createElement(Checkout,{cart,userId:5,onPlaced:placed,onClose(){}}));`;},
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/__http-checkout?'))return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__http-checkout',`<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));});}
}]});await server.listen();const port=server.httpServer.address().port,origin='http://'+host+':'+port;
const day='2032-05-12',policy={version:1,enabled:true,maximum_centavos:150000};
const order={order_id:9,order_reference:'GE-ORD-00000009',store_id:1,store_name:'HTTP QA Store',status:'waiting',payment_method:'cash_on_pickup',payment_status:'unpaid',reservation_status:'active',total_centavos:13450,pickup_window_start_at:day+'T02:00:00Z',pickup_window_end_at:day+'T03:00:00Z'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let browser;
try{
 browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'msedge',headless:true,args:['--host-resolver-rules=MAP '+host+' 127.0.0.1','--no-proxy-server']});
 for(const loseResponse of [false,true]){
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.addCookies([{name:'XSRF-TOKEN',value:'qa',url:origin}]);const page=await context.newPage();page.setDefaultTimeout(20000);
  const placements=[],recoveries=[],errors=[];page.on('pageerror',error=>errors.push(error.message));let savedOrder=false;
  await context.route(/\/(?:api|sanctum)\//,async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/sanctum/csrf-cookie')return respond({});
   if(path.endsWith('/payment-options'))return respond({digital:{available:false,channels:[],reason:'Not configured for fixture.'}});
   if(path.endsWith('/cop-status'))return respond({cop:{allowed:true,policy}});
   if(path.endsWith('/pickup-hours'))return respond({store_id:1,hours:{date:day,today:'2032-05-11',store_opens_at:'09:00',store_closes_at:'21:00',opens_at:'10:00',closes_at:'20:00',earliest_start_at:'10:00',windows:[{pickup_start:'10:00',pickup_end:'11:00'}]}});
   if(path.endsWith('/checkout/quote'))return respond({quote_token:'qa-quote',quote:{store:{store_name:'HTTP QA Store',address:'QA only'},items:[],subtotal_centavos:13450,total_centavos:13450,service_fee_centavos:0,payment_method:'cash_on_pickup',cop_policy:policy,pickup_window_start_at:order.pickup_window_start_at,pickup_window_end_at:order.pickup_window_end_at,cop_claim_deadline_at:day+'T13:00:00Z'}});
   if(path==='/api/shopper/orders'){
    const payload=request.postDataJSON();assert.match(payload.idempotency_key,uuid);
    const persisted=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('grocerease-checkout-5')));assert.equal(persisted.key,payload.idempotency_key);placements.push(payload);savedOrder=true;
    if(loseResponse)return route.abort('failed');return respond({order},201);
   }
   if(path.includes('/checkout-attempts/')){recoveries.push(path.split('/').at(-1));return savedOrder?respond({order}):respond({message:'Not found'},404);}
   errors.push('Unexpected request: '+path);return respond({message:'Unexpected request'},500);
  });
  await page.goto(origin+'/__http-checkout?qa=1');
  assert.deepEqual(await page.evaluate(()=>({secure:isSecureContext,uuid:typeof crypto.randomUUID,random:typeof crypto.getRandomValues})),{secure:false,uuid:'undefined',random:'function'});
  await page.getByLabel('Pickup window',{exact:true}).selectOption('10:00/11:00');await page.getByRole('button',{name:'Review current prices and pickup schedule',exact:true}).click();await page.getByRole('button',{name:'Confirm / Place Order',exact:true}).click();
  if(loseResponse){await page.getByText('The result is uncertain.',{exact:false}).waitFor();const first=placements[0].idempotency_key;await page.reload();await page.getByText('GE-ORD-00000009 is recorded at HTTP QA Store.',{exact:true}).waitFor();assert.deepEqual(recoveries,[first]);}
  else await page.getByText('GE-ORD-00000009 is recorded at HTTP QA Store.',{exact:true}).waitFor();
  assert.equal(placements.length,1);assert.deepEqual(errors,[]);await context.close();console.log('PASS: real HTTP/nonsecure origin without randomUUID; '+(loseResponse?'lost-response recovery reuses the persisted key with no duplicate placement.':'checkout sends a valid v4 idempotency key.'));
 }
}finally{await browser?.close();await server.close();}
