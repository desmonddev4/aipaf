window.readApiJson = async function (response) {
  try {
    return await response.json();
  } catch (error) {
    console.error('The server returned an invalid API response.', error);
    throw new Error('We could not complete your request right now. Please try again.');
  }
};
