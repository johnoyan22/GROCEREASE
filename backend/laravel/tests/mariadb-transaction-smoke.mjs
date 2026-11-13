import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const php = process.env.PHP_BINARY || 'C:/xampp/php/php.exe';
const suffix = randomBytes(6).toString('hex');
await mkdir(fileURLToPath(new URL('../../../tmp/', import.meta.url)), { recursive: true });
function run(mode, index) {
  const args = ['tests/mariadb-transaction-smoke.php', mode, suffix];
  if (index !== undefined) args.push(String(index));
  return new Promise(function (resolve, reject) {
    execFile(php, args, { cwd, windowsHide: true, timeout: 30000 }, function (error, stdout, stderr) {
      if (error) { reject(new Error(stderr || stdout || error.message)); return; }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Unexpected isolated test output: '+stdout)); }
    });
  });
}
try {
  assert.equal((await run('setup')).status, 'isolated_schema_ready');
  assert.equal((await run('batch-current-read')).status, 'current_batch_safety_read_passed');
  const products = await Promise.all([run('create-product', 0), run('create-product', 1)]);
  assert.ok(products.every(result => result.status === 201));
  assert.notEqual(products[0].sku, products[1].sku);
  const receiving = await Promise.all([run('approve-receiving'), run('approve-receiving')]);
  assert.deepEqual(receiving.map(result => result.status).sort(), [200, 409]);
  const reservations = await Promise.all([run('reserve', 0), run('reserve', 1)]);
  assert.deepEqual(reservations.map(function (result) { return result.status; }).sort(), [201, 422]);
  await run('second-order');
  const assignments = await Promise.all([run('assign', 0), run('assign', 1)]);
  assert.deepEqual(assignments.map(function (result) { return result.status; }).sort(), [200, 409]);
  await run('prepare');
  const handovers = await Promise.all([run('handover'), run('handover')]);
  assert.deepEqual(handovers.map(function (result) { return result.status; }).sort(), [200, 409]);
  assert.equal((await run('verify')).status, 'all_invariants_passed');
  const invoices = await Promise.all([run('generate-invoice'), run('generate-invoice')]);
  assert.deepEqual(invoices.map(result => result.status).sort(), [200, 201]);
  assert.equal(invoices[0].reference, invoices[1].reference);
  console.log('PASS: isolated MariaDB migrations and 6 concurrency scenarios (SKU creation, receiving approval, reservation, worker assignment, handover, invoice generation).');
} finally {
  await run('cleanup');
  console.log('Temporary MariaDB test database and runtime file removed.');
}
