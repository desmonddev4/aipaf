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

const submissions = initSubmissions({
  showLogin: (message) => {
    if (message === 'Invalid or expired key.') {
      window.location.replace('/admin-login');
      return;
    }
    toast(message || 'Unable to load admin data.', 'err');
  },
});
initRecords();
initCertificates();
initOverview();
initInvitations();
initPayments();
initExaminations();
initMemberDetails();
initApplications();
initDataDeletion({
  showLogin: (message) => {
    if (message === 'Invalid or expired key.') {
      window.location.replace('/admin-login');
      return;
    }
    toast(message || 'Unable to load admin data.', 'err');
  },
});
initAudit({
  showLogin: (message) => {
    if (message === 'Invalid or expired key.') {
      window.location.replace('/admin-login');
      return;
    }
    toast(message || 'Unable to load admin data.', 'err');
  },
});
initSession({
  onAuthenticated: submissions.refresh,
});
