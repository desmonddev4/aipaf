// Shared helpers for the member portal pages.
window.Member = (function () {
  function post(path, body, method) {
    return window.apiFetch(path, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  async function requireAuth() {
    try {
      var response = await window.apiFetch('/api/member-profile');
      if (!response.ok) throw new Error('Authentication required.');
      var payload = await window.readApiJson(response);
      var content = document.querySelector('#page-content');
      var gate = document.querySelector('#page-gate');
      if (content) content.hidden = false;
      if (gate) gate.hidden = true;
      return payload.member;
    } catch (error) {
      window.location.replace('/member-login');
      return new Promise(function () {});
    }
  }

  function signOut() {
    post('/api/members', { action: 'logout' }).catch(function () {}).then(function () { window.location.href = '/member-login'; });
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('[data-member-signout]');
    if (!link) return;
    event.preventDefault();
    signOut();
  });

  function renderRecords(list, container, emptyText) {
    container.innerHTML = '';
    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    list.forEach(function (item) {
      var row = document.createElement('article');
      row.className = 'record-item';
      var title = document.createElement('strong');
      title.textContent = item.name || item.title || 'Record';
      row.appendChild(title);
      var details = document.createElement('p');
      var parts = [];
      if (item.code) parts.push(item.code);
      if (item.status) parts.push('Status: ' + item.status);
      if (item.hours) parts.push(item.hours + ' hours');
      if (item.completion_date) parts.push('Completed ' + String(item.completion_date).slice(0, 10));
      details.textContent = parts.join(' • ');
      row.appendChild(details);
      container.appendChild(row);
    });
  }

  // Wires a form to an async handler with busy state and inline status.
  function bindForm(form, statusEl, handler) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      statusEl.className = 'form-status';
      statusEl.textContent = '';
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        var message = await handler(Object.fromEntries(new FormData(form).entries()));
        if (message) { statusEl.classList.add('ok'); statusEl.textContent = message; }
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }

  async function json(response, fallback) {
    var payload = await window.readApiJson(response);
    if (!response.ok) throw new Error(payload.message || fallback);
    return payload;
  }

  return { post: post, requireAuth: requireAuth, signOut: signOut, renderRecords: renderRecords, bindForm: bindForm, json: json };
})();
