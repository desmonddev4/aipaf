import { initCertificates } from './certificates.js';
import { initOverview } from './overview.js';
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
initSession({
  onAuthenticated: submissions.refresh,
});
