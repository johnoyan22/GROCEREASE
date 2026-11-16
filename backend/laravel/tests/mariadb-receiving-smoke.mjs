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
    execFile(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['tests/mariadb-receiving-smoke.php', mode, suffix, String(index)],
      { cwd, windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || stdout || error.message));
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error(stdout)); }
      });
  });
}
try {
  assert.equal((await run('setup')).status, 'ready');
  const created = await Promise.all(Array.from({ length: 8 }, (_, index) => run('create', index)));
  assert.ok(created.every((row) => row.status === 201));
  assert.equal(new Set(created.map((row) => row.sku)).size, 8);
  assert.deepEqual((await Promise.all([run('submit'), run('submit')])).map((row) => row.status).sort(), [200, 201]);
  assert.deepEqual((await Promise.all([run('approve', 0), run('approve', 1)])).map((row) => row.status).sort(), [200, 409]);
  assert.equal((await run('verify')).status, 'all_invariants_passed');
  console.log('PASS: isolated MariaDB concurrent SKU creation (8), duplicate submission, duplicate approval and exact batch/stock totals.');
} finally { await run('cleanup'); console.log('Temporary receiving database and runtime file removed.'); }
