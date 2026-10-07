// Central place for everything the future backend will plug into.
// Leave an endpoint empty ("") and the forms fall back to opening the visitor's email app
// addressed to CONTACT_EMAIL, so the site works before any backend exists.
export const CONTACT_EMAIL = 'info@aipaf.africa'; // TODO: replace with the Institute's real address before launch

export const ENDPOINTS = {
  contact: '',    // TODO(backend): e.g. '/api/contact'
  membership: ''  // TODO(backend): e.g. '/api/membership-interest'
};
