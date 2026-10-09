import { withDb } from '../db.mjs';
import { jsonResponse } from '../_shared.mjs';
import { requireAdmin } from '../_auth.mjs';

export function buildAdminOverviewReport(data = {}) {
  const members = {
    total: Number(data.members?.total) || 0,
    active: Number(data.members?.active) || 0,
    pending: Number(data.members?.pending) || 0,
    unverified: Number(data.members?.unverified) || 0,
  };

  const payments = {
    total: Number(data.payments?.total) || 0,
    paid: Number(data.payments?.paid) || 0,
    pending: Number(data.payments?.pending) || 0,
    failed: Number(data.payments?.failed) || 0,
  };

  const examinations = {
    total: Number(data.examinations?.total) || 0,
    completed: Number(data.examinations?.completed) || 0,
    pending: Number(data.examinations?.pending) || 0,
  };

  const cpd = {
    total: Number(data.cpd?.total) || 0,
    approved: Number(data.cpd?.approved) || 0,
    pending: Number(data.cpd?.pending) || 0,
    rejected: Number(data.cpd?.rejected) || 0,
  };

  const certificates = {
    total: Number(data.certificates?.total) || 0,
  };

  const pendingActions = members.pending + payments.pending + examinations.pending;
  const totalExamActions = examinations.completed + examinations.pending;
  const completionRate = totalExamActions
    ? Math.round((examinations.completed / totalExamActions) * 100)
    : 0;

  return {
    members,
    payments,
    examinations,
    cpd,
    certificates,
    overview: {
      pendingActions,
      completionRate,
    },
  };
}

async function fetchOverviewData() {
  return withDb(async (client) => {
    const [membersResult, paymentsResult, examinationsResult, cpdResult, certificatesResult] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE membership_status = 'active') AS active,
          COUNT(*) FILTER (WHERE membership_status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE membership_status = 'unverified') AS unverified
        FROM members
      `),
      client.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'paid') AS paid,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed
        FROM payments
      `),
      client.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'registered' OR status = 'paid') AS pending
        FROM examination_registrations
      `),
      client.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
        FROM cpd_records
      `),
      client.query('SELECT COUNT(*) AS total FROM certificates'),
    ]);

    return {
      members: membersResult.rows[0],
      payments: paymentsResult.rows[0],
      examinations: examinationsResult.rows[0],
      cpd: cpdResult.rows[0],
      certificates: certificatesResult.rows[0],
    };
  });
}

export default async function handler(request) {
  const auth = requireAdmin(request, ['secretariat', 'council']);
  if (auth.status) return jsonResponse({ ok: false, message: auth.message }, auth.status);

  if (request.method !== 'GET') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'overview') {
    try {
      const data = await fetchOverviewData();
      const report = buildAdminOverviewReport(data);
      return jsonResponse({ ok: true, report, role: auth.role });
    } catch {
      return jsonResponse({ ok: false, message: 'Unable to generate report.' }, 503);
    }
  }

  return jsonResponse({ ok: false, message: 'Unsupported report action.' }, 400);
}
