import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { storeDestination, storeIntent } from '../src/services/storeIntent.js';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:5173',pretendToBeVisual:true});
for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement:h}=await import('react');
const {createRoot}=await import('react-dom/client');
const {MemoryRouter}=await import('react-router-dom');
let server,root,Catalog,Reports,Transactions,Browse;
before(async()=>{server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'}); Catalog=(await server.ssrLoadModule('/src/components/public/PublicCatalog.jsx')).default; Reports=(await server.ssrLoadModule('/src/components/reports/ReportWorkspace.jsx')).default; Transactions=(await server.ssrLoadModule('/src/components/orders/TransactionRecords.jsx')).default; Browse=(await server.ssrLoadModule('/src/components/Shoppers/ShopperBrowseProducts.jsx')).default;});
afterEach(async()=>{if(root){await act(async()=>root.unmount());root=null;}});
after(async()=>{await server.close();dom.window.close();});
async function mount(component,props={}){root=createRoot(document.getElementById('root'));await act(async()=>root.render(h(MemoryRouter,null,h(component,props))));}
async function click(label){const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===label);assert.ok(button,label);await act(async()=>button.click());}
async function input(element,value){await act(async()=>{const prototype=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));});}
const store={store_id:2,store_name:'Public fixture store',address:'Verified fixture address'};
const product={product_id:5,store_id:2,product_name:'Real fixture rice',category:'Staples',size:'1 kg',selling_unit:'pack',selling_price:'67.25',availability:'available',image_url:null};
const catalog={store,products:[product],categories:['Staples'],pagination:{page:1,per_page:12,total:1,last_page:1}};
test('public catalog presents real response fields, search/categories and auth links without any cart or quantity control',async t=>{
 const reads=[];t.mock.method(globalThis,'fetch',async url=>{reads.push(new URL(url));return new Response(JSON.stringify(catalog));});
 await mount(Catalog,{store});assert.match(document.body.textContent,/Real fixture rice/);assert.match(document.body.textContent,/₱67.25/);assert.match(document.body.textContent,/per pack/);assert.equal(document.querySelector('input[type="number"]'),null);assert.doesNotMatch(document.body.textContent,/Add to cart/i);assert.equal(document.querySelector('a[href="/login?store=2"]').textContent,'Login to Start Shopping');
 await input(document.querySelector('input[type="search"]'),'rice');await click('Search');assert.equal(reads.at(-1).searchParams.get('search'),'rice');assert.equal(reads.at(-1).searchParams.get('page'),'1');
 await input(document.querySelector('select'),'Staples');assert.equal(reads.at(-1).searchParams.get('category'),'Staples');assert.equal(reads.every(url=>url.pathname==='/api/public/stores/2/products'),true);
});
test('authenticated preview only offers a safe store intent link and unavailable or empty catalogs are honest',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({...catalog,products:[],pagination:{...catalog.pagination,total:0}})));
 await mount(Catalog,{store,role:'shopper'});assert.equal(document.querySelector('a[href="/shopper/dashboard?store=2"]').textContent,'Shop at this store');assert.match(document.body.textContent,/No available products/);assert.doesNotMatch(document.body.textContent,/Add to cart/i);
});
test('ordinary transaction records have no generic PDF export while Reports has only worker stock kinds',async t=>{
 t.mock.method(globalThis,'fetch',async url=>new Response(JSON.stringify(url.includes('/reports/')?{report:{report_title:'Current stock',scope:'Assigned store',period_label:'Current snapshot',generated_at:'Nov 13, 2026 (Asia/Manila)',headings:['Product'],rows:[['Rice']],totals:{Products:1},note:'Snapshot'},pagination:{page:1,total:1,last_page:1}}:{transactions:[],store:null})));
 await mount(Transactions,{role:'supervisor',report:false});assert.doesNotMatch(document.body.textContent,/Export PDF/);
 await act(async()=>root.unmount());root=null;await mount(Reports,{role:'inventory_worker'});assert.match(document.body.textContent,/Export PDF/);const reportSelect=document.querySelector('select');assert.deepEqual([...reportSelect.options].map(option=>option.value),['stock','low-stock']);assert.match(document.body.textContent,/Assigned store/);
});
test('report export waits for displayed filters to be applied and the same filtered dataset to load',async t=>{
 const reads=[];t.mock.method(globalThis,'fetch',async url=>{reads.push(new URL(url));return new Response(JSON.stringify({report:{report_title:'Current stock',scope:'Store A',period_label:'Current snapshot',generated_at:'PH time',headings:['Product'],rows:[],totals:{Products:0},note:'Snapshot'},pagination:{page:1,total:0,last_page:1}}));});
 await mount(Reports,{role:'inventory_worker'});const exportButton=()=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Export PDF'));assert.equal(exportButton().disabled,false);
 await input(document.querySelector('input[type="search"]'),'Rice');assert.equal(exportButton().disabled,true);await click('Apply filters');assert.equal(reads.at(-1).pathname,'/api/inventory/reports/stock');assert.equal(reads.at(-1).searchParams.get('search'),'Rice');assert.equal(exportButton().disabled,false);assert.match(document.body.textContent,/No records match/);
});
test('public store intent cannot clear a mixed-store cart until the existing explicit switch confirmation',async()=>{
 const switched=[];const shopping={cart:{store_id:1,items:[{store_inventory_id:7,quantity:1}]},storeId:1,stores:[{store_id:1,store_name:'Current store',address:'A'},store],storesError:'',storesLoading:false,catalog:{store:null,products:[],loading:false,error:''},summary:{subtotalCentavos:0},quantity:1,pricesAvailable:true,refresh(){},switchStore:id=>switched.push(id),changeQuantity(){},message:'',recovery:{loading:false,error:''},locked:false};
 await mount(Browse,{shopping,search:'',setSearch(){},requestedStoreId:2,onDismissStoreRequest(){}});assert.deepEqual(switched,[]);await click('Use previewed store');assert.match(document.body.textContent,/Switching stores clears/);assert.deepEqual(switched,[]);await click('Keep current store');assert.deepEqual(switched,[]);await click('Use previewed store');await click('Clear cart and switch');assert.deepEqual(switched,[2]);
});
test('store intent accepts only safe positive IDs and never uses a visitor-supplied redirect URL',()=>{
 for(const value of [null,0,-1,'1.2','//example.com','https://example.com','2&role=admin','9007199254740999'])assert.equal(storeIntent(value),null);
 assert.equal(storeIntent('2'),2);assert.equal(storeDestination('/login','2'),'/login?store=2');assert.equal(storeDestination('/login?verification=required','2'),'/login?verification=required&store=2');assert.equal(storeDestination('/login','//example.com'),'/login');
});
