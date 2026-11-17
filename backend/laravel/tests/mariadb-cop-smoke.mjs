import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const suffix = randomBytes(6).toString('hex'), cwd = fileURLToPath(new URL('..', import.meta.url));
function run(mode, argument = 0) {
  return new Promise((resolve, reject) => execFile(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['tests/mariadb-cop-smoke.php', mode, suffix, String(argument)], { cwd, windowsHide: true, timeout: 60000 }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr || stdout || error.message));
    try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Unexpected COP result: '+stdout)); }
  }));
}
const inspect = () => run('inspect');
try {
  assert.equal((await run('setup')).status, 'isolated_schema_ready');
  let results = await Promise.all([run('restrict', 0), run('restrict', 0)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
  let state = await inspect(); assert.equal(state.manual_active, 1); assert.equal(state.events, 1); assert.equal(state.strikes, 0);
  results = await Promise.all([run('restore', state.status.version), run('restrict-change', state.status.version)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
  await run('ensure-restored');
  results = await Promise.all([run('policy-a', 1), run('policy-b', 1)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]); assert.equal((await inspect()).policy_versions, 2);
  await run('ready', 0); state = await inspect();
  results = await Promise.all([run('deadline'), run('restrict', state.status.version)]);
  assert.equal(results[0].status, 200); assert.ok([200,409].includes(results[1].status));
  state = await inspect(); assert.equal(state.strikes, 1); assert.equal(state.incidents, 1); assert.equal(state.notifications, 1);
  await run('ready', 1); const version = state.status.version;
  results = await Promise.all([run('deadline'), run('deadline'), run('correct', version)]);
  assert.equal(results[0].status, 200); assert.equal(results[1].status, 200); assert.ok([200,409].includes(results[2].status));
  state = await inspect(); assert.equal(state.strikes, 2); assert.equal(state.incidents, 2); assert.equal(state.notifications, 2 + state.voided);
  // Restoration and a newly issued incident serialize on the same Shopper and preserve cycle semantics.
  if (!state.status.individual_restricted) await run('restrict', state.status.version);
  await run('ready', 2); state = await inspect();
  results = await Promise.all([run('restore', state.status.version), run('deadline')]);
  assert.ok([200,409].includes(results[0].status)); assert.equal(results[1].status, 200);
  state = await inspect(); assert.equal(state.strikes, 3); assert.equal(state.incidents, 3);
  if (results[0].status === 200) { assert.equal(state.status.strike_count, 1); assert.equal(state.status.allowed, true); }
  await run('ensure-restored'); await run('prepare-checkout'); state = await inspect();
  results = await Promise.all([run('restrict', state.status.version), run('checkout')]);
  assert.equal(results[0].status, 200); assert.ok([201,422].includes(results[1].status));
  state = await inspect(); assert.equal(state.reserved, results[1].status === 201 ? 5 : 4); assert.equal(state.orders, state.reserved);
  if (results[1].status === 422) { await run('ensure-restored'); assert.equal((await run('checkout')).status, 201); state = await inspect(); await run('restrict', state.status.version); }
  assert.equal((await run('disable', 2)).status, 200);
  assert.equal((await run('checkout')).status, 200); // Matching retries recover accepted orders after both changes.
  state = await inspect(); results = await Promise.all([run('correct', state.status.version), run('correct', state.status.version)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
  state = await inspect(); assert.equal(state.manual_active, 1); assert.equal(state.status.allowed, false); assert.equal(state.orders, 5); assert.equal(state.reserved, 5);
  console.log('PASS: isolated MariaDB migrations; duplicate/stale policy and access actions; restrict/restore, correction/deadline, duplicate deadlines, restoration/new-cycle issuance and checkout/access races; accepted retry after policy disable; no stock/audit/notification duplication.');
} finally { await run('cleanup'); console.log('Isolated COP database and fixture removed.'); }
