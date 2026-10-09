import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeExaminationResult,
  normalizeCpdDecision,
} from '../src/server/handlers/api/admin/records.mjs';

test('examination results accept only supported values', () => {
  assert.deepEqual(normalizeExaminationResult({
    id: 'exam-1',
    score: '88.5',
    status: 'pass',
  }), {
    ok: true,
    id: 'exam-1',
    score: 88.5,
    status: 'pass',
  });

  assert.equal(normalizeExaminationResult({ id: 'exam-1', score: 'nope', status: 'pass' }).ok, false);
  assert.equal(normalizeExaminationResult({ id: 'exam-1', score: '88', status: 'unknown' }).ok, false);
});

test('CPD decisions accept only supported statuses', () => {
  assert.deepEqual(normalizeCpdDecision({ id: 'cpd-1', status: 'approved' }), {
    ok: true,
    id: 'cpd-1',
    status: 'approved',
  });

  assert.equal(normalizeCpdDecision({ id: 'cpd-1', status: 'rejected' }).ok, true);
  assert.equal(normalizeCpdDecision({ id: 'cpd-1', status: 'review' }).ok, false);
});
