// Actual public/auth/Shopper routes. HTTP is mocked; no working accounts or orders are changed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const output=fileURLToPath(new URL('../../tmp/shopper-responsive/',import.meta.url));await mkdir(output,{recursive:true});
const server=await createServer({logLevel:'error',cacheDir:output+'vite-cache',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
const day='2032-05-12', now='2032-05-11T01:00:00Z';
const policy={version:1,enabled:true,maximum_centavos:150000,temporary_threshold:2,temporary_days:30,permanent_threshold:3};
const baseUser={id:5,email:'shopper.'+'longname'.repeat(8)+'@example.test',email_verified_at:now,role:{slug:'shopper'},profile:{first_name:'Alexandra'+ 'Long'.repeat(8),last_name:'Shopper'+ 'Name'.repeat(8),phone_number:'09123456789',address:'A long address in Cebu City '+ 'Address'.repeat(12)}};
const store={store_id:1,store_name:'Store '+ 'Supermarket'.repeat(8),address:'Cebu City '+ 'LongStreet'.repeat(12)};
const products=Array.from({length:6},(_,i)=>({store_id:1,product_id:i+1,store_inventory_id:i+7,stock_version:1,product_name:i===0?'Rice '+ 'LongProductName'.repeat(8):['Milk','Eggs','Bananas','Bread','Water'][i-1],category:'Staples',sku:'SKU-'+String(i)+'x'.repeat(40),barcode:'1234567890123',size:'1 kg',selling_unit:'pack',selling_price:'67.25',available_stock:20,max_per_order:5}));
const item={order_item_id:1,store_inventory_id:7,product_name:products[0].product_name,sku:products[0].sku,size:'1 kg',selling_unit:'pack',quantity:2,unit_price_centavos:6725,line_total_centavos:13450,prepared_qty:2};
const order={order_id:9,order_reference:'GE-ORD-00000009',store_id:1,store_name:store.store_name,store_address:store.address,shopper_name:'Alexandra Shopper',status:'ready_for_pickup',claim_status:'claimable',payment_method:'cash_on_pickup',payment_status:'unpaid',reservation_status:'active',subtotal_centavos:13450,total_centavos:13450,service_fee_centavos:0,refund_status:'not_required',created_at:now,pickup_window_start_at:day+'T02:00:00Z',pickup_window_end_at:day+'T03:00:00Z',claim_expires_at:day+'T13:00:00Z',pickup_schedule_review_required:false,items:[item],history:[{id:1,previous_status:null,new_status:'waiting',changed_by_user_id:5,created_at:now,note:'Order accepted.'}],assignments:[],pickup:{verified_at:null,handed_over_at:null,claimant_name:null}};
let browser,activePage,activeErrors;
async function noOverflow(page,name) {
  const problem=await page.evaluate(()=>{const width=document.documentElement.clientWidth;return {width,scroll:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('main *,header *,#shopper-content *,dialog[open] *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>width+1);}).slice(0,7).map(e=>({tag:e.tagName,text:e.textContent.slice(0,60),class:e.className,rect:{left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}}))};});
  assert.ok(problem.scroll<=problem.width+1,name+' page overflow: '+JSON.stringify(problem));
  for(const dialog of await page.locator('dialog[open]').all())assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),name+' dialog overflow');
}
try {
 browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'msedge',headless:true});
 for(const [width,height] of [[320,640],[375,812],[390,844],[768,1024],[1024,768],[1440,900]].filter(([width])=>!process.env.QA_WIDTH||width===Number(process.env.QA_WIDTH))) {
  const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Los_Angeles'});await context.addCookies([{name:'XSRF-TOKEN',value:'qa',url:origin}]);
  let user=structuredClone(baseUser),unverified=false,loginFail=true,empty=false,failCatalog=false;
  const errors=[],writes=[];activeErrors=errors;
  await context.addInitScript(()=>sessionStorage.setItem('grocerease-cart-5',JSON.stringify({store_id:1,items:[]})));
  await context.route(/\/(?:api|sanctum)\//,async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/sanctum/csrf-cookie')return respond({});
   if(method!=='GET')writes.push({path,body:req.postDataJSON()});
   if(path==='/api/login')return loginFail?respond({message:'Check your email and password.'},422):respond({user});
   if(path==='/api/register')return respond({user:{...user,email:'new@example.test'},verification_email_sent:true});
   if(path==='/api/user')return respond({...user,email_verified_at:unverified?null:now});
   if(path==='/api/email/verification-notification')return respond({email_verified:false});
   if(path==='/api/shopper/profile') {user={...user,profile:{...user.profile,...req.postDataJSON()}};return respond({user,message:'Profile saved.'});}
   if(path==='/api/shopper/password')return respond({message:'Current password is incorrect.',errors:{current_password:['Current password is incorrect.']}},422);
   if(path==='/api/dashboard/summary')return respond({role:'shopper',server_time:now,active_orders:1,recent_active_orders:[{...order,item_quantity:2}],unread_notifications:1});
   if(path==='/api/shopper/stores')return respond({stores:[store]});
   if(path==='/api/shopper/selected-store')return respond({store});
   if(path.endsWith('/products'))return failCatalog?respond({message:'Catalog unavailable. Please retry.'},503):respond({store,products:empty?[]:products});
   if(path.includes('/ai-recommendations')) {
    const aiItems=products.map(p=>({...p,name:p.product_name,reason:'Available in this supermarket'}));
    if(path.endsWith('/ask'))return respond({store_id:1,data:{items:aiItems.slice(0,2).map(p=>({...p,quantity:1,line_total:67.25})),total:134.50,parsed:{budget:500}},meta:{enabled:true,understanding:'keyword'}});
    if(path.includes('/alternatives/'))return respond({store_id:1,data:aiItems,meta:{enabled:true,alternatives_enabled:true}});
    return respond({store_id:1,data:aiItems,meta:{enabled:true}});
   }
   if(path.endsWith('/payment-options'))return respond({digital:{available:false,channels:[],reason:'Sandbox unavailable in this fixture.'}});
   if(path==='/api/shopper/cop-status')return respond({cop:{allowed:true,individual_restricted:false,strike_count:0,lifetime_strike_count:0,sources:[],reason:'Cash on Pickup is available.',policy},history:[]});
   if(path.endsWith('/pickup-hours'))return respond({store_id:1,hours:{date:day,today:'2032-05-11',store_opens_at:'09:00',store_closes_at:'21:00',opens_at:'10:00',closes_at:'20:00',earliest_start_at:'10:00',windows:[{pickup_start:'10:00',pickup_end:'11:00'}]}});
   if(path==='/api/shopper/checkout/quote')return respond({quote_token:'qa-quote',quote:{store,items:[item],subtotal_centavos:13450,total_centavos:13450,service_fee_centavos:0,payment_method:'cash_on_pickup',cop_policy:policy,pickup_window_start_at:day+'T02:00:00Z',pickup_window_end_at:day+'T03:00:00Z',cop_claim_deadline_at:day+'T13:00:00Z'}});
   if(path==='/api/shopper/orders')return respond({orders:[order],server_time:now});
   if(path.endsWith('/pickup'))return respond({credential:{pin:'12345678',qr_token:'a'.repeat(64),expires_at:'2099-01-01T00:00:00Z'}});
   if(path.endsWith('/summary'))return respond({summary:{order:{...order,payment_confirmed:false}}});
   if(path==='/api/shopper/order-notifications')return respond({notifications:[{id:1,order_id:9,message:'Your order is ready. '+ 'LongNotification'.repeat(20),read_at:null,created_at:now}]});
   if(path.includes('/order-notifications/'))return respond({message:'Notification read.'});
   errors.push('Unhandled '+method+' '+path);return respond({message:'Unexpected fixture request'},500);
  });
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
  const screenshot=name=>page.screenshot({path:output+width+'-'+name+'.png',fullPage:!['checkout','menu','order-summary'].includes(name)});
  async function tab(name) {
   if(width<1024){await page.getByRole('button',{name:'Open Shopper menu',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();await page.locator('#shopper-mobile-menu').waitFor({state:'detached'});}
   else await page.getByRole('navigation',{name:'Shopper navigation',exact:true}).getByRole('button',{name,exact:true}).or(page.getByRole('navigation',{name:'Shopper account',exact:true}).getByRole('button',{name,exact:true})).click();
  }
  await page.goto(origin+'/');await page.getByRole('heading',{name:/Smart Grocery/}).waitFor();await noOverflow(page,'Landing '+width);await screenshot('landing');
  if(width<1024){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('link',{name:'Categories',exact:true}).click();await noOverflow(page,'Landing menu');}
  await page.getByRole('link',{name:'Login',exact:true}).click();await page.getByRole('heading',{name:'Welcome Back'}).waitFor();await noOverflow(page,'Login');
  await page.getByLabel('Email',{exact:true}).fill('shopper@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Login',exact:true}).click();await page.getByRole('alert').waitFor();await noOverflow(page,'Login error');
  if(width<640)assert.ok(await page.getByLabel('Email',{exact:true}).evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
  await page.getByRole('link',{name:'Register',exact:true}).click();await page.getByRole('heading',{name:'Create Your Account'}).waitFor();await noOverflow(page,'Register');await page.getByRole('button',{name:'Create Account',exact:true}).scrollIntoViewIfNeeded();await screenshot('register');
  unverified=true;await page.goto(origin+'/verify-email');await page.getByRole('heading',{name:/Verify your email|Check your email/}).waitFor();await noOverflow(page,'Verification');unverified=false;
  await page.goto(origin+'/shopper/dashboard');await page.getByRole('heading',{name:'Welcome, Shopper!'}).waitFor();await noOverflow(page,'Dashboard');await screenshot('dashboard');
  if(width<1024){const menu=page.getByRole('button',{name:'Open Shopper menu',exact:true});await menu.click();assert.equal(await page.evaluate(()=>document.querySelector('#shopper-mobile-menu').contains(document.activeElement)),true);await noOverflow(page,'Shopper menu');await screenshot('menu');await page.keyboard.press('Escape');await page.locator('#shopper-mobile-menu').waitFor({state:'detached'});assert.equal(await menu.evaluate(e=>e===document.activeElement),true);}
  await tab('Browse Products');await page.getByRole('button',{name:'Add to cart',exact:true}).first().waitFor();await noOverflow(page,'Browse');await screenshot('browse');
  empty=true;await page.getByRole('button',{name:'Refresh products',exact:true}).click();await page.getByText('No matching active products in this store.',{exact:true}).waitFor();await noOverflow(page,'Empty catalog');
  empty=false;failCatalog=true;await page.getByRole('button',{name:'Refresh products',exact:true}).click();await page.getByText('Catalog unavailable. Please retry.',{exact:true}).waitFor();await noOverflow(page,'Catalog error');failCatalog=false;await page.getByRole('button',{name:'Refresh products',exact:true}).click();await page.getByRole('button',{name:'Add to cart',exact:true}).first().waitFor();await page.getByRole('button',{name:'Add to cart',exact:true}).first().click();await page.getByRole('button',{name:'Open My Cart, 1 items',exact:true}).waitFor();
  await page.getByRole('button',{name:'Open My Cart, 1 items',exact:true}).click();await page.getByRole('heading',{name:'My Cart',exact:true}).waitFor();await noOverflow(page,'Cart');await screenshot('cart');
  await page.getByRole('button',{name:'Proceed to Checkout',exact:true}).click();await page.getByLabel('Pickup window',{exact:true}).selectOption('10:00/11:00');await page.getByRole('button',{name:'Review current prices and pickup schedule',exact:true}).click();await page.getByRole('button',{name:'Confirm / Place Order',exact:true}).waitFor({state:'visible'});await noOverflow(page,'Checkout');await screenshot('checkout');await page.getByRole('button',{name:'Back to cart',exact:true}).click();
  await tab('AI Recommendations');await page.getByRole('heading',{name:'AI Recommendations',exact:true}).waitFor();await page.getByRole('button',{name:'Add to Cart',exact:true}).first().waitFor();await noOverflow(page,'AI recommendations');await page.getByRole('textbox',{name:'What are you looking for today?'}).fill('Breakfast under 500');await page.getByRole('button',{name:'Get recommendations',exact:true}).click();await page.getByText('Estimated total:',{exact:false}).waitFor();await noOverflow(page,'AI result');await screenshot('ai-results');await page.getByRole('button',{name:'Upload image',exact:true}).click();await noOverflow(page,'AI upload');
  await tab('My Orders');await page.getByRole('button',{name:'Show QR / pickup PIN',exact:true}).waitFor();await noOverflow(page,'Orders');await page.getByRole('button',{name:'Show QR / pickup PIN',exact:true}).click();await page.getByText('12345678',{exact:true}).waitFor();await noOverflow(page,'Pickup QR');await screenshot('orders');await page.getByRole('button',{name:'View / Print Order Summary',exact:true}).click();await page.getByRole('heading',{name:'GrocerEase Order Summary'}).waitFor();await noOverflow(page,'Order summary');await screenshot('order-summary');await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  for(const [name,heading] of [['Pick up Information','Pickup Information'],['History','Order History'],['Payment Methods','Payment Methods'],['Notifications','Notifications']]) {await tab(name);await page.getByRole('heading',{name:heading,exact:true}).waitFor();await noOverflow(page,name);}
  await page.getByRole('button',{name:'Open your profile',exact:true}).click();await page.getByRole('heading',{name:'My Profile',exact:true}).waitFor();await noOverflow(page,'Profile');await page.getByRole('button',{name:'Edit Profile',exact:true}).click();await noOverflow(page,'Profile edit');await screenshot('profile');await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await tab('Settings');await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await noOverflow(page,'Settings');await page.getByRole('button',{name:'Change',exact:true}).click();await page.getByLabel('Current password',{exact:true}).fill('fixture');await noOverflow(page,'Password form');await screenshot('settings');
  if(width===390){await page.getByRole('button',{name:'Open Shopper menu',exact:true}).click();await page.setViewportSize({width:1280,height:800});await page.locator('#shopper-mobile-menu').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');await page.setViewportSize({width:390,height:420});await noOverflow(page,'Short viewport');await page.getByRole('group',{name:'Change your password',exact:true}).getByRole('button',{name:'Cancel',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('group',{name:'Change your password',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();}
  assert.equal(writes.filter(w=>w.path==='/api/shopper/orders').length,0,'Responsive checks must not place an order.');assert.deepEqual(errors,[]);await context.close();console.log('PASS: landing, auth, navigation, all Shopper tabs, cart/checkout, AI, QR/PIN, documents and forms at '+width+'px.');
 }
}catch(error){if(activePage&&!activePage.isClosed())await activePage.screenshot({path:output+'failure.png',fullPage:true});console.error('Browser errors:',JSON.stringify(activeErrors));throw error;}finally{await browser?.close();await server.close();}
