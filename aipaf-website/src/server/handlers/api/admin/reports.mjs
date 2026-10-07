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
