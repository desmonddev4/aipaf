import { confirmDialog, apiFetch, cell, escapeHtml, statusBadge, emptyState, toast, setBusy, formatDate } from './shared.js';

async function fetchInvitations(status, limit) {
  try {
    const params = new URLSearchParams({ action: 'list' });
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);

    const response = await apiFetch(`/api/member-invitations?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch invitations');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load invitations');
    return data.items;
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return null;
  }
}

async function sendInvitation(id) {
  try {
    const response = await apiFetch('/api/member-invitations?action=send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Failed to send invitation');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to send invitation');
    return true;
  } catch (error) {
    console.error('Error sending invitation:', error);
    throw error;
  }
}

async function deleteInvitation(id) {
  const response = await apiFetch('/api/member-invitations?action=delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'Failed to delete invitation');
}

async function createManualInvitation(data) {
  try {
    const response = await apiFetch('/api/member-invitations?action=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create invitation');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to create invitation');
    return result;
  } catch (error) {
    console.error('Error creating invitation:', error);
    throw error;
  }
}

const GRADES = ['fellow', 'member', 'associate', 'affiliate', 'graduate'];
const cap = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderSummary(items) {
  const count = (status) => items.filter((i) => i.status === status).length;
  const stats = [
    ['Awaiting send', count('pending'), 'warn'],
    ['Sent', count('sent'), 'info'],
    ['Accepted', count('accepted'), 'ok'],
    ['Declined or expired', count('declined') + count('expired'), 'mute'],
  ];
  return stats.map(([label, value, tone]) => `<div class="iv-stat ${tone}"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderInvitationsTable(invitations) {
  if (!invitations || invitations.length === 0) return emptyState('No invitations match these filters.');

  const rows = invitations.map((inv) => {
    const send = inv.status === 'pending'
      ? `<button class="btn btn-gold btn-sm" type="button" data-action="send" data-id="${escapeHtml(inv.id)}">Send email</button>`
      : '';
    const remove = inv.status === 'accepted' ? ''
      : `<button class="btn btn-danger btn-sm" type="button" data-action="delete" data-id="${escapeHtml(inv.id)}" data-name="${escapeHtml(inv.full_name)}">Delete</button>`;
    return '<tr>'
      + cell('Invitee', `<span class="iv-person"><strong>${escapeHtml(inv.full_name)}</strong><small>${escapeHtml(inv.email)}</small></span>`)
      + cell('Grade', `<span class="iv-grade">${escapeHtml(cap(inv.proposed_grade))}</span>`)
      + cell('Qualification', escapeHtml(inv.qualification || '—'))
      + cell('Status', statusBadge(inv.status))
      + cell('Sent', inv.sent_at ? formatDate(inv.sent_at) : '—')
      + cell('Expires', inv.expires_at ? formatDate(inv.expires_at) : '—')
      + cell('Actions', `<div class="row-actions">${send}${remove}${send || remove ? '' : '<span class="iv-done">—</span>'}</div>`)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">Invitee</th><th scope="col">Grade</th><th scope="col">Qualification</th><th scope="col">Status</th><th scope="col">Sent</th><th scope="col">Expires</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* Resolves true when created. `save(data)` throws to keep the dialog open. */
function showInvitationModal(save) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="inv-title">
      <h2 id="inv-title">New manual invitation</h2>
      <form id="inv-form" novalidate>
        <div class="field"><label for="inv-email">Email *</label><input id="inv-email" name="email" type="email" autocomplete="off" placeholder="name@example.com"></div>
        <div class="field"><label for="inv-name">Full name *</label><input id="inv-name" name="fullName" type="text" autocomplete="off"></div>
        <div class="field"><label for="inv-grade">Proposed grade *</label><select id="inv-grade" name="grade">${GRADES.map((g) => `<option value="${g}" ${g === 'affiliate' ? 'selected' : ''}>${cap(g)}</option>`).join('')}</select></div>
        <div class="field"><label for="inv-qualification">Qualification <span class="opt">(optional)</span></label><input id="inv-qualification" name="qualification" type="text" autocomplete="off"></div>
        <div class="field"><label for="inv-affiliation">Affiliation <span class="opt">(optional)</span></label><input id="inv-affiliation" name="affiliation" type="text" autocomplete="off"></div>
        <p class="form-status" id="inv-error" role="alert"></p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-inv="cancel">Cancel</button>
          <button class="btn" type="submit">Create invitation</button>
        </div>
      </form>
    </div>`;

  return new Promise((resolve) => {
    const finish = (value) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(value); };
    const onKey = (event) => { if (event.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(false); });
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#inv-form');
    const error = overlay.querySelector('#inv-error');
    const submit = form.querySelector('[type="submit"]');
    overlay.querySelector('[data-inv="cancel"]').addEventListener('click', () => finish(false));
    form.email.focus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.email = data.email.trim();
      data.fullName = data.fullName.trim();
      data.qualification = data.qualification.trim() || null;
      data.affiliation = data.affiliation.trim() || null;
      if (!EMAIL_PATTERN.test(data.email)) { error.textContent = 'Enter a valid email address.'; form.email.focus(); return; }
      if (!data.fullName) { error.textContent = 'Enter the invitee\'s full name.'; form.fullName.focus(); return; }
      error.textContent = '';
      setBusy(submit, true);
      try {
        await save(data);
        finish(true);
      } catch (err) {
        error.textContent = err.message || 'Unable to create the invitation.';
        setBusy(submit, false);
      }
    });
  });
}

export function initInvitations() {
  const $ = (selector) => document.querySelector(selector);
  const statusSelect = $('#invitation-status');
  const limitSelect = $('#invitation-limit');
  const searchInput = $('#invitation-search');
  const refreshButton = $('#invitations-refresh');
  const createButton = $('#invitation-create');
  const countElement = $('#invitations-status');
  const summary = $('#invitations-summary');
  const tableContainer = $('#invitations-table-container');

  let all = [];
  let requestId = 0;

  function show() {
    const term = searchInput.value.trim().toLowerCase();
    const items = term
      ? all.filter((i) => [i.full_name, i.email, i.qualification, i.affiliation].some((v) => String(v || '').toLowerCase().includes(term)))
      : all;
    countElement.textContent = `${items.length} invitation${items.length === 1 ? '' : 's'}`;
    summary.innerHTML = all.length ? renderSummary(all) : '';
    tableContainer.innerHTML = renderInvitationsTable(items);
  }

  async function load() {
    const current = ++requestId;
    setBusy(refreshButton, true);
    tableContainer.innerHTML = '<div class="skeleton-rows" aria-hidden="true"><i></i><i></i><i></i></div>';
    const result = await fetchInvitations(statusSelect.value, limitSelect.value);
    if (current !== requestId) return;
    setBusy(refreshButton, false);
    if (!result) {
      all = [];
      summary.innerHTML = '';
      countElement.textContent = '';
      tableContainer.innerHTML = '<div class="empty"><p>We could not load invitations. Check your connection and try again.</p></div>';
      return;
    }
    all = result;
    show();
  }

  refreshButton.addEventListener('click', load);
  statusSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);
  searchInput.addEventListener('input', show);

  tableContainer.addEventListener('click', async (event) => {
    const del = event.target.closest('[data-action="delete"]');
    if (del) {
      const ok = await confirmDialog({ title: 'Delete this invitation?', message: `The invitation for ${del.dataset.name || 'this person'} will be removed and its link will stop working.`, confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      setBusy(del, true);
      try {
        await deleteInvitation(del.dataset.id);
        toast('Invitation deleted.', 'ok');
        load();
      } catch (error) {
        toast(error.message || 'Failed to delete invitation.', 'err');
        setBusy(del, false);
      }
      return;
    }
    const button = event.target.closest('[data-action="send"]');
    if (!button) return;
    setBusy(button, true);
    try {
      await sendInvitation(button.dataset.id);
      toast('Invitation email sent.', 'ok');
      load();
    } catch (error) {
      toast(error.message || 'Failed to send invitation.', 'err');
      setBusy(button, false);
    }
  });

  createButton.addEventListener('click', async () => {
    if (await showInvitationModal(createManualInvitation)) {
      toast('Invitation created. Send the email when you are ready.', 'ok');
      load();
    }
  });

  load();
}
