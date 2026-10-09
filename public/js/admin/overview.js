import { cell, escapeHtml } from './shared.js';
import { apiUrl } from '../config.js';

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

async function fetchOverviewReport() {
  try {
    const response = await fetch(apiUrl('/api/admin/reports?action=overview'));
    if (!response.ok) throw new Error('Failed to fetch report');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load report');
    return data.report;
  } catch (error) {
    console.error('Error fetching overview report:', error);
    return null;
  }
}

export function initOverview() {
  const provider = document.querySelector('#provider-select');
  const period = document.querySelector('#report-period');
  const reportElement = document.querySelector('#overview-report');

  function statCard(label, value, sub, pct) {
    const meter = pct == null
      ? ''
      : `<div class="meter" role="img" aria-label="${pct}%"><span style="--w:${pct}%"></span></div>`;
    return `<div class="stat"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-value">${escapeHtml(value)}</span><span class="stat-sub">${escapeHtml(sub)}</span>${meter}</div>`;
  }

  async function render() {
    reportElement.innerHTML = '<p class="admin-note">Loading report...</p>';

    const report = await fetchOverviewReport();
    if (!report) {
      reportElement.innerHTML = '<p class="admin-note">Unable to load report. Please try again.</p>';
      return;
    }

    const pendingActions = report.overview?.pendingActions || 0;
    const completionRate = report.overview?.completionRate || 0;

    const cards = [
      statCard('Active members', report.members.active, `of ${report.members.total} registered`, percent(report.members.active, report.members.total)),
      statCard('Payments received', report.payments.paid, `of ${report.payments.total}, ${report.payments.failed} failed`, percent(report.payments.paid, report.payments.total)),
      statCard('Exams completed', `${completionRate}%`, `${report.examinations.completed} of ${report.examinations.completed + report.examinations.pending} sittings`, completionRate),
      statCard('CPD approved', report.cpd.approved, `of ${report.cpd.total}, ${report.cpd.rejected} rejected`, percent(report.cpd.approved, report.cpd.total)),
      statCard('Certificates issued', report.certificates.total, 'Public verification ready', null),
      statCard('Pending actions', pendingActions, 'Members, payments and exams', null),
    ].join('');

    const rows = [
      ['Members', report.members.total, report.members.active, report.members.pending + report.members.unverified, 'Member onboarding and review queue'],
      ['Payments', report.payments.total, report.payments.paid, report.payments.pending, `${report.payments.failed} failed / reconciled`],
      ['Examinations', report.examinations.total, report.examinations.completed, report.examinations.pending, `${completionRate}% completion rate`],
      ['CPD', report.cpd.total, report.cpd.approved, report.cpd.pending, `${report.cpd.rejected} rejected submissions`],
      ['Certificates', report.certificates.total, '—', '—', 'Public verification ready'],
    ].map(([area, total, active, pending, notes]) => '<tr>'
      + cell('Area', escapeHtml(area))
      + cell('Total', escapeHtml(total))
      + cell('Active', escapeHtml(active))
      + cell('Pending', escapeHtml(pending))
      + cell('Notes', escapeHtml(notes))
      + '</tr>').join('');

    reportElement.innerHTML = `<div class="stat-grid">${cards}</div>`
      + `<table class="data-table"><thead><tr><th scope="col">Area</th><th scope="col">Total</th><th scope="col">Active</th><th scope="col">Pending</th><th scope="col">Notes</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<p class="admin-note report-note">Provider: ${escapeHtml(provider.value)} • Period: ${escapeHtml(period.value)} • Pending actions: ${pendingActions}</p>`;
  }

  provider.addEventListener('change', render);
  period.addEventListener('change', render);
  render();
}