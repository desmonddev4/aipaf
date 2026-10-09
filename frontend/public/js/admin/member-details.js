import { escapeHtml } from './shared.js';

async function fetchMemberDetails(id) {
  try {
    const response = await fetch(`/api/admin/members?id=${id}`);
    if (!response.ok) throw new Error('Failed to fetch member details');
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load member details');
    return data;
  } catch (error) {
    console.error('Error fetching member details:', error);
    return null;
  }
}

async function updateMemberDetails(id, data) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-details', id, ...data })
    });
    if (!response.ok) throw new Error('Failed to update member details');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to update member details');
    return result;
  } catch (error) {
    console.error('Error updating member details:', error);
    throw error;
  }
}

async function changeMemberGrade(id, grade) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change-grade', id, grade })
    });
    if (!response.ok) throw new Error('Failed to change member grade');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to change member grade');
    return result;
  } catch (error) {
    console.error('Error changing member grade:', error);
    throw error;
  }
}

async function changeMemberRole(id, role) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change-role', id, role })
    });
    if (!response.ok) throw new Error('Failed to change member role');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to change member role');
    return result;
  } catch (error) {
    console.error('Error changing member role:', error);
    throw error;
  }
}

async function verifyMemberEmail(id) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-email', id })
    });
    if (!response.ok) throw new Error('Failed to verify email');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to verify email');
    return result;
  } catch (error) {
    console.error('Error verifying email:', error);
    throw error;
  }
}

async function resetMemberPassword(id, newPassword) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-password', id, newPassword })
    });
    if (!response.ok) throw new Error('Failed to reset password');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to reset password');
    return result;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

async function deleteMemberAccount(id) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-account', id })
    });
    if (!response.ok) throw new Error('Failed to delete account');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to delete account');
    return result;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}

async function mergeMemberAccounts(sourceId, targetId) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'merge-accounts', sourceId, targetId })
    });
    if (!response.ok) throw new Error('Failed to merge accounts');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to merge accounts');
    return result;
  } catch (error) {
    console.error('Error merging accounts:', error);
    throw error;
  }
}

async function exportMemberData(ids) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export-data', ids })
    });
    if (!response.ok) throw new Error('Failed to export data');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to export data');
    return result;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

async function updateAdminNotes(id, notes) {
  try {
    const response = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-admin-notes', id, notes })
    });
    if (!response.ok) throw new Error('Failed to update notes');
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || 'Failed to update notes');
    return result;
  } catch (error) {
    console.error('Error updating notes:', error);
    throw error;
  }
}

