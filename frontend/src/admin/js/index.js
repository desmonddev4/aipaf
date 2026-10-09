import { initNavigation } from './navigation.js';
import { initApplications } from './applications.js';
import { initAudit } from './audit.js';
import { initCms } from './cms.js';
import { initCertificates } from './certificates.js';
import { initDataDeletion } from './data-deletion.js';
import { initExaminations } from './examinations.js';
import { initInvitations } from './invitations.js';
import { initMemberDetails } from './member-details.js';
import { initOverview } from './overview.js';
import { initPayments } from './payments.js';
import { initRecords } from './records.js';
import { initSession } from './session.js';
import { initSubmissions } from './submissions.js';
import { toast } from './shared.js';

const has = (selector) => Boolean(document.querySelector(selector));

// One place decides what happens when a module reports a problem:
// an expired or invalid session sends you to the login page, anything else is a toast.
const AUTH_ERROR = /invalid or expired|unauthori[sz]ed|not authenticated|sign in again/i;
function handleAuthError(message) {
  if (AUTH_ERROR.test(message || '')) {
    window.location.replace('/admin-login');
    return;
  }
  toast(message || 'Unable to load admin data.', 'err');
}

// A failure in one section must not stop the rest of the page from starting.
function start(name, init) {
  try {
    return init();
  } catch (error) {
    console.error(`Admin module "${name}" failed to start:`, error);
    toast(`Part of this page failed to load (${name}).`, 'err');
    return undefined;
  }
}

// Sidebar + sign-out
start('navigation', initNavigation);

// Members / submissions table
const noSubmissions = { refresh() {} };
const submissions = has('#admin-table-container')
  ? start('submissions', () => initSubmissions({ showLogin: handleAuthError })) || noSubmissions
  : noSubmissions;

if (has('#records-table-container')) start('records', initRecords);
if (has('#certificate-form')) start('certificates', initCertificates);
if (has('#admin-table-container')) start('member details', initMemberDetails);

start('session', () => initSession({ onAuthenticated: submissions.refresh }));

// Section-specific modules (each only runs on the page that has its markup)
if (has('#overview-report')) start('overview', initOverview);
if (has('#invitation-status')) start('invitations', initInvitations);
if (has('#payment-status')) start('payments', initPayments);
if (has('#exam-status')) start('examinations', initExaminations);
if (has('#apps-table-container')) start('applications', initApplications);
if (has('#deletions-table-container')) start('data deletion', () => initDataDeletion({ showLogin: handleAuthError }));
if (has('#audit-table-container')) start('audit log', () => initAudit({ showLogin: handleAuthError }));
if (has('#cms-list')) start('content', () => initCms({ showLogin: handleAuthError }));
