import { cell, escapeHtml, setBusy } from './shared.js';
import { apiFetch } from './shared.js';

const percent = (part, whole) => (whole ? Math.min(100, Math.round((part / whole) * 100)) : 0);
const num = (value) => Number(value) || 0;

const svg = (inner) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const icons = {
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  card: svg('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
  exam: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
  cpd: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  award: svg('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'),
  bell: svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  check: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
};

async function fetchOverviewReport() {
  try {
    const response = await apiFetch('/api/admin/reports?action=overview');
    if (!response.ok) throw new Error('Failed to fetch report');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load report');
    return data.report;
  } catch (error) {
    console.error('Error fetching overview report:', error);
    return null;
  }
}

function card({ i, icon, label, value, sub, pct, href, chip }) {
  const meter = pct == null ? '' : `<div class="ov-meter"><div class="meter" role="img" aria-label="${pct}%"><span style="--w:${pct}%"></span></div><span class="ov-pct">${pct}%</span></div>`;
  const chipHtml = chip ? `<span class="ov-chip">${escapeHtml(chip)}</span>` : '';
  const inner = `<div class="ov-card-top"><span class="ov-icon">${icon}</span><span class="ov-label">${escapeHtml(label)}</span></div>`
    + `<span class="ov-value">${escapeHtml(value)}</span><span class="ov-sub">${escapeHtml(sub)}</span>${meter}${chipHtml}`;
  return href
    ? `<a class="ov-card" href="${href}" style="--i:${i}">${inner}</a>`
    : `<div class="ov-card" style="--i:${i}">${inner}</div>`;
}

export function initOverview() {
  const root = document.querySelector('#overview-report');
  const updated = document.querySelector('#overview-updated');
  const refresh = document.querySelector('#overview-refresh');

  function skeleton() {
    root.innerHTML = '<div class="ov-grid">' + '<div class="ov-skel"></div>'.repeat(6) + '</div>';
  }

  function attention(report) {
    const pending = [
      ['Members', num(report.members.pending) + num(report.members.unverified), '/admin-members'],
      ['Payments', num(report.payments.pending), '/admin-payments'],
      ['Examinations', num(report.examinations.pending), '/admin-examinations'],
      ['CPD records', num(report.cpd.pending), '/admin-records'],
    ].filter(([, n]) => n > 0);
    if (!pending.length) {
      return `<div class="ov-attention is-clear"><span class="ov-attention-icon">${icons.check}</span><div><strong>You're all caught up</strong><span>Nothing is waiting for review.</span></div></div>`;
    }
    const total = pending.reduce((sum, [, n]) => sum + n, 0);
    const links = pending.map(([label, n, href]) => `<a class="btn btn-sm btn-ghost" href="${href}">${escapeHtml(label)} · ${n}</a>`).join('');
    return `<div class="ov-attention"><span class="ov-attention-icon">${icons.bell}</span><div><strong>${total} item${total === 1 ? '' : 's'} need attention</strong><span>Jump straight to the queue that needs you.</span></div><div class="ov-attention-links">${links}</div></div>`;
  }

  async function render() {
    setBusy(refresh, true);
    skeleton();
    const report = await fetchOverviewReport();
    setBusy(refresh, false);

    if (!report) {
      updated.textContent = 'Could not load figures';
      updated.classList.add('is-error');
      root.innerHTML = '<div class="ov-error"><p>Unable to load the report. Please try again.</p></div>';
      return;
    }
    updated.classList.remove('is-error');
    updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const rate = num(report.overview?.completionRate);
    const sittings = num(report.examinations.completed) + num(report.examinations.pending);
    const cards = [
      { icon: icons.users, label: 'Active members', value: report.members.active, sub: `of ${report.members.total} registered`, pct: percent(report.members.active, report.members.total), href: '/admin-members' },
      { icon: icons.card, label: 'Payments received', value: report.payments.paid, sub: `of ${report.payments.total}, ${report.payments.failed} failed`, pct: percent(report.payments.paid, report.payments.total), href: '/admin-payments' },
      { icon: icons.exam, label: 'Exams completed', value: `${rate}%`, sub: `${report.examinations.completed} of ${sittings} sittings`, pct: rate, href: '/admin-examinations' },
      { icon: icons.cpd, label: 'CPD approved', value: report.cpd.approved, sub: `of ${report.cpd.total}, ${report.cpd.rejected} rejected`, pct: percent(report.cpd.approved, report.cpd.total), href: '/admin-records' },
      { icon: icons.award, label: 'Certificates issued', value: report.certificates.total, sub: 'Public verification ready', href: '/admin-certificates' },
      { icon: icons.bell, label: 'Pending actions', value: num(report.overview?.pendingActions), sub: 'Members, payments and exams', chip: num(report.overview?.pendingActions) ? 'Needs review' : 'All clear' },
    ].map((c, i) => card({ ...c, i })).join('');

    const rows = [
      ['Members', report.members.total, report.members.active, num(report.members.pending) + num(report.members.unverified), 'Member onboarding and review queue', '/admin-members'],
      ['Payments', report.payments.total, report.payments.paid, report.payments.pending, `${report.payments.failed} failed / reconciled`, '/admin-payments'],
      ['Examinations', report.examinations.total, report.examinations.completed, report.examinations.pending, `${rate}% completion rate`, '/admin-examinations'],
      ['CPD', report.cpd.total, report.cpd.approved, report.cpd.pending, `${report.cpd.rejected} rejected submissions`, '/admin-records'],
      ['Certificates', report.certificates.total, '—', '—', 'Public verification ready', '/admin-certificates'],
    ].map(([area, total, active, pending, notes, href]) => '<tr>'
      + cell('Area', escapeHtml(area))
      + cell('Total', `<span class="num">${escapeHtml(total)}</span>`)
      + cell('Active', `<span class="num">${escapeHtml(active)}</span>`)
      + cell('Pending', `<span class="num">${escapeHtml(pending)}</span>`)
      + cell('Notes', escapeHtml(notes))
      + cell('Open', `<a href="${href}">Open</a>`)
      + '</tr>').join('');

    root.innerHTML = `${attention(report)}<div class="ov-grid">${cards}</div>`
      + '<section class="panel ov-panel" aria-labelledby="ov-breakdown"><h2 id="ov-breakdown">Breakdown by area</h2><div class="ov-table"><table class="data-table"><thead><tr><th scope="col">Area</th><th scope="col">Total</th><th scope="col">Active</th><th scope="col">Pending</th><th scope="col">Notes</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>'
      + `<tbody>${rows}</tbody></table></div></section>`;
  }

  refresh.addEventListener('click', render);
  render();
}
