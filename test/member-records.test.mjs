import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';

import {
  normalizePayment,
  normalizeExaminationRegistration,
  normalizeCpdRecord,
  normalizeExamination,
  normalizeCpdStatus,
  verifyPaymentWebhook,
} from '../src/server/handlers/api/member-records.mjs';

test('payment records normalize provider and currency values', () => {
  assert.deepEqual(normalizePayment({
    amount: '125.00',
    currency: 'GHS',
    purpose: 'membership',
    provider: 'paystack',
    reference: 'ref-123',
  }), {
    amount: 125,
    currency: 'GHS',
    purpose: 'membership',
    provider: 'paystack',
    providerReference: 'ref-123',
  });
});

test('payment webhooks require a valid signature and reject duplicates', () => {
  const secret = 'test-webhook-secret';
  const payload = JSON.stringify({ event: 'charge.success', reference: 'ref-123', status: 'success' });
  const signature = createHmac('sha256', secret).update(payload).digest('hex');

  assert.equal(verifyPaymentWebhook(payload, signature, secret), true);
  assert.equal(verifyPaymentWebhook(payload, 'bad-signature', secret), false);
  assert.equal(verifyPaymentWebhook(payload, signature, 'wrong-secret'), false);
});

test('Paystack webhooks use the documented SHA-512 signature', () => {
  const secret = 'test-paystack-secret';
  const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-123', status: 'success' } });
  const signature = createHmac('sha512', secret).update(payload).digest('hex');

  assert.equal(verifyPaymentWebhook(payload, signature, secret, 'paystack'), true);
  assert.equal(verifyPaymentWebhook(payload, 'bad-signature', secret, 'paystack'), false);
});

test('examination registrations require a valid examination and member reference', () => {
  const result = normalizeExaminationRegistration({ examinationId: 'ex-1', memberId: 'member-1' });
  assert.equal(result.ok, false);
  assert.match(result.message, /valid/i);
});

test('examinations and CPD statuses are limited to supported values', () => {
  assert.deepEqual(normalizeExamination({
    code: '  FOUNDATION-01  ',
    name: 'Foundation Examination',
    description: 'Assess basic professional knowledge',
    status: 'open',
  }), {
    ok: true,
    code: 'FOUNDATION-01',
    name: 'Foundation Examination',
    description: 'Assess basic professional knowledge',
    status: 'open',
  });
  assert.equal(normalizeExamination({ code: 'BAD', name: 'Bad', status: 'unknown' }).ok, false);
  assert.deepEqual(normalizeCpdStatus('approved'), { ok: true, status: 'approved' });
  assert.equal(normalizeCpdStatus('unknown').ok, false);
});

test('CPD records require a positive duration and completion date', () => {
  const result = normalizeCpdRecord({ title: 'Ethics webinar', hours: 0, completionDate: '2026-10-07' });
  assert.equal(result.ok, false);
  assert.match(result.message, /positive/i);
});
