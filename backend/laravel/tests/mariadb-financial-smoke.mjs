import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const suffix = randomBytes(6).toString('hex'), cwd = fileURLToPath(new URL('..', import.meta.url));
function run(action, args = {}) {
  return new Promise((resolve, reject) => execFile(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['tests/mariadb-financial-smoke.php', action, suffix, JSON.stringify(args)], { cwd, windowsHide: true, timeout: 60000 }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr || stdout || error.message));
    try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Unexpected finance result: '+stdout)); }
  }));
}
const call = (action, args = {}) => run(action, { key: randomUUID(), ...args });
const statuses = results => results.map(r => r.status).sort();
try {
  assert.equal((await run('setup')).status, 200);
  assert.deepEqual(statuses(await Promise.all([call('contribute',{amount:'300.00',actor:0}),call('contribute',{amount:'300.00',actor:1})])),[200,409]);
  const key = randomUUID();
  const repeated = await Promise.all([call('contribute',{amount:'100.00',key}),call('contribute',{amount:'100.00',key})]);
  assert.deepEqual(statuses(repeated),[200,200]); assert.deepEqual(repeated[0].result,repeated[1].result);
  let state = await run('inspect'); assert.equal(state.available,40000); assert.equal(state.movements,2); assert.equal(state.actual,0);
  assert.deepEqual(statuses(await Promise.all([call('reserve',{amount:'250.00',actor:0}),call('reserve',{amount:'250.00',actor:1})])),[200,409]);
  state = await run('inspect'); assert.equal(state.available,15000); assert.equal(state.reserved,25000);
  assert.deepEqual(statuses(await Promise.all([call('release',{id:state.reservation,actor:0}),call('release',{id:state.reservation,actor:1})])),[200,409]);
  state = await run('inspect'); assert.equal(state.available,40000); assert.equal(state.reserved,0);
  assert.deepEqual(statuses(await Promise.all([call('policy',{actor:0}),call('policy',{actor:1})])),[200,409]);
  assert.deepEqual(statuses(await Promise.all([call('bill',{from:'2026-02-01',actor:0}),call('bill',{from:'2026-02-02',actor:1})])),[200,409]);
  assert.deepEqual(statuses(await Promise.all([call('reserve',{amount:'400.00',actor:0}),call('reverse_payment',{actor:1})])),[200,409]);
  state = await run('inspect'); assert.ok(state.available>=0); assert.ok(state.reserved>=0);
  assert.equal(state.available+state.reserved,state.reversed ? 0 : 40000);
  console.log('PASS: isolated MariaDB migrations; stale-snapshot concurrent source allocation, identical retry, budget reservation, one-time release, policy edit, overlapping bill, reversal/reservation race; Actual isolation.');
} finally { await run('cleanup'); console.log('Disposable financial schema removed.'); }
