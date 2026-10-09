window.readApiJson = async function (response) {
  try {
    return await response.json();
  } catch (error) {
    console.error('The server returned an invalid API response.', error);
    throw new Error('We could not complete your request right now. Please try again.');
  }
};

window.apiFetch = async function (path, options) {
  const { apiUrl } = await import('/js/config.js');
  return fetch(apiUrl(path), Object.assign({ credentials: 'include' }, options));
};
