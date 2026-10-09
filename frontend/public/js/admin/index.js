import { initNavigation } from './navigation.js';
import { initApplications } from './applications.js';
import { initAudit } from './audit.js';
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

// Initialize navigation
initNavigation();

const has = (selector) => Boolean(document.querySelector(selector));

// Initialize modules based on current section
const submissions = has('#admin-table-container') ? initSubmissions({
  showLogin: (message) => {
    if (message === 'Invalid or expired key.') {
      window.location.replace('/admin-login');
      return;
    }
    toast(message || 'Unable to load admin data.', 'err');
  },
}) : { refresh() {} };

if (has('#records-table-container')) initRecords();
if (has('#certificate-form')) initCertificates();
if (has('#admin-table-container')) initMemberDetails();
initSession({
  onAuthenticated: submissions.refresh,
});

// Initialize section-specific modules
if (has('#overview-report')) initOverview();
if (has('#invitation-status')) initInvitations();
if (has('#payment-status')) initPayments();
if (has('#exam-status')) initExaminations();
if (has('#apps-table-container')) initApplications();
if (has('#deletions-table-container')) {
  initDataDeletion({
    showLogin: (message) => {
      if (message === 'Invalid or expired key.') {
        window.location.replace('/admin-login');
        return;
      }
      toast(message || 'Unable to load admin data.', 'err');
    },
  });
}
if (has('#audit-table-container')) {
  initAudit({
    showLogin: (message) => {
      if (message === 'Invalid or expired key.') {
        window.location.replace('/admin-login');
        return;
      }
      toast(message || 'Unable to load admin data.', 'err');
    },
  });
}