function showMemberDetailModal(memberData, onRefresh) {
  const member = memberData.member;
  const profile = memberData.profile;
  const cpdRecords = memberData.cpdRecords || [];
  const examinations = memberData.examinations || [];
  const payments = memberData.payments || [];
  const certificates = memberData.certificates || [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-header">
        <h2>Member Details</h2>
        <button class="btn btn-ghost" id="modal-close">Close</button>
      </div>
      <div class="modal-body">
        <div class="member-detail-section">
          <h3>Basic Information</h3>
          <div class="detail-grid">
            <div class="detail-item"><label>Email:</label><span>${escapeHtml(member.email)}</span></div>
            <div class="detail-item"><label>Name:</label><span>${escapeHtml(member.first_name)} ${escapeHtml(member.last_name)}</span></div>
            <div class="detail-item"><label>Grade:</label><span>${escapeHtml(member.membership_grade)}</span></div>
            <div class="detail-item"><label>Status:</label><span>${escapeHtml(member.membership_status)}</span></div>
            <div class="detail-item"><label>Role:</label><span>${escapeHtml(member.role)}</span></div>
            <div class="detail-item"><label>Email Verified:</label><span>${member.email_verified ? 'Yes' : 'No'}</span></div>
            <div class="detail-item"><label>Profile Public:</label><span>${member.profile_public ? 'Yes' : 'No'}</span></div>
            <div class="detail-item"><label>Created:</label><span>${new Date(member.created_at).toLocaleDateString()}</span></div>
            <div class="detail-item"><label>Last Login:</label><span>${member.last_login_at ? new Date(member.last_login_at).toLocaleString() : 'Never'}</span></div>
          </div>
        </div>

        <div class="member-detail-section">
          <h3>Professional Information</h3>
          <div class="detail-grid">
            <div class="detail-item"><label>Organisation:</label><span>${escapeHtml(member.organisation || '—')}</span></div>
            <div class="detail-item"><label>Designation:</label><span>${escapeHtml(member.designation || '—')}</span></div>
            <div class="detail-item"><label>Country:</label><span>${escapeHtml(member.country || '—')}</span></div>
          </div>
        </div>

        <div class="member-detail-section">
          <h3>Admin Notes</h3>
          <div class="admin-notes-section">
            <div class="current-notes">${escapeHtml(member.admin_notes || 'No notes added.')}</div>
            <button class="btn btn-ghost" id="edit-notes">Edit Notes</button>
          </div>
        </div>

        <div class="member-detail-section">
          <h3>CPD Records (${cpdRecords.length})</h3>
          ${cpdRecords.length > 0 ? `
            <div class="data-list">
              ${cpdRecords.map(record => `
                <div class="data-item">
                  <span class="data-title">${escapeHtml(record.title || '—')}</span>
                  <span class="data-meta">${record.hours}h • ${record.status} • ${new Date(record.created_at).toLocaleDateString()}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="empty-text">No CPD records found.</p>'}
        </div>

        <div class="member-detail-section">
          <h3>Examination History (${examinations.length})</h3>
          ${examinations.length > 0 ? `
            <div class="data-list">
              ${examinations.map(exam => `
                <div class="data-item">
                  <span class="data-title">${escapeHtml(exam.examination_name || '—')} (${escapeHtml(exam.examination_code || '—')})</span>
                  <span class="data-meta">${exam.result_status || exam.status} • ${exam.result_score ? exam.result_score + '%' : '—'} • ${new Date(exam.registered_at).toLocaleDateString()}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="empty-text">No examination history found.</p>'}
        </div>

        <div class="member-detail-section">
          <h3>Payment History (${payments.length})</h3>
          ${payments.length > 0 ? `
            <div class="data-list">
              ${payments.map(payment => `
                <div class="data-item">
                  <span class="data-title">${escapeHtml(payment.purpose || '—')} • ${payment.currency}${payment.amount}</span>
                  <span class="data-meta">${payment.status} • ${payment.provider} • ${new Date(payment.created_at).toLocaleDateString()}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="empty-text">No payment history found.</p>'}
        </div>

        <div class="member-detail-section">
          <h3>Certificates (${certificates.length})</h3>
          ${certificates.length > 0 ? `
            <div class="data-list">
              ${certificates.map(cert => `
                <div class="data-item">
                  <span class="data-title">${escapeHtml(cert.name)} (${escapeHtml(cert.type)})</span>
                  <span class="data-meta">${escapeHtml(cert.grade)} • Issued: ${new Date(cert.issued_at).toLocaleDateString()}${cert.expires_at ? ' • Expires: ' + new Date(cert.expires_at).toLocaleDateString() : ''}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="empty-text">No certificates found.</p>'}
        </div>

        <div class="member-detail-section">
          <h3>Actions</h3>
          <div class="action-buttons">
            <button class="btn btn-ghost" id="edit-details">Edit Details</button>
            <button class="btn btn-ghost" id="change-grade">Change Grade</button>
            <button class="btn btn-ghost" id="change-role">Change Role</button>
            ${!member.email_verified ? '<button class="btn btn-ghost" id="verify-email">Verify Email</button>' : ''}
            <button class="btn btn-ghost" id="reset-password">Reset Password</button>
            <button class="btn btn-ghost" id="export-data">Export Data</button>
            <button class="btn btn-ghost" id="merge-account">Merge Account</button>
            <button class="btn btn-ghost" id="delete-account" style="color: var(--a-error)">Delete Account</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#modal-close');
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Edit details
  modal.querySelector('#edit-details').addEventListener('click', async () => {
    const newData = await showEditDetailsModal(member);
    if (newData) {
      try {
        await updateMemberDetails(member.id, newData);
        alert('Member details updated successfully.');
        document.body.removeChild(modal);
        onRefresh();
      } catch (error) {
        alert(error.message || 'Failed to update member details.');
      }
    }
  });

  // Change grade
  modal.querySelector('#change-grade').addEventListener('click', async () => {
    const newGrade = prompt('Enter new grade (student, affiliate, associate, member, fellow):', member.membership_grade);
    if (newGrade && newGrade !== member.membership_grade) {
      if (!confirm(`Change grade to ${newGrade}?`)) return;
      try {
        await changeMemberGrade(member.id, newGrade);
        alert('Member grade changed successfully.');
        document.body.removeChild(modal);
        onRefresh();
      } catch (error) {
        alert(error.message || 'Failed to change member grade.');
      }
    }
  });

  // Change role
  modal.querySelector('#change-role').addEventListener('click', async () => {
    const newRole = prompt('Enter new role (member, secretariat, council):', member.role);
    if (newRole && newRole !== member.role) {
      if (!confirm(`Change role to ${newRole}?`)) return;
      try {
        await changeMemberRole(member.id, newRole);
        alert('Member role changed successfully.');
        document.body.removeChild(modal);
        onRefresh();
      } catch (error) {
        alert(error.message || 'Failed to change member role.');
      }
    }
  });

  // Verify email
  const verifyBtn = modal.querySelector('#verify-email');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      if (!confirm('Verify this member\'s email?')) return;
      try {
        await verifyMemberEmail(member.id);
        alert('Email verified successfully.');
        document.body.removeChild(modal);
        onRefresh();
      } catch (error) {
        alert(error.message || 'Failed to verify email.');
      }
    });
  }

  // Reset password
  modal.querySelector('#reset-password').addEventListener('click', async () => {
    const newPassword = prompt('Enter new password (min 12 characters):');
    if (newPassword && newPassword.length >= 12) {
      const confirmPass = prompt('Confirm new password:');
      if (newPassword !== confirmPass) {
        alert('Passwords do not match.');
        return;
      }
      if (!confirm('Reset this member\'s password? This action cannot be undone.')) return;
      try {
        await resetMemberPassword(member.id, newPassword);
        alert('Password reset successfully.');
      } catch (error) {
        alert(error.message || 'Failed to reset password.');
      }
    } else if (newPassword) {
      alert('Password must be at least 12 characters.');
    }
  });

  // Delete account
  modal.querySelector('#delete-account').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this member account? This action cannot be undone and will delete all associated data.')) return;
    const confirmText = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmText === 'DELETE') {
      try {
        await deleteMemberAccount(member.id);
        alert('Member account deleted successfully.');
        document.body.removeChild(modal);
        onRefresh();
      } catch (error) {
        alert(error.message || 'Failed to delete account.');
      }
    }
  });

  // Export data
  modal.querySelector('#export-data').addEventListener('click', async () => {
    try {
      const result = await exportMemberData([member.id]);
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `member-${member.id}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('Member data exported successfully.');
    } catch (error) {
      alert(error.message || 'Failed to export member data.');
    }
  });

  // Merge account
  modal.querySelector('#merge-account').addEventListener('click', async () => {
    const targetId = prompt('Enter target member ID to merge this account into:');
    if (!targetId) return;
    if (targetId === member.id) {
      alert('Cannot merge account into itself.');
      return;
    }
    if (!confirm(`Merge account ${member.email} into member ID ${targetId}? This will transfer all associated data and delete the source account.`)) return;
    try {
      await mergeMemberAccounts(member.id, targetId);
      alert('Accounts merged successfully.');
      document.body.removeChild(modal);
      onRefresh();
    } catch (error) {
      alert(error.message || 'Failed to merge accounts.');
    }
  });

  // Edit admin notes
  modal.querySelector('#edit-notes').addEventListener('click', async () => {
    const newNotes = prompt('Enter admin notes:', member.admin_notes || '');
    if (newNotes !== null) {
      try {
        await updateAdminNotes(member.id, newNotes);
        alert('Admin notes updated successfully.');
        document.body.removeChild(modal);
        onRefresh();
      } catch (error) {
        alert(error.message || 'Failed to update admin notes.');
      }
    }
  });
}

function showEditDetailsModal(member) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h2>Edit Member Details</h2>
      <form id="edit-form">
        <div class="field"><label for="edit-first-name">First Name</label><input id="edit-first-name" name="first_name" type="text" value="${escapeHtml(member.first_name)}"></div>
        <div class="field"><label for="edit-last-name">Last Name</label><input id="edit-last-name" name="last_name" type="text" value="${escapeHtml(member.last_name)}"></div>
        <div class="field"><label for="edit-organisation">Organisation</label><input id="edit-organisation" name="organisation" type="text" value="${escapeHtml(member.organisation || '')}"></div>
        <div class="field"><label for="edit-designation">Designation</label><input id="edit-designation" name="designation" type="text" value="${escapeHtml(member.designation || '')}"></div>
        <div class="field"><label for="edit-country">Country</label><input id="edit-country" name="country" type="text" value="${escapeHtml(member.country || '')}"></div>
        <div class="field checkbox-field"><input id="edit-profile-public" name="profile_public" type="checkbox" ${member.profile_public ? 'checked' : ''}><label for="edit-profile-public">Profile Public</label></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" id="edit-cancel">Cancel</button>
          <button class="btn" type="submit">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  return new Promise((resolve) => {
    const form = modal.querySelector('#edit-form');
    const cancelBtn = modal.querySelector('#edit-cancel');

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.profile_public = formData.get('profile_public') === 'on';

      document.body.removeChild(modal);
      resolve(data);
    });
  });
}

export function initMemberDetails() {
  // Add click listener to members table for viewing details
  const tableContainer = document.querySelector('#admin-table-container');
  if (!tableContainer) return;

  tableContainer.addEventListener('click', async function (event) {
    const emailCell = event.target.closest('td[data-label="Email"]');
    if (!emailCell) return;

    const email = emailCell.textContent.trim();
    if (!email) return;

    // Find member ID from the row
    const row = emailCell.closest('tr');
    const idCell = row.querySelector('td[data-label="ID"]');
    if (!idCell) return;

    const memberId = idCell.textContent.trim();

    const memberData = await fetchMemberDetails(memberId);
    if (!memberData) {
      alert('Failed to load member details.');
      return;
    }

    showMemberDetailModal(memberData, () => {
      // Refresh the members table
      const refreshBtn = document.querySelector('#admin-refresh');
      if (refreshBtn) refreshBtn.click();
    });
  });
}
