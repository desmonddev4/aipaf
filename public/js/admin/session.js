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

  document.querySelector('#admin-signout').addEventListener('click', async () => {
    try {
      const response = await fetch(apiUrl('/api/admin/session'), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Unable to sign out.');
      window.location.assign('/admin-login');
    } catch (error) {
      console.error('Admin sign-out failed.', error);
      toast('Sign-out may not have completed. Please try again.', 'err');
    }
  });
}
