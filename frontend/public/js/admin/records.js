import { apiFetch, authHeaders, cell, emptyState, escapeHtml, formatDate, readJson, statusBadge, toast } from './shared.js';

export function initRecords() {
  const typeSelect = document.querySelector('#records-type');
  const limitSelect = document.querySelector('#records-limit');
  const status = document.querySelector('#records-status');
  const table = document.querySelector('#records-table-container');
  let loadSeq = 0;

  function render(items, type) {
    if (!items.length) {
      table.innerHTML = emptyState('No records are available.');
      return;
    }

    const headers = type === 'cpd'
      ? ['Member', 'Title', 'Category', 'Hours', 'Status', 'Date', 'Action']
      : ['Member', 'Examination', 'Code', 'Result', 'Status', 'Registered', 'Action'];

    const rows = items.map((item) => {
      const id = escapeHtml(item.id);
      if (type === 'cpd') {
        return '<tr>'
          + cell(headers[0], escapeHtml(item.email || item.member_id))
          + cell(headers[1], escapeHtml(item.title))
          + cell(headers[2], escapeHtml(item.category))
          + cell(headers[3], escapeHtml(item.hours))
          + cell(headers[4], statusBadge(item.status || 'pending'))
          + cell(headers[5], formatDate(item.created_at))
          + cell(headers[6], `<div class="row-actions"><select aria-label="CPD decision" data-record-action="cpd" data-id="${id}"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></select></div>`)
          + '</tr>';
      }
      const score = item.result_score ?? '—';
      return '<tr>'
        + cell(headers[0], escapeHtml(item.email || item.member_id))
        + cell(headers[1], escapeHtml(item.examination_name))
        + cell(headers[2], escapeHtml(item.code))
        + cell(headers[3], escapeHtml(score))
        + cell(headers[4], statusBadge(item.result_status || item.status || 'pending'))
        + cell(headers[5], formatDate(item.registered_at))
        + cell(headers[6], `<div class="row-actions"><input type="number" min="0" max="100" step="0.1" data-record-score="${id}" value="${escapeHtml(item.result_score ?? '')}" aria-label="Score for ${escapeHtml(item.id || 'record')}"><select aria-label="Examination result" data-record-action="exam" data-id="${id}"><option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="withheld">Withheld</option></select><button type="button" class="btn-sm" data-record-save="${id}">Save</button></div>`)
        + '</tr>';
    }).join('');

    table.innerHTML = `<table class="data-table"><thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;

    table.querySelectorAll('[data-record-action]').forEach((select) => {
      const current = (select.closest('tr').querySelector('.status')?.textContent?.trim() || 'pending').toLowerCase();
      const allowed = Array.from(select.options, (option) => option.value);
      select.value = allowed.includes(current) ? current : 'pending';
      select.addEventListener('change', async () => {
        select.disabled = true;
        if (select.dataset.recordAction === 'cpd') await updateCpdStatus(select.dataset.id, select.value);
        else await updateExaminationResult(select.dataset.id, select.closest('tr').querySelector('[data-record-score]').value, select.value);
        select.disabled = false;
      });
    });

    /* A score can now be saved without having to change the result dropdown first. */
    table.querySelectorAll('[data-record-save]').forEach((button) => {
      button.addEventListener('click', async () => {
        const row = button.closest('tr');
        button.disabled = true;
        await updateExaminationResult(
          button.dataset.recordSave,
          row.querySelector('[data-record-score]').value,
          row.querySelector('[data-record-action="exam"]').value,
        );
        button.disabled = false;
      });
    });
  }

  async function load() {
    const seq = ++loadSeq;
    status.className = 'records-status';
    status.textContent = 'Loading records…';
    table.classList.add('is-loading');
    try {
      const response = await apiFetch(`/api/admin/records?type=${typeSelect.value}&limit=${limitSelect.value}`, { headers: authHeaders() });
      const payload = await readJson(response);
      if (seq !== loadSeq) return; // a newer request has replaced this one
      if (!response.ok) throw new Error(payload.message || 'Unable to load records.');
      render(payload.items || [], typeSelect.value);
      status.textContent = 'Records loaded.';
      status.classList.add('ok');
    } catch (error) {
      if (seq !== loadSeq) return;
      status.textContent = error.message;
    } finally {
      if (seq === loadSeq) table.classList.remove('is-loading');
    }
  }

  async function update(action, payload, successMessage, fallbackMessage) {
    try {
      const response = await apiFetch('/api/admin/records', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.message || fallbackMessage);
      status.className = 'records-status ok';
      status.textContent = successMessage;
      toast(successMessage, 'ok');
      await load();
    } catch (error) {
      status.className = 'records-status';
      status.textContent = error.message || fallbackMessage;
      toast(error.message || fallbackMessage, 'err');
    }
  }

  function updateCpdStatus(id, nextStatus) {
    return update('update-cpd-status', { id, status: nextStatus }, 'CPD status updated.', 'Unable to update CPD status.');
  }

  function updateExaminationResult(id, score, nextStatus) {
    return update('update-examination-result', { id, score, status: nextStatus }, 'Examination result updated.', 'Unable to update examination result.');
  }

  document.querySelector('#records-refresh').addEventListener('click', load);
  typeSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);
}