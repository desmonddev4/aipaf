import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAdminOverviewReport } from '../api/admin/reports.mjs';

test('admin overview report normalizes counts and status summary', () => {
  const report = buildAdminOverviewReport({
    members: { total: 12, active: 8, pending: 2, unverified: 2 },
    payments: { total: 24, paid: 15, pending: 6, failed: 3 },
    examinations: { total: 9, completed: 5, pending: 4 },
    cpd: { total: 18, approved: 10, pending: 6, rejected: 2 },
    certificates: { total: 7 },
  });

  assert.equal(report.members.total, 12);
  assert.equal(report.members.active, 8);
  assert.equal(report.payments.paid, 15);
  assert.equal(report.examinations.completed, 5);
  assert.equal(report.cpd.approved, 10);
  assert.equal(report.certificates.total, 7);
  assert.equal(report.overview.pendingActions, 12);
  assert.equal(report.overview.completionRate, 56);
});
