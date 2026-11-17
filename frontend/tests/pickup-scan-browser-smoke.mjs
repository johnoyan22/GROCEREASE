// Production components and ZXing decoding; simulated video input, never hardware acceptance.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../tmp/pdfs/pickup/', import.meta.url));
await mkdir(output, { recursive: true });
const token = 'abcdef0123456789'.repeat(4);
const entry = '/__pickup-scan.js';
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false }, plugins: [{
  name: 'pickup-scan-fixture',
  resolveId(id) { if (id === entry) return '\0pickup-scan.js'; },
  load(id) {
    if (id !== '\0pickup-scan.js') return;
    return `import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/index.css';
      import QRCode from 'qrcode'; import Pickup from '/src/components/orders/PickupClaimModal.jsx';
      import Workspace from '/src/components/orders/OrderWorkspace.jsx';
      import {OrderDocumentDialog} from '/src/components/orders/OrderReceipt.jsx';
      const params=new URLSearchParams(location.search);
      window.streams=[]; window.mediaCalls=[]; window.cameraMode='normal'; window.cameraCode='';
      const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=640;
      const ctx=canvas.getContext('2d'); ctx.fillStyle='white'; ctx.fillRect(0,0,640,640);
      setInterval(()=>ctx.drawImage(canvas,0,0),65); // Simulated camera keeps producing frames.
      window.setCameraCode=async code=>{window.cameraCode=code; const img=new Image(); img.src=await QRCode.toDataURL(code,{width:600,margin:4}); await img.decode(); ctx.fillStyle='white';ctx.fillRect(0,0,640,640);ctx.drawImage(img,20,20,600,600);};
      window.actualImageDecode=async code=>{const {BrowserQRCodeReader}=await import('@zxing/browser'); const img=new Image();img.src=await QRCode.toDataURL(code);await img.decode();return new BrowserQRCodeReader().decodeFromImageElement(img).then(r=>r.getText());};
      navigator.mediaDevices.getUserMedia=async constraints=>{window.mediaCalls.push(constraints);
        if(window.cameraMode==='denied') throw new DOMException('Denied','NotAllowedError');
        if(window.cameraMode==='busy') throw new DOMException('Busy','NotReadableError');
        if(window.cameraMode==='missing') throw new DOMException('Missing','NotFoundError');
        const make=()=>{const stream=canvas.captureStream(15);window.streams.push(stream);return stream;};
        if(window.cameraMode==='late') return new Promise(resolve=>{window.releaseLateCamera=()=>resolve(make());});
        return make();};
      navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'rear',label:'Rear'},{kind:'videoinput',deviceId:'front',label:'Front'}];
      function App(){const [open,setOpen]=React.useState(false),[doc,setDoc]=React.useState(null),[done,setDone]=React.useState(null);
        if(params.get('view')==='workspace') return React.createElement(Workspace,{role:'supervisor'});
        if(params.get('view')==='document') return React.createElement(OrderDocumentDialog,{orderId:1,role:'shopper',summary:!params.has('receipt'),onClose:()=>{}});
        return React.createElement('main',{className:'p-5'},React.createElement('button',{onClick:()=>setOpen(true)},'Scan QR'),
          done&&React.createElement('p',{},done.order_reference+' Already claimed'),
          open&&React.createElement(Pickup,{storeId:1,orderContext:params.has('context')?{order_id:2,order_reference:'GE-ORD-00000002'}:null,onClose:()=>setOpen(false),onClaimed:order=>{window.claimed=order;setDone(order);setOpen(false)},onDocument:id=>{setOpen(false);setDoc(id)}}),
          doc&&React.createElement(OrderDocumentDialog,{orderId:doc,role:'supervisor',summary:true,onClose:()=>setDoc(null)}));}
      createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));`;
  },
  configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith('/__pickup-scan?')) return next();
    res.setHeader('Content-Type', 'text/html');
    res.end(await vite.transformIndexHtml('/__pickup-scan', `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));
  }); },
}] });
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const baseOrder = { order_id: 1, order_reference: 'GE-ORD-00000001', store_id: 1, store_name: 'QA Store', store_address: 'QA address', shopper_name: 'Saved Shopper', status: 'ready_for_pickup', payment_method: 'cash_on_pickup', payment_status: 'unpaid', payment_display_status: 'Unpaid', claim_status: 'claimable', reservation_status: 'active', subtotal_centavos: 10000, service_fee_centavos: 0, total_centavos: 10000, created_at: '2026-11-17T01:00:00Z', pickup_window_start_at: '2026-11-18T02:00:00Z', pickup_window_end_at: '2026-11-18T03:00:00Z', items: [{ product_name: 'Rice', size: '1 kg', selling_unit: 'pack', quantity: 2, unit_price_centavos: 5000, line_total_centavos: 10000 }], pickup: { payment_valid: false, verified_at: null }, assignments: [], history: [] };
let browser;
try {
  browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'msedge', headless: true });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'qa', url: origin }]);
    let order = structuredClone(baseOrder), loseClaimResponse = false, previewDelay = 0, resolvedStore = 1, previewLifetime = 3600000;
    const writes = [], errors = [];
    await context.route('http://localhost:8000/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
      const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (method === 'OPTIONS' || path === '/sanctum/csrf-cookie') return respond({});
      if (method !== 'GET') writes.push({ path, method, body: request.postDataJSON() });
      if (path === '/api/supervisor/workers') return respond({ store: { store_id: resolvedStore }, workers: [] });
      if (path === '/api/staff/orders') return respond({ store: { store_id: 1, store_name: 'QA Store' }, orders: [], server_time: new Date().toISOString() });
      if (path === '/api/supervisor/order-reference') return respond({ order });
      if (path === '/api/supervisor/pickup/resolve') {
        const body = request.postDataJSON();
        if (previewDelay) await new Promise(resolve => setTimeout(resolve, previewDelay));
        if (body.order_context === 2) return respond({ message: 'This code belongs to a different order.' }, 409);
        if (body.method === 'pin') { assert.equal(body.reference, order.order_reference); assert.equal(body.credential, '00123456'); }
        else assert.equal(body.credential, token);
        return respond({ order, credential_expires_at: new Date(Date.now() + previewLifetime).toISOString() });
      }
      if (path.endsWith('/cash-payment')) {
        assert.deepEqual(request.postDataJSON(), { cashier_name: 'Actual Cashier', evidence_reference: 'Genuine cashier evidence', cash_collected: true });
        order = { ...order, payment_status: 'paid', pickup: { ...order.pickup, payment_valid: true } };
        return respond({ order, message: 'Saved payment' });
      }
      if (path.endsWith('/claim')) {
        const body = request.postDataJSON(); assert.equal(body.identity_checked, true); assert.equal(body.physically_handed_over, true); assert.equal(body.payment_status, undefined);
        order = { ...order, status: 'completed', claim_status: 'completed', reservation_status: 'fulfilled' };
        if (loseClaimResponse) return route.abort('failed');
        return respond({ order, message: 'Claimed' });
      }
      if (path.endsWith('/summary') || path.endsWith('/receipt')) {
        const isReceipt = path.endsWith('/receipt');
        const docOrder = { ...order, payment_confirmed: isReceipt, sandbox: isReceipt, items: order.items };
        return respond({ [isReceipt ? 'receipt' : 'summary']: { order: docOrder, receipt_number: 'GE-1-1', amount_paid_centavos: 10000, claimant_name: 'Actual Claimant', handed_over_at: '2026-11-18T02:30:00Z' } });
      }
      throw new Error('Unexpected fixture request '+path);
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const goto = suffix => page.goto(origin+'/__pickup-scan?'+suffix);
    const open = async () => { await page.getByRole('button', { name: 'Scan QR', exact: true }).click(); await page.getByRole('dialog').waitFor(); };
    const pin = async () => { await page.getByRole('button', { name: 'Use PIN instead' }).click(); await page.getByLabel('Exact GrocerEase order reference').fill(order.order_reference); await page.getByLabel('8-digit pickup PIN').fill('00123456'); await page.getByRole('button', { name: 'Validate PIN' }).click(); await page.getByText(order.order_reference, { exact: true }).waitFor(); };
    await goto(''); await open(); assert.equal(await page.evaluate(() => window.mediaCalls.length), 0);
    assert.equal(await page.evaluate(code => window.actualImageDecode(code), token), token);
    await page.getByRole('button', { name: 'Open Camera', exact: true }).click();
    await page.getByLabel('Camera', { exact: true }).waitFor({ timeout: 10000 }).catch(async error => { console.log(await page.locator('body').innerText()); console.log(errors); throw error; });
    await page.getByLabel('Camera', { exact: true }).selectOption('front');
    await page.waitForFunction(() => window.streams.length === 2);
    assert.equal(await page.evaluate(() => window.streams[0].getTracks().every(t => t.readyState === 'ended')), true);
    await page.evaluate(code => window.setCameraCode(code), token);
    await page.getByText(order.order_reference, { exact: true }).waitFor();
    assert.equal(writes.filter(write => write.path.endsWith('/resolve')).length, 1);
    assert.equal(await page.evaluate(() => window.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
    assert.equal(await page.getByRole('checkbox').filter({ hasText: '' }).count(), 3);
    assert.equal(await page.getByRole('checkbox').evaluateAll(nodes => nodes.every(node => !node.checked)), true);
    assert.equal(await page.getByRole('button', { name: 'Confirm & Mark Claimed' }).isDisabled(), true);
    await page.getByLabel('Claiming as').selectOption('representative'); await page.getByLabel("Actual claimant's full name").fill('Actual Representative');
    await page.getByLabel('Cashier name', { exact: true }).fill('Actual Cashier'); await page.getByLabel('Receipt / cashier confirmation reference').fill('Genuine cashier evidence');
    await page.getByRole('checkbox', { name: /cashier collected/ }).check(); await page.getByRole('button', { name: 'Save cash payment' }).click();
    await page.getByText(/Payment confirmed/).waitFor();
    await page.getByRole('checkbox', { name: /checked the actual claimant/ }).check(); await page.getByRole('checkbox', { name: /physically handed/ }).check();
    await page.screenshot({ path: output+`confirmation-${width}.png` });
    await page.getByRole('button', { name: 'Confirm & Mark Claimed' }).dblclick();
    await page.getByText(/Already claimed/).waitFor();
    assert.equal(writes.filter(write => write.path.endsWith('/claim')).length, 1);
    assert.equal(writes.find(write => write.path.endsWith('/claim')).body.claimant_name, 'Actual Representative');
    assert.ok(!writes.some(write => write.path.endsWith('/pickup-verification') || write.path.endsWith('/handover')));
    order = { ...structuredClone(baseOrder), payment_status: 'paid', pickup: { payment_valid: true } };
    await goto(''); await open(); await pin();
    assert.equal(await page.getByLabel('Cashier name', { exact: true }).count(), 0);
    await page.getByRole('checkbox', { name: /checked the actual claimant/ }).check(); await page.getByRole('checkbox', { name: /physically handed/ }).check();
    loseClaimResponse = true; await page.getByRole('button', { name: 'Confirm & Mark Claimed' }).click();
    await page.getByRole('button', { name: 'Check saved order result' }).click(); await page.getByText(/Already claimed/).waitFor(); loseClaimResponse = false;
    assert.equal(writes.filter(write => write.path.endsWith('/claim')).at(-1).body.claimant_name, undefined);
    await goto('context=2'); await open(); await page.evaluate(code => window.setCameraCode(code), token); await page.getByRole('button', { name: 'Open Camera', exact: true }).click(); await page.getByText('This code belongs to a different order.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirm & Mark Claimed' }).count(), 0);
    const beforeInvalid = writes.length;
    await goto(''); await open(); await page.evaluate(() => window.setCameraCode('https://example.com/foreign-qr')); await page.getByRole('button', { name: 'Open Camera', exact: true }).click(); await page.getByText('This is not a GrocerEase pickup QR. Rescan or use the pickup PIN.').waitFor();
    assert.equal(writes.length, beforeInvalid); assert.ok(page.url().startsWith(origin));
    order = structuredClone(baseOrder); previewLifetime = 1500;
    await goto(''); await open(); await pin(); await page.getByRole('checkbox', { name: /checked the actual claimant/ }).check();
    await page.getByText('This preview expired. Scan again or use a current PIN.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirm & Mark Claimed' }).count(), 0); previewLifetime = 3600000;
    await goto(''); await open(); await page.getByRole('button', { name: 'Open Camera', exact: true }).click(); await page.getByLabel('Camera', { exact: true }).waitFor();
    resolvedStore = 2; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true); resolvedStore = 1;
    for (const mode of ['denied', 'busy', 'missing']) {
      await goto(''); await open(); await page.evaluate(value => { window.cameraMode = value; }, mode); await page.getByRole('button', { name: 'Open Camera', exact: true }).click(); await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').textContent(), /PIN/); await page.keyboard.press('Escape');
    }
    await goto(''); await open(); await page.evaluate(() => { window.cameraMode = 'late'; }); await page.getByRole('button', { name: 'Open Camera', exact: true }).click();
    await page.waitForFunction(() => Boolean(window.releaseLateCamera)); await page.keyboard.press('Escape'); await page.evaluate(() => window.releaseLateCamera());
    await page.waitForFunction(() => window.streams.length && window.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')));
    order = structuredClone(baseOrder); previewDelay = 300;
    await goto(''); await open(); await page.getByRole('button', { name: 'Use PIN instead' }).click(); await page.getByLabel('Exact GrocerEase order reference').fill(order.order_reference); await page.getByLabel('8-digit pickup PIN').fill('00123456'); await page.getByRole('button', { name: 'Validate PIN' }).click(); await page.keyboard.press('Escape');
    await page.waitForTimeout(400); assert.equal(await page.getByRole('dialog').count(), 0); previewDelay = 0;
    await goto('view=workspace'); await page.getByRole('searchbox').fill(order.order_reference); await page.getByRole('button', { name: 'Find exact reference' }).click(); await page.getByText('Saved Shopper - QA Store').waitFor();
    await page.getByRole('button', { name: 'Confirm pickup / QR or PIN' }).click(); await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await goto('view=document'); await page.getByRole('heading', { name: 'GrocerEase Order Summary' }).waitFor(); await page.getByText('Grand total:', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 1440) {
      await page.pdf({ path: output+'summary-short.pdf', preferCSSPageSize: true });
      order.items = Array.from({ length: 110 }, (_, i) => ({ ...baseOrder.items[0], product_name: 'QA item '+(i+1)+' with saved product details' }));
      await goto('view=document'); await page.getByText('QA item 110 with saved product details').waitFor();
      await page.pdf({ path: output+'summary-long.pdf', preferCSSPageSize: true });
      await goto('view=document&receipt=1'); await page.getByText('Actual claimant: Actual Claimant').waitFor();
      await page.pdf({ path: output+'receipt-long.pdf', preferCSSPageSize: true });
    }
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}px: actual QR image/video decode, media lifecycle, PIN/claim/payment/recovery, reference lookup and document layout.`);
  }
} finally { await browser?.close(); await server.close(); }
