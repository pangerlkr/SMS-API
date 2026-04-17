'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  token: null,
  user: null,
  apiKeys: [],
  simCards: []
};

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
function apiBase() {
  return window.location.origin;
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token && !headers['X-API-Key']) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  const res = await fetch(`${apiBase()}/api${path}`, {
    ...options,
    headers
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Auth persistence (sessionStorage so it survives refreshes in same tab)
// ---------------------------------------------------------------------------
function loadSession() {
  try {
    const raw = sessionStorage.getItem('smsapi_session');
    if (raw) {
      const s = JSON.parse(raw);
      state.token = s.token;
      state.user = s.user;
    }
  } catch {}
}

function saveSession() {
  sessionStorage.setItem('smsapi_session', JSON.stringify({ token: state.token, user: state.user }));
}

function clearSession() {
  state.token = null;
  state.user = null;
  sessionStorage.removeItem('smsapi_session');
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function $(sel, parent = document) { return parent.querySelector(sel); }
function $$(sel, parent = document) { return [...parent.querySelectorAll(sel)]; }

function showAlert(container, msg, type = 'error') {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type} show`;
}

function clearAlert(container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;
  el.className = 'alert';
  el.textContent = '';
}

function badge(value, map) {
  const cls = map[value] || 'badge-muted';
  return `<span class="badge ${cls}">${value}</span>`;
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

function formatDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

// ---------------------------------------------------------------------------
// View switching
// ---------------------------------------------------------------------------
function showAuth() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('user-info').classList.add('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('user-info').textContent = state.user ? state.user.name : '';
  loadSimCards();
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function initTabs() {
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('active'));
      $$('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// ---------------------------------------------------------------------------
// Auth forms
// ---------------------------------------------------------------------------
async function handleLogin(e) {
  e.preventDefault();
  clearAlert('login-alert');
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;

  const { ok, data } = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: form.email.value.trim(),
      password: form.password.value
    })
  });

  btn.disabled = false;
  if (!ok) {
    showAlert('login-alert', data.error || JSON.stringify(data));
    return;
  }

  state.token = data.token;
  state.user = data.user;
  saveSession();
  form.reset();
  showDashboard();
}

async function handleRegister(e) {
  e.preventDefault();
  clearAlert('register-alert');
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;

  const { ok, data } = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: form.reg_name.value.trim(),
      email: form.reg_email.value.trim(),
      password: form.reg_password.value
    })
  });

  btn.disabled = false;
  if (!ok) {
    showAlert('register-alert', data.error || (data.errors && data.errors.map((e) => e.msg).join(', ')) || JSON.stringify(data));
    return;
  }

  state.token = data.token;
  state.user = data.user;
  saveSession();
  form.reset();
  showDashboard();
}

// ---------------------------------------------------------------------------
// SIM Cards
// ---------------------------------------------------------------------------
async function loadSimCards() {
  const { ok, data } = await apiFetch('/sim');
  if (!ok) return;
  state.simCards = data.sim_cards || [];
  renderSimCards();
  populateSimSelects();
}

function renderSimCards() {
  const tbody = document.getElementById('sim-tbody');
  if (!tbody) return;
  if (state.simCards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-icon">📱</div>No SIM cards registered yet.</td></tr>`;
    return;
  }
  const statusMap = {
    '1': 'badge-success',
    '0': 'badge-warning'
  };
  tbody.innerHTML = state.simCards.map((s) => `
    <tr>
      <td><span class="key-value">${escapeHtml(s.phone_number)}</span></td>
      <td>${escapeHtml(s.label || '—')}</td>
      <td>${s.verified ? '<span class="badge badge-success">Verified</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
      <td>${s.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
      <td>${escapeHtml(formatDate(s.created_at))}</td>
      <td>
        <div class="flex-gap">
          ${!s.verified ? `<button class="btn-secondary btn-sm" data-action="verify" data-id="${escapeHtml(s.id)}">Verify</button>` : ''}
          ${!s.verified ? `<button class="btn-ghost btn-sm" data-action="resend-otp" data-id="${escapeHtml(s.id)}">Resend OTP</button>` : ''}
          <button class="btn-danger btn-sm" data-action="remove-sim" data-id="${escapeHtml(s.id)}">Remove</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function populateSimSelects() {
  const verified = state.simCards.filter((s) => s.verified && s.active);
  ['send-sim-id', 'webhook-sim-id'].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— auto-select —</option>' +
      verified.map((s) => `<option value="${s.id}">${s.phone_number}${s.label ? ` (${s.label})` : ''}</option>`).join('');
  });
}

async function handleAddSim(e) {
  e.preventDefault();
  clearAlert('sim-alert');
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;

  const body = { phone_number: form.sim_phone.value.trim() };
  if (form.sim_label.value.trim()) body.label = form.sim_label.value.trim();

  const { ok, data } = await apiFetch('/sim/register', { method: 'POST', body: JSON.stringify(body) });
  btn.disabled = false;

  if (!ok) {
    showAlert('sim-alert', data.error || (data.errors && data.errors.map((e) => e.msg).join(', ')) || JSON.stringify(data));
    return;
  }

  showAlert('sim-alert', `✓ ${data.message} SIM ID: ${data.sim_card_id} | OTP (dev): ${data.otp_for_testing}`, 'success');
  form.reset();
  await loadSimCards();
}

let verifySimId = null;
function openVerifyModal(simId) {
  verifySimId = simId;
  clearAlert('verify-alert');
  document.getElementById('verify-otp').value = '';
  document.getElementById('verify-modal').classList.add('show');
}

async function handleVerifySim(e) {
  e.preventDefault();
  clearAlert('verify-alert');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;

  const { ok, data } = await apiFetch('/sim/verify', {
    method: 'POST',
    body: JSON.stringify({ sim_card_id: verifySimId, otp: document.getElementById('verify-otp').value.trim() })
  });
  btn.disabled = false;

  if (!ok) {
    showAlert('verify-alert', data.error || JSON.stringify(data));
    return;
  }

  closeModal('verify-modal');
  await loadSimCards();
}

async function removeSim(id) {
  if (!confirm('Deactivate this SIM card?')) return;
  const { ok, data } = await apiFetch(`/sim/${id}`, { method: 'DELETE' });
  if (!ok) { alert(data.error || 'Error'); return; }
  await loadSimCards();
}

async function resendOtp(simId) {
  const { ok, data } = await apiFetch('/sim/resend', {
    method: 'POST',
    body: JSON.stringify({ sim_card_id: simId })
  });
  if (!ok) {
    showAlert('sim-alert', data.error || JSON.stringify(data));
    return;
  }
  showAlert('sim-alert', `✓ ${data.message} OTP (dev): ${data.otp_for_testing}`, 'success');
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------
async function loadApiKeys() {
  const { ok, data } = await apiFetch('/keys');
  if (!ok) return;
  state.apiKeys = data.api_keys || [];
  renderApiKeys();
}

function renderApiKeys() {
  const tbody = document.getElementById('keys-tbody');
  if (!tbody) return;
  if (state.apiKeys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="empty-icon">🔑</div>No API keys yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.apiKeys.map((k) => `
    <tr>
      <td>${escapeHtml(k.name)}</td>
      <td><span class="key-value">${escapeHtml(k.key_preview)}</span></td>
      <td>${k.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Revoked</span>'}</td>
      <td>${k.last_used_at ? escapeHtml(formatDate(k.last_used_at)) : '—'}</td>
      <td>${k.active ? `<button class="btn-danger btn-sm" data-action="revoke-key" data-id="${escapeHtml(k.id)}">Revoke</button>` : ''}</td>
    </tr>
  `).join('');
}

async function handleCreateKey(e) {
  e.preventDefault();
  clearAlert('keys-alert');
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;

  const { ok, data } = await apiFetch('/keys', {
    method: 'POST',
    body: JSON.stringify({ name: form.key_name.value.trim() })
  });
  btn.disabled = false;

  if (!ok) {
    showAlert('keys-alert', data.error || (data.errors && data.errors.map((e) => e.msg).join(', ')) || JSON.stringify(data));
    return;
  }

  document.getElementById('new-key-value').textContent = data.api_key.key_value;
  document.getElementById('new-key-name-display').textContent = data.api_key.name;
  document.getElementById('new-key-modal').classList.add('show');
  form.reset();
  await loadApiKeys();
}

async function revokeKey(id) {
  if (!confirm('Revoke this API key? It cannot be undone.')) return;
  const { ok, data } = await apiFetch(`/keys/${id}`, { method: 'DELETE' });
  if (!ok) { alert(data.error || 'Error'); return; }
  await loadApiKeys();
}

// ---------------------------------------------------------------------------
// Send SMS
// ---------------------------------------------------------------------------
async function handleSendSms(e) {
  e.preventDefault();
  clearAlert('sms-alert');
  const form = e.target;
  const apiKey = form.sms_api_key.value.trim();
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;

  const body = {
    to: form.sms_to.value.trim(),
    message: form.sms_message.value.trim()
  };
  const simId = form['send-sim-id'].value;
  if (simId) body.sim_card_id = simId;

  const { ok, data } = await apiFetch('/sms/send', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: JSON.stringify(body)
  });
  btn.disabled = false;

  if (!ok) {
    showAlert('sms-alert', data.error || (data.errors && data.errors.map((e) => e.msg).join(', ')) || JSON.stringify(data));
    return;
  }

  showAlert('sms-alert',
    `✓ ${data.message} | Log ID: ${data.log_id} | Status: ${data.status}`,
    'success'
  );
  form.reset();
  populateSimSelects();
}

// ---------------------------------------------------------------------------
// SMS Logs
// ---------------------------------------------------------------------------
let logsPage = 1;
const logsLimit = 20;

async function loadLogs(page = 1) {
  logsPage = page;
  const { ok, data } = await apiFetch(`/sms/logs?page=${page}&limit=${logsLimit}`);
  if (!ok) return;
  renderLogs(data.logs || [], data.page, data.limit);
}

const statusBadgeMap = {
  queued: 'badge-info',
  pending_device: 'badge-warning',
  dispatched: 'badge-info',
  sent: 'badge-success',
  delivered: 'badge-success',
  failed: 'badge-danger'
};

function renderLogs(logs, page, limit) {
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-icon">📋</div>No SMS logs yet.</td></tr>`;
  } else {
    tbody.innerHTML = logs.map((l) => `
      <tr>
        <td><span class="key-value" title="${escapeHtml(l.id)}">${escapeHtml(l.id.slice(0, 8))}…</span></td>
        <td>${escapeHtml(l.from_number || '—')}</td>
        <td>${escapeHtml(l.to_number)}</td>
        <td>${badge(l.status, statusBadgeMap)}</td>
        <td>${escapeHtml(formatDate(l.created_at))}</td>
        <td title="${escapeHtml(l.message)}">${escapeHtml(l.message.length > 50 ? l.message.slice(0, 50) + '…' : l.message)}</td>
      </tr>
    `).join('');
  }

  document.getElementById('logs-page-info').textContent = `Page ${page}`;
  document.getElementById('logs-prev').disabled = page <= 1;
  document.getElementById('logs-next').disabled = logs.length < limit;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
async function loadWebhooks() {
  const { ok, data } = await apiFetch('/webhooks');
  if (!ok) return;
  renderWebhooks(data.webhooks || []);
}

function renderWebhooks(webhooks) {
  const tbody = document.getElementById('webhooks-tbody');
  if (!tbody) return;
  if (webhooks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="empty-icon">🔗</div>No webhooks registered yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = webhooks.map((w) => `
    <tr>
      <td>${escapeHtml(w.phone_number || '—')}</td>
      <td>${escapeHtml(w.endpoint_url)}</td>
      <td>${w.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
      <td>${escapeHtml(formatDate(w.created_at))}</td>
      <td><button class="btn-danger btn-sm" data-action="delete-webhook" data-id="${escapeHtml(w.id)}">Delete</button></td>
    </tr>
  `).join('');
}

async function handleAddWebhook(e) {
  e.preventDefault();
  clearAlert('webhook-alert');
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;

  const body = {
    sim_card_id: form['webhook-sim-id'].value,
    endpoint_url: form.webhook_url.value.trim()
  };
  if (form.webhook_secret.value.trim()) body.secret = form.webhook_secret.value.trim();

  const { ok, data } = await apiFetch('/webhooks', { method: 'POST', body: JSON.stringify(body) });
  btn.disabled = false;

  if (!ok) {
    showAlert('webhook-alert', data.error || (data.errors && data.errors.map((e) => e.msg).join(', ')) || JSON.stringify(data));
    return;
  }

  showAlert('webhook-alert', `✓ ${data.message} | Secret: ${data.webhook.secret}`, 'success');
  form.reset();
  await loadWebhooks();
}

async function deleteWebhook(id) {
  if (!confirm('Delete this webhook?')) return;
  const { ok, data } = await apiFetch(`/webhooks/${id}`, { method: 'DELETE' });
  if (!ok) { alert(data.error || 'Error'); return; }
  await loadWebhooks();
}

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
function logout() {
  clearSession();
  showAuth();
}

// ---------------------------------------------------------------------------
// Tab data loading
// ---------------------------------------------------------------------------
function onTabChange(tab) {
  if (tab === 'keys') loadApiKeys();
  else if (tab === 'logs') loadLogs(1);
  else if (tab === 'webhooks') { loadWebhooks(); populateSimSelects(); }
  else if (tab === 'sim') loadSimCards();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadSession();

  if (state.token) {
    showDashboard();
  } else {
    showAuth();
  }

  // Auth forms
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Tabs
  initTabs();
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
  });

  // SIM forms
  document.getElementById('add-sim-form').addEventListener('submit', handleAddSim);
  document.getElementById('verify-form').addEventListener('submit', handleVerifySim);

  // API Keys
  document.getElementById('create-key-form').addEventListener('submit', handleCreateKey);

  // SMS Send
  document.getElementById('send-sms-form').addEventListener('submit', handleSendSms);

  // Logs pagination
  document.getElementById('logs-prev').addEventListener('click', () => loadLogs(logsPage - 1));
  document.getElementById('logs-next').addEventListener('click', () => loadLogs(logsPage + 1));
  document.getElementById('logs-refresh').addEventListener('click', () => loadLogs(logsPage));

  // SIM table actions (event delegation – avoids inline onclick / CSP violation)
  document.getElementById('sim-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'verify') openVerifyModal(id);
    else if (action === 'resend-otp') resendOtp(id);
    else if (action === 'remove-sim') removeSim(id);
  });

  // API Keys table actions (event delegation)
  document.getElementById('keys-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'revoke-key') revokeKey(btn.dataset.id);
  });

  // Webhooks table actions (event delegation)
  document.getElementById('webhooks-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'delete-webhook') deleteWebhook(btn.dataset.id);
  });

  // "API Keys" shortcut link in Send SMS tab
  const gotoKeysBtn = document.getElementById('goto-keys-btn');
  if (gotoKeysBtn) {
    gotoKeysBtn.addEventListener('click', () => {
      document.querySelector('[data-tab=keys]').click();
    });
  }

  // Webhooks
  document.getElementById('add-webhook-form').addEventListener('submit', handleAddWebhook);

  // Copy new key
  document.getElementById('copy-new-key-btn').addEventListener('click', (e) => {
    copyToClipboard(document.getElementById('new-key-value').textContent, e.target);
  });

  // Modal close buttons
  $$('.modal-close, [data-dismiss]').forEach((el) => {
    el.addEventListener('click', () => {
      const modal = el.closest('.modal-overlay');
      if (modal) modal.classList.remove('show');
    });
  });

  // Close modal on overlay click
  $$('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });
});
