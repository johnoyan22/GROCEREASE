import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getFinancialBill, getFinancialWorkspace, postFinancial } from '../src/services/api.js';
import { financialPayload, phpInput } from '../src/services/financial.js';
import { formatCentavos } from '../src/services/money.js';
const originalFetch = globalThis.fetch, originalDocument = globalThis.document;
test('financial and report display retains exact cents at the supported large-integer boundary', () => {
  assert.match(formatCentavos(9007199254740991), /90,071,992,547,409\.91$/);
  assert.match(formatCentavos(1), /0\.01$/);
  assert.match(formatCentavos(-1), /-.*0\.01$/);
  assert.throws(() => formatCentavos(9007199254740992), /exact display range/);
});
afterEach(() => { globalThis.fetch = originalFetch; if (originalDocument) globalThis.document = originalDocument; else delete globalThis.document; });
test('financial read scope is encoded, private, bounded and abortable', async () => {
  const signal = new AbortController().signal;
  globalThis.fetch = async (url, options) => { assert.equal(url,'http://localhost:8000/api/admin/financial/7?mode=test&section=funding&page=2'); assert.equal(options.cache,'no-store'); assert.equal(options.credentials,'include'); assert.equal(options.signal,signal); return Response.json({ records: { data: [] } }); };
  await getFinancialWorkspace(7,{mode:'test',section:'funding',page:2},{signal});
  globalThis.fetch = async url => { assert.match(url,/\/7\/bills\/9\?mode=actual&page=3$/); return Response.json({}); };
  await getFinancialBill(7,9,'actual',3);
});
test('financial posting preserves decimal strings and retry UUID, excludes forged fields and uses CSRF', async () => {
  globalThis.document = { cookie:'XSRF-TOKEN=qa%3Dtoken' };
  const key='a4258a0b-e6a9-47cd-80d8-a3321ebd900a';
  const payload=financialPayload('contribute',{id:12,amount:'100.00',reason:'Reviewed approval',actor_id:3,balance:999},'test',key);
  assert.deepEqual(payload,{mode:'test',idempotency_key:key,reason:'Reviewed approval',id:12,amount:'100.00'});
  let calls=0;
  globalThis.fetch=async (url,options) => { if(url.endsWith('csrf-cookie')) return Response.json({}); calls++; assert.match(url,/\/7\/contribute$/); assert.equal(options.headers['X-XSRF-TOKEN'],'qa=token'); assert.deepEqual(JSON.parse(options.body),payload); return Response.json({result:{id:4}}); };
  await postFinancial(7,'contribute',payload); await postFinancial(7,'contribute',payload); assert.equal(calls,2);
  assert.equal(phpInput(4294967295),'42949672.95');
});
