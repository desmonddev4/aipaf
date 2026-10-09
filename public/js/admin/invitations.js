import { cell, escapeHtml } from './shared.js';

async function fetchInvitations(status, limit) {
  try {
    const params = new URLSearchParams({ action: 'list' });
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);

    const response = await fetch(`/api/member-invitations?${params.toString()}`);
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
    const response = await fetch(apiUrl('/api/member-invitations?action=send', {
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

async function createManualInvitation(data) {
  try {
    const response = await fetch(apiUrl('/api/member-invitations?action=create', {
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

function renderInvitationsTable(invitations) {
  if (!invitations || invitations.length === 0) {
    return '<p class="admin-note">No invitations found.</p>';
  }

  const rows = invitations.map(inv => {
    const statusClass = inv.status === 'accepted' ? 'status-ok' : inv.status === 'expired' ? 'status-err' : '';
    const statusLabel = inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
    const gradeLabel = inv.proposed_grade.charAt(0).toUpperCase() + inv.proposed_grade.slice(1);
    const canSend = inv.status === 'pending';
    const sendButton = canSend
      ? `<button class="btn btn-ghost btn-sm" data-action="send" data-id="${inv.id}">Send email</button>`
      : '';

    return '<tr>'
      + cell('Email', escapeHtml(inv.email))
      + cell('Name', escapeHtml(inv.full_name))
      + cell('Grade', escapeHtml(gradeLabel))
      + cell('Qualification', escapeHtml(inv.qualification || '—'))
      + cell('Status', `<span class="${statusClass}">${escapeHtml(statusLabel)}</span>`)
      + cell('Sent', escapeHtml(inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : '—'))
      + cell('Actions', sendButton)
      + '</tr>';
  }).join('');

  return `<table class="data-table"><thead><tr><th scope="col">Email</th><th scope="col">Name</th><th scope="col">Grade</th><th scope="col">Qualification</th><th scope="col">Status</th><th scope="col">Sent</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function initInvitations() {
  const statusSelect = document.querySelector('#invitation-status');
  const limitSelect = document.querySelector('#invitation-limit');
  const refreshButton = document.querySelector('#invitations-refresh');
  const createButton = document.querySelector('#invitation-create');
  const statusElement = document.querySelector('#invitations-status');
  const tableContainer = document.querySelector('#invitations-table-container');

  async function load() {
    tableContainer.innerHTML = '<p class="admin-note">Loading invitations...</p>';
    const invitations = await fetchInvitations(statusSelect.value, limitSelect.value);
    if (!invitations) {
      tableContainer.innerHTML = '<p class="admin-note">Unable to load invitations. Please try again.</p>';
      return;
    }
    tableContainer.innerHTML = renderInvitationsTable(invitations);
  }

  refreshButton.addEventListener('click', load);
  statusSelect.addEventListener('change', load);
  limitSelect.addEventListener('change', load);

  tableContainer.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action="send"]');
    if (!button) return;

    const id = button.dataset.id;
    button.disabled = true;
    button.textContent = 'Sending...';

    try {
      await sendInvitation(id);
      statusElement.textContent = 'Invitation sent successfully.';
      statusElement.className = 'records-status ok';
      load();
    } catch (error) {
      statusElement.textContent = error.message || 'Failed to send invitation.';
      statusElement.className = 'records-status err';
      button.disabled = false;
      button.textContent = 'Send email';
    }
  });

  createButton.addEventListener('click', function () {
    const email = prompt('Enter email address:');
    if (!email) return;

    const fullName = prompt('Enter full name:');
    if (!fullName) return;

    const grade = prompt('Enter grade (fellow, member, associate, affiliate, graduate):', 'affiliate');
    if (!grade) return;

    const qualification = prompt('Enter qualification (optional):') || null;
    const affiliation = prompt('Enter affiliation (optional):') || null;

    createButton.disabled = true;
    createButton.textContent = 'Creating...';

    createManualInvitation({ email, fullName, grade, qualification, affiliation })
      .then(() => {
        statusElement.textContent = 'Invitation created successfully.';
        statusElement.className = 'records-status ok';
        load();
      })
      .catch(error => {
        statusElement.textContent = error.message || 'Failed to create invitation.';
        statusElement.className = 'records-status err';
      })
      .finally(() => {
        createButton.disabled = false;
        createButton.textContent = 'Create manual invitation';
      });
  });

  load();
}
