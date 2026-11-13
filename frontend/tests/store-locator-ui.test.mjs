import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:5173'});
for(const name of ['window','document','navigator','HTMLElement','Event','MouseEvent']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement:h}=await import('react');
const {createRoot}=await import('react-dom/client');
const {MemoryRouter}=await import('react-router-dom');
let server, root, Locator, GoogleMap;
before(async()=>{server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'}); Locator=(await server.ssrLoadModule('/src/components/public/StoreLocator.jsx')).default; GoogleMap=(await server.ssrLoadModule('/src/components/public/GoogleStoreMap.jsx')).default;});
afterEach(async()=>{if(root) {await act(async()=>root.unmount());root=null;} delete window.google;});
after(async()=>{await server.close();dom.window.close();});
async function mount(component,props={}) {root=createRoot(document.getElementById('root'));await act(async()=>root.render(h(MemoryRouter,null,h(component,props))));}
async function click(label) {const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===label);assert.ok(button,label);await act(async()=>button.click());}
const stores=[{store_id:2,store_name:'Farther registered fixture',address:'Fixture B',latitude:10.32,longitude:123.9},{store_id:1,store_name:'Nearest registered fixture',address:'Fixture A',latitude:10.301,longitude:123.9}];
test('locator stays honest without configured map or verified locations and never loads Google automatically',async t=>{
  t.mock.method(globalThis,'fetch',async url=>{assert.ok(url.endsWith('/public/store-locations'));return new Response(JSON.stringify({available:false,stores:[],message:'Store locations are being prepared.'}));});
  await mount(Locator);
  assert.match(document.body.textContent,/No verified stores are available/);assert.match(document.body.textContent,/interactive map is not available yet/);assert.equal(document.querySelector('script[src*="maps.googleapis.com"]'),null);assert.equal(document.querySelector('a[href*="maps/dir"]'),null);
});
test('location sharing is requested only on click and sorts registered stores without transmitting or persisting the origin',async t=>{
  const requests=[];let requestsForLocation=0;
  t.mock.method(globalThis,'fetch',async url=>{requests.push(url);return new Response(JSON.stringify({available:true,stores}));});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){requestsForLocation++;success({coords:{latitude:10.3,longitude:123.9}});}}});
  await mount(Locator);assert.equal(requestsForLocation,0);await click('Use my location');
  assert.match(document.body.textContent,/Confirm selected area/);await click('Confirm selected area');
  assert.equal(requestsForLocation,1);assert.match(document.querySelector('ol button[aria-pressed]').textContent,/Nearest registered fixture/);assert.equal(document.querySelectorAll('ol li').length,2);assert.equal(requests.length,1);assert.equal(window.localStorage.length,0);assert.match(document.body.textContent,/straight-line distance/);
});
test('Google map adapter accepts click, drag and keyboard-center pins and removes markers/listeners on unmount using a provider stub',async()=>{
  const maps=[],markers=[],picked=[];
  class FakeMap {constructor(){this.events={};maps.push(this);}addListener(name,fn){this.events[name]=fn;return{remove:()=>delete this.events[name]};}panTo(point){this.center=point;}getCenter(){return{toJSON:()=>({lat:10.4,lng:123.8})};}}
  class FakeMarker {constructor(options){Object.assign(this,options);this.events={};markers.push(this);}addListener(name,fn){this.events[name]=fn;return{remove:()=>delete this.events[name]};}}
  window.google={maps:{importLibrary:async name=>name==='maps'?{Map:FakeMap}:{AdvancedMarkerElement:FakeMarker,PinElement:class {}}}};
  await mount(GoogleMap,{stores,origin:null,onPick:point=>picked.push(point),apiKey:'provider-stub-only',mapId:'provider-stub-only'});
  await act(async()=>maps[0].events.click({latLng:{toJSON:()=>({lat:10.3,lng:123.9})}}));
  const pin=markers.find(marker=>marker.gmpDraggable);pin.position={lat:10.31,lng:123.91};await act(async()=>pin.events.dragend());await click('Use map center as my pin');
  assert.deepEqual(picked,[{lat:10.3,lng:123.9},{lat:10.31,lng:123.91},{lat:10.4,lng:123.8}]);
  assert.equal(document.querySelector('script[src*="maps.googleapis.com"]'),null);
  await act(async()=>window.gm_authFailure());assert.match(document.body.textContent,/Google Maps is unavailable/);
  await act(async()=>root.unmount());root=null;assert.ok(markers.every(marker=>marker.map===null));assert.equal(Object.keys(maps[0].events).length,0);
});
