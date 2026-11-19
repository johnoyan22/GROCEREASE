import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const suffix = randomBytes(6).toString('hex');
await mkdir(fileURLToPath(new URL('../../../tmp/', import.meta.url)), { recursive: true });
function run(mode, index = 0) {
  return new Promise((resolve, reject) => {
    execFile(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['tests/mariadb-correction-smoke.php', mode, suffix, String(index)],
      { cwd, windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || stdout || error.message));
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error(stdout)); }
      });
  });
}
try {
  assert.equal((await run('setup')).status, 'ready');
  assert.equal((await run('search')).status, 'passed');
  assert.deepEqual((await Promise.all([run('duplicate'), run('duplicate')])).map((r) => r.status).sort(), [200, 201]);
  assert.equal((await run('reject')).status, 200);
  assert.deepEqual((await Promise.all([run('race-submit', 0), run('race-submit', 1)])).map((r) => r.status).sort(), [201, 409]);
  assert.deepEqual((await Promise.all([run('approve', 0), run('approve', 1)])).map((r) => r.status).sort(), [200, 409]);
  assert.equal((await run('verify-initial')).status, 'passed');
  assert.equal((await run('receipt-setup')).status, 'ready');
  const receiptRace = await Promise.all([run('approve', 0), run('receipt')]);
  assert.ok([200, 409].includes(receiptRace[0].status));
  assert.equal(receiptRace[1].status, 200);
  assert.equal((await run('reservation-setup')).status, 'ready');
  const reservationRace = await Promise.all([run('approve', 1), run('reserve')]);
  assert.ok([200, 409].includes(reservationRace[0].status));
  assert.ok([201, 409, 422].includes(reservationRace[1].status));
  assert.equal((await run('handover-setup')).status, 'ready');
  const handoverRace = await Promise.all([run('approve', 1), run('handover')]);
  assert.ok([200, 409].includes(handoverRace[0].status));
  assert.equal(handoverRace[1].status, 200);
  assert.equal((await run('verify')).status, 'passed');
  console.log('PASS: isolated MariaDB exact-batch corrections; duplicate submit/approval; racing active requests, receipt, reservation, handover; stable number search and immutable receiving evidence.');
} finally {
  await run('cleanup');
  console.log('Temporary correction database and runtime file removed.');
}
