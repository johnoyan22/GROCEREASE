import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const suffix = randomBytes(6).toString('hex');
function run(mode, index = 0) {
  return new Promise((resolve, reject) => {
    execFile(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['tests/mariadb-transaction-smoke.php', mode, suffix, String(index)],
      { cwd, windowsHide: true, timeout: 40000 }, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || stdout || error.message));
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Unexpected isolated test output: '+stdout)); }
      });
  });
}
try {
  assert.equal((await run('setup')).status, 'isolated_schema_ready');
  assert.equal((await run('reserve')).status, 201);
  await run('second-order'); await run('assign'); await run('prepare-claim');
  const results = await Promise.all([run('claim', 0), run('claim', 1)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await run('claim')).status, 409);
  assert.equal((await run('verify-claim')).status, 'atomic_claim_once');
  console.log('PASS: two approved Supervisors and a retry produce one atomic claim, payment, verification, handover, batch deduction, stock version and low-stock episode.');
} finally { await run('cleanup'); console.log('Isolated MariaDB and runtime fixture removed.'); }
