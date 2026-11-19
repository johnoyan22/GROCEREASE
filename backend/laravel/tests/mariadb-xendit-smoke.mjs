import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const suffix=randomBytes(6).toString('hex'),cwd=fileURLToPath(new URL('..',import.meta.url));
function run(action){return new Promise((resolve,reject)=>execFile(process.env.PHP_BINARY||'C:/xampp/php/php.exe',['tests/mariadb-xendit-smoke.php',action,suffix],{cwd,windowsHide:true,timeout:60000},(error,stdout,stderr)=>{
  if(error)return reject(new Error(stderr||stdout||error.message));try{resolve(JSON.parse(stdout));}catch{reject(new Error('Unexpected isolated result: '+stdout));}
}));}
try{
  const setup=await run('setup');assert.equal(setup.status,200);assert.equal(setup.backfill_preserved,true);
  const starts=await Promise.all([run('start'),run('start')]);assert.ok(starts.some(r=>r.status===200));assert.ok(starts.every(r=>[200,409].includes(r.status)));
  let state=await run('inspect');assert.equal(state.posts,1);assert.equal(state.orders,2);assert.equal(state.stock,4);
  const deliveries=await Promise.all([run('notify'),run('notify')]);assert.ok(deliveries.every(r=>r.status===200));
  state=await run('inspect');assert.equal(state.events,1);assert.equal(state.payments,0);assert.equal(state.processed,0);
  const race=await Promise.all([run('worker'),run('worker'),run('cancel'),run('expire')]);assert.equal(race[0].status,200);assert.equal(race[1].status,200);assert.equal(race[2].status,409);assert.equal(race[3].status,200);
  state=await run('inspect');assert.equal(state.payments,1);assert.equal(state.processed,1);assert.equal(state.paid,'paid');assert.equal(state.stock,4);assert.equal(state.reservation,'active');assert.equal(state.notices,1);assert.equal(state.order_status,'waiting');
  await run('expired-notify');await Promise.all([run('worker'),run('worker'),run('notify')]);
  state=await run('inspect');assert.equal(state.payments,1);assert.equal(state.processed,2);assert.equal(state.stock,4);assert.equal(state.notices,1);assert.equal(state.posts,1);
  console.log('PASS: isolated MariaDB legacy backfill preservation; concurrent single creation, durable semantic duplicate receipts, competing workers/cancel/expiry, reordered expiry, one capture/payment/notice and unchanged reserved stock. Provider HTTP fakes only.');
}finally{await run('cleanup');console.log('Disposable Xendit schema removed.');}
