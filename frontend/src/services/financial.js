import { createCheckoutKey } from './checkout.js';
export const financialKey = () => createCheckoutKey();
export const phpInput = cents => (Number(cents) / 100).toFixed(2);
export function financialPayload(action, form, mode, key) {
  const common = { mode, idempotency_key: key, reason: form.reason };
  switch (action) {
    case 'agreement': return { ...common, amount: form.amount, period: form.period, starts_on: form.starts_on, status: form.status, expected_version: form.expected_version };
    case 'bill': return { ...common, coverage_from: form.coverage_from, due_on: form.due_on, expected_version: form.expected_version };
    case 'payment': return { ...common, id: form.id, amount: form.amount, paid_on: form.paid_on, method: form.method, evidence: form.evidence };
    case 'contribute': return { ...common, id: form.id, amount: form.amount };
    case 'verify': case 'reverse_payment': return { ...common, id: form.id, expected_version: form.expected_version };
    case 'void_bill': case 'return_contribution': return { ...common, id: form.id };
    case 'policy': return { ...common, expected_version: form.expected_version, fee_enabled: form.fee_enabled, rate_bps: Number(form.rate_bps), cap: form.cap || null,
      approval_note: form.approval_note || null, digital_enabled: form.digital_enabled, digital_methods: form.digital_methods };
    default: throw new Error('Unsupported financial action.');
  }
}
