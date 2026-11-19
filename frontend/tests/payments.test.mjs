import assert from 'node:assert/strict';
import { test } from 'node:test';
import { channelLabel, hostedPaymentUrl, providerLabel } from '../src/services/payments.js';
import { financialPayload } from '../src/services/financial.js';

test('Xendit hosted links accept documented TEST hosts and reject arbitrary/live redirects', () => {
  const session='ps-1234567890abcdef12345678';
  for(const value of ['https://checkout-staging.xendit.co/sessions/'+session,'https://dev.xen.to/kGxPCi76']) assert.equal(hostedPaymentUrl(value,'xendit'),value);
  for(const value of ['http://dev.xen.to/kGxPCi76','https://xen.to/kGxPCi76','https://checkout.xendit.co/sessions/'+session,
    'https://checkout-staging.xendit.co.evil.test/sessions/'+session,'https://user@dev.xen.to/kGxPCi76','javascript:alert(1)',
    'https://dev.xen.to/kGxPCi76?next=evil','https://dev.xen.to:444/kGxPCi76']) assert.equal(hostedPaymentUrl(value,'xendit'),null);
  assert.equal(hostedPaymentUrl('https://checkout.paymongo.com/cs_existing','paymongo'),'https://checkout.paymongo.com/cs_existing');
  assert.equal(hostedPaymentUrl('https://checkout.paymongo.com/cs_existing','xendit'),null);
  assert.equal(providerLabel('xendit'),'Xendit (Test)');assert.equal(channelLabel('gcash'),'GCash');
});

test('financial methods preserve default null versus an explicit empty allowlist', () => {
  const form={expected_version:1,fee_enabled:false,rate_bps:0,digital_enabled:true,reason:'Reviewed methods'};
  assert.equal(financialPayload('policy',{...form,digital_methods:null},'test','key').digital_methods,null);
  assert.deepEqual(financialPayload('policy',{...form,digital_methods:[]},'test','key').digital_methods,[]);
});
