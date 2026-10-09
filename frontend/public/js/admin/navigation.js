import { apiFetch, toast } from './shared.js';

// Admin navigation configuration
const adminSections = [
  { id: 'overview', label: 'Overview', icon: 'grid', path: '/admin' },
  { id: 'members', label: 'Members', icon: 'users', path: '/admin-members' },
  { id: 'payments', label: 'Payments', icon: 'credit-card', path: '/admin-payments' },
  { id: 'examinations', label: 'Examinations', icon: 'file-text', path: '/admin-examinations' },
  { id: 'certificates', label: 'Certificates', icon: 'award', path: '/admin-certificates' },
  { id: 'invitations', label: 'Invitations', icon: 'mail', path: '/admin-invitations' },
  { id: 'applications', label: 'Applications', icon: 'clipboard', path: '/admin-applications' },
  { id: 'records', label: 'Records', icon: 'check-circle', path: '/admin-records' },
  { id: 'data-deletion', label: 'Data Deletion', icon: 'trash-2', path: '/admin-data-deletion' },
  { id: 'audit', label: 'Audit Log', icon: 'shield', path: '/admin-audit' },
];

// SVG icons (decorative; the text label carries the meaning)
const svg = (inner) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

const icons = {
  grid: svg('<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>'),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'),
  'credit-card': svg('<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>'),
  'file-text': svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>'),
  award: svg('<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>'),
  // was an upload-cloud glyph; this is a proper envelope for "Invitations"
  mail: svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>'),
  clipboard: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line>'),
  'check-circle': svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'),
  'trash-2': svg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'),
};

let currentSection = 'overview';

// Work out which section the URL belongs to (/admin, /admin-members, /admin-members.html, /admin-members/)
function getCurrentSectionFromPath() {
  const path = window.location.pathname.replace(/\/+$/, '').replace(/\.html$/, '');
  const match = path.match(/\/admin-?([^/]*)$/);
  return match && match[1] ? match[1] : 'overview';
}

// Build the sidebar
function generateSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  if (!sidebar) return;

  const active = getCurrentSectionFromPath();

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h2>Admin Dashboard</h2>
      <p class="sidebar-user" id="sidebar-user-name">Loading…</p>
    </div>
    <nav class="sidebar-nav" aria-label="Admin navigation">
      <ul>
        ${adminSections.map((section) => {
          const isActive = section.id === active;
          return `
          <li>
            <a href="${section.path}" class="nav-link${isActive ? ' nav-link-active' : ''}"${isActive ? ' aria-current="page"' : ''}>
              ${icons[section.icon]}
              <span>${section.label}</span>
            </a>
          </li>`;
        }).join('')}
      </ul>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-sm" type="button" id="admin-signout">Sign out</button>
    </div>
  `;

  document.getElementById('admin-signout')?.addEventListener('click', handleSignout);
}

// Sign out
async function handleSignout(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await apiFetch('/api/admin/session', { method: 'DELETE' });
    if (response.ok) {
      window.location.replace('/admin-login');
      return;
    }
    toast('Failed to sign out', 'err');
  } catch (error) {
    console.error('Signout error:', error);
    toast('Failed to sign out', 'err');
  }
  button.disabled = false;
}

// Show who is signed in
async function loadUserInfo() {
  const userNameEl = document.getElementById('sidebar-user-name');
  if (!userNameEl) return;

  try {
    const response = await apiFetch('/api/admin/session');
    if (response.status === 401) {
      window.location.replace('/admin-login');
      return;
    }
    if (response.ok) {
      const data = await response.json();
      userNameEl.textContent = (data.ok && data.admin && (data.admin.name || data.admin.email)) || 'Admin';
      return;
    }
    userNameEl.textContent = 'Admin';
  } catch (error) {
    console.error('Failed to load user info:', error);
    userNameEl.textContent = 'Admin';
  }
}

// Initialize navigation
export function initNavigation() {
  currentSection = getCurrentSectionFromPath();
  generateSidebar();
  loadUserInfo();
}

// Navigate to a section
export function navigateTo(sectionId) {
  const section = adminSections.find((s) => s.id === sectionId);
  if (section) window.location.href = section.path;
}

// Get current section
export function getCurrentSection() {
  return currentSection;
}