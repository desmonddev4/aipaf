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

// Get current section from URL
const currentSection = window.location.pathname.replace('/admin-', '').replace('/', '') || 'overview';

// Initialize modules based on current section
const submissions = initSubmissions({
  showLogin: (message) => {
    if (message === 'Invalid or expired key.') {
      window.location.replace('/admin-login');
      return;
    }
    toast(message || 'Unable to load admin data.', 'err');
  },
});

// Always initialize these as they're used across sections
initRecords();
initCertificates();
initMemberDetails();
initSession({
  onAuthenticated: submissions.refresh,
});

// Initialize section-specific modules
if (currentSection === 'overview') {
  initOverview();
} else if (currentSection === 'members') {
  // Submissions handles members
} else if (currentSection === 'payments') {
  initPayments();
} else if (currentSection === 'examinations') {
  initExaminations();
} else if (currentSection === 'certificates') {
  // Certificates already initialized
} else if (currentSection === 'invitations') {
  initInvitations();
} else if (currentSection === 'applications') {
  initApplications();
} else if (currentSection === 'records') {
  // Records already initialized
} else if (currentSection === 'data-deletion') {
  initDataDeletion({
    showLogin: (message) => {
      if (message === 'Invalid or expired key.') {
        window.location.replace('/admin-login');
        return;
      }
      toast(message || 'Unable to load admin data.', 'err');
    },
  });
} else if (currentSection === 'audit') {
  initAudit({
    showLogin: (message) => {
      if (message === 'Invalid or expired key.') {
        window.location.replace('/admin-login');
        return;
      }
      toast(message || 'Unable to load admin data.', 'err');
    },
  });
} else {
  // Default to overview
  initOverview();
}
