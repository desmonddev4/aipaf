/* AIPAF CMS dashboard.
   Plain script (no imports), as in the original. Wrapped in a function so its
   names cannot clash with other scripts on the page. */
(function () {
  const login = document.querySelector('#cms-login');
  const dashboard = document.querySelector('#cms-dashboard');
  const token = sessionStorage.getItem('aipaf-cms-token') || '';
  const typeSelect = document.querySelector('#cms-type');
  const statusSelect = document.querySelector('#cms-status');
  const list = document.querySelector('#cms-list');
  const editor = document.querySelector('#cms-form-editor');
  const editorStatus = document.querySelector('#cms-editor-status');
  const loginStatus = document.querySelector('#cms-login-status');

  let requestSeq = 0;   // ignores slow responses that arrive after a newer request
  let editingSlug = ''; // which list item is loaded in the editor

  /* ---------- helpers ---------- */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    })[char]);
  }
  function cls(value) {
    return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }
  function headers() {
    return { Authorization: `Bearer ${sessionStorage.getItem('aipaf-cms-token') || ''}` };
  }

  let toastHost;
  function toast(message, type) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'cms-toasts';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    const el = document.createElement('div');
    el.className = `cms-toast ${cls(type || 'info')}`;
    el.textContent = message;
    toastHost.appendChild(el);
    const dismiss = () => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); };
    const timer = setTimeout(dismiss, 4200);
    el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
  }

  function setEditorMessage(message, kind) {
    editorStatus.className = `form-status${kind ? ` ${kind}` : ''}`;
    editorStatus.textContent = message;
  }

  /* ---------- show / hide ---------- */
  function showDashboard() {
    login.style.display = 'none';
    dashboard.classList.add('is-open');
    refresh();
  }

  function hideDashboard() {
    login.style.display = 'block';
    dashboard.classList.remove('is-open');
    sessionStorage.removeItem('aipaf-cms-token');
    document.querySelector('#cms-token').value = '';
    loginStatus.textContent = '';
    editingSlug = '';
  }

  /* ---------- list ---------- */
  function renderList(items) {
    if (!items.length) {
      list.innerHTML = '<div class="empty">No content matches this filter.</div>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <article class="item${item.slug === editingSlug ? ' is-editing' : ''}" data-slug="${esc(item.slug)}">
        <div class="item-header">
          <div><strong>${esc(item.title)}</strong><br><small>${esc(item.slug)}</small></div>
          <span class="tag tag-${cls(item.status)}">${esc(item.status)}</span>
        </div>
        ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
        <div class="toolbar-actions">
          <button type="button" class="btn btn-sm secondary" data-action="load" data-slug="${esc(item.slug)}">Edit</button>
          <button type="button" class="btn btn-sm danger" data-action="delete" data-slug="${esc(item.slug)}">Delete</button>
        </div>
      </article>`).join('');
  }

  function showSkeleton() {
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  }

  function refresh() {
    const seq = ++requestSeq;
    showSkeleton();
    fetch(`/api/cms?type=${encodeURIComponent(typeSelect.value)}&status=${encodeURIComponent(statusSelect.value)}`, { headers: headers() })
      .then(async (response) => {
        if (response.status === 401) throw new Error('Invalid or expired key.');
        const payload = await window.readApiJson(response);
        if (!response.ok) throw new Error(payload.message || 'Unable to load content.');
        return payload;
      })
      .then((payload) => { if (seq === requestSeq) renderList(payload.items || []); })
      .catch((error) => {
        if (seq !== requestSeq) return;
        hideDashboard();
        loginStatus.textContent = error.message;
      });
  }

  /* Edit and Delete use one delegated listener, so re-rendering the list never leaks handlers. */
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const slug = button.dataset.slug;

    if (button.dataset.action === 'load') {
      button.disabled = true;
      fetch(`/api/cms?slug=${encodeURIComponent(slug)}`, { headers: headers() })
        .then((response) => window.readApiJson(response))
        .then((payload) => {
          if (!payload.ok) throw new Error(payload.message || 'Unable to load content.');
          document.querySelector('#cms-slug').value = payload.item.slug;
          document.querySelector('#cms-title').value = payload.item.title;
          document.querySelector('#cms-summary').value = payload.item.summary || '';
          document.querySelector('#cms-body').value = payload.item.body || '';
          document.querySelector('#cms-status-editor').value = payload.item.status || 'draft';

          editingSlug = payload.item.slug;
          list.querySelectorAll('.item').forEach((el) => el.classList.toggle('is-editing', el.dataset.slug === editingSlug));
          setEditorMessage(`Editing "${payload.item.title}". Saving updates this item.`, 'info');
          editor.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
          document.querySelector('#cms-title').focus({ preventScroll: true });
        })
        .catch((error) => toast(error.message, 'err'))
        .finally(() => { button.disabled = false; });
    }

    if (button.dataset.action === 'delete') {
      if (!window.confirm('Delete this content item?')) return;
      button.disabled = true;
      fetch(`/api/cms?slug=${encodeURIComponent(slug)}`, { method: 'DELETE', headers: headers() })
        .then((response) => window.readApiJson(response))
        .then((payload) => {
          if (!payload.ok) throw new Error(payload.message || 'Delete failed.');
          if (slug === editingSlug) { editingSlug = ''; editor.reset(); setEditorMessage(''); }
          toast('Content deleted.', 'ok');
          refresh();
        })
        .catch((error) => { button.disabled = false; toast(error.message, 'err'); });
    }
  });

  /* ---------- login ---------- */
  document.querySelector('#cms-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.querySelector('#cms-token').value.trim();
    if (!value) {
      loginStatus.textContent = 'Enter your API key.';
      return;
    }
    sessionStorage.setItem('aipaf-cms-token', value);
    showDashboard();
  });

  /* ---------- save ---------- */
  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    setEditorMessage('');
    const button = editor.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      const payload = Object.fromEntries(new FormData(editor).entries());
      payload.type = typeSelect.value;
      const response = await fetch('/api/cms', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
        body: JSON.stringify(payload),
      });
      const data = await window.readApiJson(response);
      if (!response.ok) throw new Error(data.message || 'Unable to save content.');
      setEditorMessage('Content saved.', 'ok');
      toast('Content saved.', 'ok');
      editingSlug = '';
      editor.reset();
      refresh();
    } catch (error) {
      setEditorMessage(error.message);
    } finally {
      button.disabled = false;
    }
  });

  typeSelect.addEventListener('change', refresh);
  statusSelect.addEventListener('change', refresh);
  document.querySelector('#cms-refresh').addEventListener('click', refresh);
  document.querySelector('#cms-signout').addEventListener('click', hideDashboard);

  if (token) showDashboard();
})();