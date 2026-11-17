import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url)), suffix = randomBytes(6).toString('hex');
function run(mode) {
  return new Promise((resolve, reject) => {
    execFile(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['tests/mariadb-transaction-smoke.php', mode, suffix, '0'], { cwd, windowsHide: true, timeout: 60000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || stdout || error.message));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Unexpected isolated report result: '+stdout)); }
    });
  });
}
try {
  assert.equal((await run('setup')).status, 'isolated_schema_ready');
  assert.equal((await run('reserve')).status, 201);
  await run('second-order'); await run('assign'); await run('prepare-claim');
  assert.equal((await run('reports')).status, 'reports_and_pdf_passed');
  console.log('PASS: all 8 report query types, literal SQL search, genuine collection total and authorized snapshot PDF rendering on isolated MariaDB.');
} finally { await run('cleanup'); console.log('Isolated report database and fixture removed.'); }
