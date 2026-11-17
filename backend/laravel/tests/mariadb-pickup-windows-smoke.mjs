import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const suffix = randomBytes(6).toString('hex');
await mkdir(fileURLToPath(new URL('../../../tmp/', import.meta.url)), { recursive: true });
const run = (mode) => new Promise((resolve, reject) => {
  execFile(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['tests/mariadb-pickup-windows-smoke.php', mode, suffix], { cwd, windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr || stdout || error.message));
    try { resolve(JSON.parse(stdout)); } catch { reject(new Error(stdout)); }
  });
});
try {
  assert.equal((await run('setup')).status, 'ready');
  for (let i = 0; i < 8; i++) {
    assert.equal((await run('reset')).status, 200);
    // Neither complete policy accepts 10-11. A half-old/half-new combination would.
    const [update, quote, placement] = await Promise.all([run('update'), run('quote'), run('place')]);
    assert.equal(update.status, 200);
    for (const result of [quote, placement]) { assert.equal(result.status, 422); assert.ok(result.errors.pickup_start, JSON.stringify(result)); }
    assert.equal((await run('verify')).status, 'passed');
  }
  console.log('PASS: isolated MariaDB migration defaults and 8 settings/quote/placement races; no mixed policy, order, reservation or payment side effects.');
} finally { await run('cleanup'); console.log('Temporary pickup-window database and runtime file removed.'); }
