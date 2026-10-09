import { apiFetch, cell, confirmDialog, emptyState, escapeHtml, formatDate, setBusy, statusBadge, toast } from './shared.js';

const TYPES = ['page', 'news', 'publication', 'event', 'download'];
const cap = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);

export function initCms({ showLogin } = {}) {
  const $ = (selector) => document.querySelector(selector);
  const list = $('#cms-list');
  const typeSelect = $('#cms-type');
  const statusSelect = $('#cms-status');
  const search = $('#cms-search');
  const count = $('#cms-count');
  let items = [];
  let seq = 0; // ignores slow responses that arrive after a newer request

  const slugify = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

  async function request(path, options) {
    const response = await apiFetch(path, options);
    let payload = {};
    try { payload = await response.json(); } catch { /* non-JSON error body */ }
    if (response.status === 401) { showLogin?.('Please sign in again.'); throw new Error('Please sign in again.'); }
    if (!response.ok || payload.ok === false) throw new Error(payload.message || 'Request failed.');
    return payload;
  }

  function render() {
    const term = search.value.trim().toLowerCase();
    const shown = items.filter((item) => !term || `${item.title} ${item.slug} ${item.summary || ''}`.toLowerCase().includes(term));
    count.textContent = `${shown.length} item${shown.length === 1 ? '' : 's'}`;
    if (!shown.length) {
      list.innerHTML = emptyState(items.length ? 'Nothing matches your search.' : `No ${statusSelect.value} ${typeSelect.value} content yet.`);
      return;
    }
    const rows = shown.map((item) => {
      const action = item.status === 'published'
        ? `<button class="btn btn-sm btn-ghost" type="button" data-act="archive" data-slug="${escapeHtml(item.slug)}">Archive</button>`
        : `<button class="btn btn-sm btn-gold" type="button" data-act="publish" data-slug="${escapeHtml(item.slug)}">Publish</button>`;
      return `<tr>`
        + cell('Title', `<div class="cm-title"><strong>${escapeHtml(item.title)}</strong><small>/${escapeHtml(item.slug)}</small>${item.summary ? `<span>${escapeHtml(item.summary)}</span>` : ''}</div>`)
        + cell('Status', statusBadge(item.status))
        + cell('Date', formatDate(item.published_at || item.created_at))
        + cell('Actions', `<div class="row-actions">
            <button class="btn btn-sm" type="button" data-act="edit" data-slug="${escapeHtml(item.slug)}">Edit</button>
            ${action}
            <button class="btn btn-sm btn-danger" type="button" data-act="delete" data-slug="${escapeHtml(item.slug)}">Delete</button>
          </div>`)
        + `</tr>`;
    }).join('');
    list.innerHTML = `<table class="data-table"><thead><tr><th scope="col">Title</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  async function refresh() {
    const mine = ++seq;
    list.innerHTML = '<div class="skeleton-rows"><i></i><i></i><i></i></div>';
    count.textContent = '';
    try {
      const payload = await request(`/api/cms?type=${encodeURIComponent(typeSelect.value)}&status=${encodeURIComponent(statusSelect.value)}`);
      if (mine !== seq) return;
      items = payload.items || [];
      render();
    } catch (error) {
      if (mine !== seq) return;
      items = [];
      list.innerHTML = emptyState(error.message);
    }
    updateTabs();
  }

  function updateTabs() {
    document.querySelectorAll('[data-type]').forEach((tab) => {
      const on = tab.dataset.type === typeSelect.value;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    });
  }

  /* ---------- editor modal ---------- */
  function openEditor(existing) {
    const isEdit = Boolean(existing);
    const item = existing || { slug: '', title: '', summary: '', body: '', status: 'draft' };
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <form class="modal modal-large" role="dialog" aria-modal="true" aria-labelledby="cm-modal-title" novalidate>
        <div class="modal-header">
          <h2 id="cm-modal-title">${isEdit ? 'Edit' : 'New'} ${escapeHtml(typeSelect.value)}</h2>
        </div>
        <div class="modal-body">
          <div class="field"><label for="cm-title">Title</label><input id="cm-title" name="title" type="text" maxlength="180" required value="${escapeHtml(item.title)}"></div>
          <div class="cm-row">
            <div class="field"><label for="cm-slug">Slug (web address)</label><input id="cm-slug" name="slug" type="text" maxlength="120" required value="${escapeHtml(item.slug)}" ${isEdit ? 'readonly' : ''}></div>
            <div class="field"><label for="cm-status-editor">Status</label>
              <select id="cm-status-editor" name="status">
                ${['draft', 'published', 'archived'].map((s) => `<option value="${s}"${item.status === s ? ' selected' : ''}>${cap(s)}</option>`).join('')}
              </select></div>
          </div>
          <div class="field"><label for="cm-summary">Summary</label><textarea id="cm-summary" name="summary" rows="2" maxlength="500">${escapeHtml(item.summary || '')}</textarea></div>
          <div class="field"><label for="cm-body">Body</label><textarea id="cm-body" name="body" rows="9">${escapeHtml(item.body || '')}</textarea></div>
          <p class="form-status" id="cm-error" role="alert"></p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-close>Cancel</button>
          <button class="btn btn-gold" type="submit">${isEdit ? 'Save changes' : 'Create content'}</button>
        </div>
      </form>`;
    const form = overlay.querySelector('form');
    const titleInput = form.elements.title;
    const slugInput = form.elements.slug;
    let slugTouched = isEdit;
    slugInput.addEventListener('input', () => { slugTouched = true; });
    titleInput.addEventListener('input', () => { if (!slugTouched) slugInput.value = slugify(titleInput.value); });

    const close = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-close]').addEventListener('click', close);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = overlay.querySelector('#cm-error');
      error.textContent = '';
      const data = Object.fromEntries(new FormData(form).entries());
      data.slug = slugify(data.slug);
      if (!data.title.trim()) { error.textContent = 'Please enter a title.'; titleInput.focus(); return; }
      if (!data.slug) { error.textContent = 'Please enter a slug.'; slugInput.focus(); return; }
      const button = form.querySelector('[type="submit"]');
      setBusy(button, true);
      try {
        await save({ ...data, type: typeSelect.value });
        close();
        toast(isEdit ? 'Changes saved.' : 'Content created.', 'ok');
        refresh();
      } catch (err) {
        error.textContent = err.message;
        setBusy(button, false);
      }
    });

    document.body.appendChild(overlay);
    titleInput.focus();
  }

  function save(data) {
    return request('/api/cms', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async function setStatus(item, status, button) {
    setBusy(button, true);
    try {
      await save({ type: item.type || typeSelect.value, slug: item.slug, title: item.title, summary: item.summary || '', body: item.body || '', status });
      toast(status === 'published' ? 'Published.' : 'Archived.', 'ok');
      refresh();
    } catch (error) {
      toast(error.message, 'err');
      setBusy(button, false);
    }
  }

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const item = items.find((entry) => entry.slug === button.dataset.slug);
    if (!item) return;
    const act = button.dataset.act;

    if (act === 'edit') {
      setBusy(button, true);
      try {
        const payload = await request(`/api/cms?slug=${encodeURIComponent(item.slug)}`);
        openEditor(payload.item);
      } catch (error) { toast(error.message, 'err'); }
      setBusy(button, false);
    } else if (act === 'publish' || act === 'archive') {
      setStatus(item, act === 'publish' ? 'published' : 'archived', button);
    } else if (act === 'delete') {
      const ok = await confirmDialog({ title: 'Delete this content?', message: `"${item.title}" will be permanently removed. This cannot be undone.`, confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      setBusy(button, true);
      try {
        await request(`/api/cms?slug=${encodeURIComponent(item.slug)}`, { method: 'DELETE' });
        toast('Content deleted.', 'ok');
        refresh();
      } catch (error) { toast(error.message, 'err'); setBusy(button, false); }
    }
  });

  document.querySelectorAll('[data-type]').forEach((tab) => tab.addEventListener('click', () => {
    if (!TYPES.includes(tab.dataset.type)) return;
    typeSelect.value = tab.dataset.type;
    refresh();
  }));
  typeSelect.addEventListener('change', refresh);
  statusSelect.addEventListener('change', refresh);
  search.addEventListener('input', render);
  $('#cms-refresh').addEventListener('click', refresh);
  $('#cms-new').addEventListener('click', () => openEditor(null));

  refresh();
}
