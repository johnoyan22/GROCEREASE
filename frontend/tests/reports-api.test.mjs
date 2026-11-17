import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { downloadReportPdf, generateReport, getReportOptions, getReportPreview } from '../src/services/api.js';
let previous;
beforeEach(() => { previous = Object.getOwnPropertyDescriptor(globalThis, 'document'); Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=reports%3Dqa' } }); });
afterEach(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('report generation uses CSRF, session, cancellation and filters without a frontend dataset', async t => {
  const signal = new AbortController().signal;
  const filters = { type: 'payments', from: '2026-11-01', until: '2026-11-17', mode: 'all' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return json({});
    assert.ok(url.endsWith('/reports')); assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.signal, signal);
    assert.equal(options.headers['X-XSRF-TOKEN'], 'reports=qa'); assert.deepEqual(JSON.parse(options.body), filters); return json({ report: { id: 'a'.repeat(64) } });
  });
  assert.equal((await generateReport(filters, { signal })).report.id, 'a'.repeat(64));
});
test('report options and pagination are authenticated uncached reads of one snapshot', async t => {
  const calls = [], signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push(url); assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.signal, signal); return json({}); });
  await getReportOptions({ signal }); await getReportPreview('a'.repeat(64), { stock: 2 }, { signal });
  assert.ok(calls[0].endsWith('/reports/options')); const target = new URL(calls[1], 'http://localhost'); assert.equal(target.searchParams.get('pages[stock]'), '2');
});
test('PDF uses an authenticated binary read and a safe backend filename', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/reports/'+ 'a'.repeat(64)+'/pdf')); assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.headers.Accept, 'application/pdf');
    return new Response('%PDF-1.7 QA', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="GrocerEase-payments-2026-11-17.pdf"' } });
  });
  const result = await downloadReportPdf('a'.repeat(64)); assert.equal(result.filename, 'GrocerEase-payments-2026-11-17.pdf'); assert.equal(await result.blob.text(), '%PDF-1.7 QA');
});
test('expired and forbidden exports retain their status for regeneration and authorization handling', async t => {
  for (const status of [401, 403, 410]) {
    t.mock.method(globalThis, 'fetch', async () => json({ message: 'Generate again' }, status));
    await assert.rejects(downloadReportPdf('a'.repeat(64)), failure => failure.status === status && /Generate again/.test(failure.message));
  }
});
test('an HTML response is never silently downloaded as a PDF', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(downloadReportPdf('a'.repeat(64)), /did not return a PDF/);
});
test('security-cookie failure prevents report generation', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 419 }); });
  await assert.rejects(generateReport({ type: 'current_stock' }), /secure session/); assert.equal(calls, 1);
});
