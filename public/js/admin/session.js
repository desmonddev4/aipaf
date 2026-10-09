import { toast } from './shared.js';
import { apiUrl } from '../config.js';

export function initSession({ onAuthenticated }) {
  fetch(apiUrl('/api/admin/session'), { credentials: 'include' })
    .then((response) => {
      if (!response.ok) {
        window.location.replace('/admin-login');
        return;
      }
      onAuthenticated();
    })
    .catch(() => window.location.replace('/admin-login'));

  // Signout is now handled by navigation.js
}
