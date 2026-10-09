import { apiFetch, toast } from './shared.js';

// Admin navigation configuration, grouped for the sidebar. `badge` names a pending-count key.
const adminGroups = [
  { label: 'Workspace', items: [
    { id: 'overview', label: 'Overview', icon: 'grid', path: '/admin' },
  ] },
  { label: 'People', items: [
    { id: 'members', label: 'Members', icon: 'users', path: '/admin-members', badge: 'members' },
    { id: 'invitations', label: 'Invitations', icon: 'mail', path: '/admin-invitations' },
    { id: 'applications', label: 'Applications', icon: 'clipboard', path: '/admin-applications' },
  ] },
  { label: 'Finance & learning', items: [
    { id: 'payments', label: 'Payments', icon: 'credit-card', path: '/admin-payments', badge: 'payments' },
    { id: 'examinations', label: 'Examinations', icon: 'file-text', path: '/admin-examinations', badge: 'examinations' },
    { id: 'certificates', label: 'Certificates', icon: 'award', path: '/admin-certificates' },
    { id: 'records', label: 'Records', icon: 'check-circle', path: '/admin-records', badge: 'records' },
  ] },
  { label: 'Compliance', items: [
    { id: 'data-deletion', label: 'Data Deletion', icon: 'trash-2', path: '/admin-data-deletion' },
    { id: 'audit', label: 'Audit Log', icon: 'shield', path: '/admin-audit' },
  ] },
  { label: 'Website', items: [
    { id: 'cms', label: 'Content', icon: 'edit', path: '/cms-admin' },
  ] },
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
  edit: svg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'),
};

let currentSection = 'overview';

// Work out which section the URL belongs to (/admin, /admin-members, /admin-members.html, /admin-members/)
function getCurrentSectionFromPath() {
  const path = window.location.pathname.replace(/\/+$/, '').replace(/\.html$/, '');
  if (/\/cms-admin$/.test(path)) return 'cms';
  const match = path.match(/\/admin-?([^/]*)$/);
  return match && match[1] ? match[1] : 'overview';
}

// Build the sidebar
function generateSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  if (!sidebar) return;

  const active = getCurrentSectionFromPath();
  const navList = sidebar.querySelector('#admin-section-links');
  if (!navList) throw new Error('Admin sidebar is missing #admin-section-links');

  navList.innerHTML = adminGroups.map((group) => `
    <li class="adm-sidebar__group" role="presentation">
      <p class="adm-sidebar__label">${group.label}</p>
      <ul class="adm-sidebar__list">${group.items.map((section) => `
        <li>
          <a href="${section.path}" data-tip="${section.label}"${section.id === active ? ' aria-current="page"' : ''}>
            ${icons[section.icon]}
            <span class="adm-sidebar__text">${section.label}</span>
            ${section.badge ? `<span class="adm-sidebar__badge" data-badge="${section.badge}" hidden></span>` : ''}
          </a>
        </li>`).join('')}
      </ul>
    </li>`).join('');

  sidebar.querySelector('#admin-signout')?.addEventListener('click', handleSignout);
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

// Pending-work counts shown as badges (one request, failures are silent)
async function loadBadges() {
  try {
    const response = await apiFetch('/api/admin/reports?action=overview');
    if (!response.ok) return;
    const data = await response.json();
    const r = data && data.ok && data.report;
    if (!r) return;
    const counts = {
      members: (r.members?.pending || 0) + (r.members?.unverified || 0),
      payments: r.payments?.pending || 0,
      examinations: r.examinations?.pending || 0,
      records: r.cpd?.pending || 0,
    };
    document.querySelectorAll('[data-badge]').forEach((el) => {
      const n = counts[el.dataset.badge] || 0;
      el.textContent = n > 99 ? '99+' : String(n);
      el.setAttribute('aria-label', `${n} pending`);
      el.hidden = n === 0;
    });
  } catch (error) {
    console.error('Failed to load sidebar badges:', error);
  }
}

// Initialize navigation
export function initNavigation() {
  currentSection = getCurrentSectionFromPath();
  generateSidebar();
  loadUserInfo();
  loadBadges();
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