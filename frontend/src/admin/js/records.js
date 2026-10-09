import { apiFetch, authHeaders, cell, emptyState, escapeHtml, formatDate, readJson, statusBadge, toast, setBusy } from './shared.js';

const EXAM_RESULTS = ['pending', 'pass', 'fail', 'withheld'];
const CPD_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];
const cap = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
const options = (values, current) => values.map((v) => `<option value="${v}" ${v === current ? 'selected' : ''}>${cap(v)}</option>`).join('');
const examResult = (item) => item.result_status || 'pending';

function renderSummary(items, type) {
  const count = (fn) => items.filter(fn).length;
  const stats = type === 'cpd'
    ? [
      ['Awaiting decision', count((i) => (i.status || 'pending') === 'pending'), 'warn'],
      ['Approved', count((i) => i.status === 'approved'), 'ok'],
      ['Rejected', count((i) => i.status === 'rejected'), 'mute'],
      ['Approved hours', items.filter((i) => i.status === 'approved').reduce((sum, i) => sum + (Number(i.hours) || 0), 0), 'info'],
    ]
    : [
      ['Awaiting result', count((i) => examResult(i) === 'pending'), 'warn'],
      ['Passed', count((i) => examResult(i) === 'pass'), 'ok'],
      ['Failed', count((i) => examResult(i) === 'fail'), 'mute'],
      ['Withheld', count((i) => examResult(i) === 'withheld'), 'info'],
    ];
  return stats.map(([name, value, tone]) => `<div class="rc-stat ${tone}"><span>${name}</span><strong>${value}</strong></div>`).join('');
}

function renderTable(items, type) {
  if (!items.length) return emptyState(type === 'cpd' ? 'No CPD records match.' : 'No examination records match.');

  const headers = type === 'cpd'
    ? ['Member', 'Activity', 'Category', 'Hours', 'Status', 'Submitted', 'Decision']
    : ['Member', 'Examination', 'Code', 'Score', 'Result', 'Registered', 'Record result'];

  const rows = items.map((item) => {
    const id = escapeHtml(item.id);
    if (type === 'cpd') {
      const current = item.status || 'pending';
      return '<tr>'
        + cell(headers[0], escapeHtml(item.email || item.member_id || '—'))
        + cell(headers[1], escapeHtml(item.title || '—'))
        + cell(headers[2], escapeHtml(item.category || '—'))
        + cell(headers[3], `<span class="rc-hours">${escapeHtml(item.hours ?? '—')}</span>`)
        + cell(headers[4], statusBadge(current))
        + cell(headers[5], formatDate(item.created_at))
        + cell(headers[6], `<div class="rc-actions"><select aria-label="CPD decision" data-cpd-status="${id}">${options(CPD_STATUSES, current)}</select><button type="button" class="btn btn-gold btn-sm" data-save="${id}">Save</button></div>`)
        + '</tr>';
    }
    const current = examResult(item);
    return '<tr>'
      + cell(headers[0], escapeHtml(item.email || item.member_id || '—'))
      + cell(headers[1], escapeHtml(item.examination_name || '—'))
      + cell(headers[2], escapeHtml(item.code || '—'))
      + cell(headers[3], `<span class="rc-result">${escapeHtml(item.result_score ?? '—')}</span>`)
      + cell(headers[4], statusBadge(current))
      + cell(headers[5], formatDate(item.registered_at))
      + cell(headers[6], `<div class="rc-actions"><input class="rc-score" type="number" min="0" max="100" step="0.1" placeholder="Score" data-score="${id}" value="${escapeHtml(item.result_score ?? '')}" aria-label="Score"><select aria-label="Examination result" data-exam-status="${id}">${options(EXAM_RESULTS, current)}</select><button type="button" class="btn btn-gold btn-sm" data-save="${id}">Save</button></div>`)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function initRecords() {
  const $ = (selector) => document.querySelector(selector);
  const limitSelect = $('#records-limit');
  const searchInput = $('#records-search');
  const refreshButton = $('#records-refresh');
  const countElement = $('#records-status');
  const summary = $('#records-summary');
  const table = $('#records-table-container');
  const tabs = Array.from(document.querySelectorAll('.rc-tab'));

  let type = 'examination';
  let all = [];
  let requestId = 0;

  function show() {
    const term = searchInput.value.trim().toLowerCase();
    const items = term
      ? all.filter((i) => [i.email, i.title, i.examination_name, i.code, i.category].some((v) => String(v || '').toLowerCase().includes(term)))
      : all;
    countElement.textContent = `${items.length} record${items.length === 1 ? '' : 's'}`;
    summary.innerHTML = all.length ? renderSummary(all, type) : '';
    table.innerHTML = renderTable(items, type);
  }

  async function load() {
    const current = ++requestId;
    setBusy(refreshButton, true);
    table.innerHTML = '<div class="skeleton-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
    try {
      const response = await apiFetch(`/api/admin/records?type=${type}&limit=${limitSelect.value}`, { headers: authHeaders() });
      const payload = await readJson(response);
      if (current !== requestId) return;
      if (!response.ok || payload.ok === false) throw new Error(payload.message || 'Unable to load records.');
      all = payload.items || [];
      show();
    } catch (error) {
      if (current !== requestId) return;
      all = [];
      summary.innerHTML = '';
      countElement.textContent = '';
      table.innerHTML = `<div class="empty"><p>${escapeHtml(error.message || 'We could not load records.')} Check your connection and try again.</p></div>`;
    } finally {
      if (current === requestId) setBusy(refreshButton, false);
    }
  }

  async function save(action, payload, message, fallback) {
    const response = await apiFetch('/api/admin/records', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await readJson(response);
    if (!response.ok || result.ok === false) throw new Error(result.message || fallback);
    toast(message, 'ok');
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    if (tab.dataset.type === type) return;
    type = tab.dataset.type;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    table.setAttribute('aria-labelledby', tab.id);
    all = [];
    load();
  }));

  refreshButton.addEventListener('click', load);
  limitSelect.addEventListener('change', load);
  searchInput.addEventListener('input', show);

  table.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save]');
    if (!button) return;
    const row = button.closest('tr');
    const id = button.dataset.save;
    const record = all.find((i) => String(i.id) === id);
    setBusy(button, true);
    try {
      if (type === 'cpd') {
        const status = row.querySelector('[data-cpd-status]').value;
        if (record && status === (record.status || 'pending')) { toast('No change to save.', 'info'); setBusy(button, false); return; }
        await save('update-cpd-status', { id, status }, 'CPD status updated.', 'Unable to update CPD status.');
      } else {
        const scoreInput = row.querySelector('[data-score]');
        const score = scoreInput.value.trim();
        const status = row.querySelector('[data-exam-status]').value;
        const number = Number(score);
        if (!score || !Number.isFinite(number) || number < 0 || number > 100) {
          toast('Enter a score between 0 and 100.', 'err');
          scoreInput.focus();
          setBusy(button, false);
          return;
        }
        await save('update-examination-result', { id, score, status }, 'Examination result updated.', 'Unable to update examination result.');
      }
      load();
    } catch (error) {
      toast(error.message, 'err');
      setBusy(button, false);
    }
  });

  load();
}
