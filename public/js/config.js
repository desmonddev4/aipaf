// Backend endpoints for production form submissions. These values are public by design.
export const CONTACT_EMAIL = 'info@aipafgh.org';

// Render backend API URL (update this to your actual Render backend URL)
export const API_BASE_URL = 'https://aipaf-website.onrender.com';

export const ENDPOINTS = {
  contact: `${API_BASE_URL}/api/contact`,
  membership: `${API_BASE_URL}/api/membership-interest`,
};

// Helper function to get full API URL
export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}