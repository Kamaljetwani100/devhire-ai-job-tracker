/* =============================================
   DevHire AI — script.js
   Frontend-only, LocalStorage persistence
   ============================================= */

'use strict';

/* ========== CONSTANTS ========== */
const API_BASE = 'http://localhost:5000/api';
const STORAGE_TOKEN = 'devhire_token';
const STORAGE_USER  = 'devhire_user';

const STATUS_ORDER = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];
const STATUS_COLORS = {
  Applied: '#38bdf8',
  Screening: '#fbbf24',
  Interview: '#c084fc',
  Offer: '#22d3a0',
  Rejected: '#f87171',
  Withdrawn: '#6b7280',
};

function getToken() {
  return localStorage.getItem(STORAGE_TOKEN);
}

async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await res.json();

  return {
    ok: res.ok,
    status: res.status,
    data
  };
}






/* ========== STATE ========== */
let currentUser = null;
let jobs = [];
let editingJobId = null;

/* ========== STORAGE HELPERS ========== */
const getUsers = () => JSON.parse(localStorage.getItem(STORAGE_USERS) || '{}');
const saveUsers = (u) => localStorage.setItem(STORAGE_USERS, JSON.stringify(u));
const getJobsKey = (email) => STORAGE_JOBS_PREFIX + email;

async function loadJobs() {
  if (!currentUser) return;
  try {
    const { ok, status, data } = await apiFetch('/applications');
    if (status === 401) { handleExpiredSession(); return; }
    if (!ok) { showToast(data.message || 'Failed to load applications.', 'error'); return; }
    // Backend returns { data: [...] }
    jobs = data.data || [];
  } catch {
    showToast('Cannot reach the server.', 'error');
    jobs = [];
  }
}

function saveJobs() {}

/* ========== DOM HELPERS ========== */
const $ = (id) => document.getElementById(id);
const show = (el) => { if (typeof el === 'string') el = $(el); el && el.classList.remove('hidden'); };
const hide = (el) => { if (typeof el === 'string') el = $(el); el && el.classList.add('hidden'); };
const val = (id) => $(id) ? $(id).value.trim() : '';
const setVal = (id, v) => { if ($(id)) $(id).value = v; };
const setText = (id, t) => { if ($(id)) $(id).textContent = t; };
const clearErr = (...ids) => ids.forEach(id => setText(id, ''));
const setErr = (id, msg) => setText(id, msg);

/* ========== TOAST ========== */
function initToast() {
  if ($('toast-container')) return;
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container';
  document.body.appendChild(c);
}

function showToast(message, type = 'success') {
  const icons = { success: '✓', error: '✕' };
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || '●'}</span><span>${message}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 320); }, 2800);
}

/* ========== MODAL SYSTEM ========== */
function openModal(id) {
  const m = $(id);
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  const firstInput = m.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 80);
}

function closeModal(id) {
  const m = $(id);
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => {
    m.classList.remove('open');
  });
  document.body.style.overflow = '';
}

/* ========== AUTH ========== */
async function register(name, email, password) {
  try {
    const { ok, data } = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (!ok) return { ok: false, error: data.message || 'Signup failed.' };
    return { ok: true, user: data.user, token: data.token };
  } catch {
    return { ok: false, error: 'Cannot reach the server. Check your connection.' };
  }
}

async function login(email, password) {
  try {
    const { ok, data } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!ok) return { ok: false, error: data.message || 'Login failed.' };
    return { ok: true, user: data.user, token: data.token };
  } catch {
    return { ok: false, error: 'Cannot reach the server. Check your connection.' };
  }
}

function setSession(user) {
  currentUser = user;
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_USER);
  // Legacy keys from the original script — clear these too
  localStorage.removeItem('devhire_current_user');
}

function checkSession() {
  const token = localStorage.getItem(STORAGE_TOKEN);
  const user  = localStorage.getItem(STORAGE_USER);
  if (token && user) {
    try { currentUser = JSON.parse(user); return true; }
    catch { return false; }
  }
  return false;
}

/* ========== LOGIN FORM ========== */
async function handleLogin() {
  const email    = val('login-email');
  const password = val('login-password');
  clearErr('login-email-err', 'login-pass-err', 'login-global-err');

  let valid = true;
  if (!email)                                          { setErr('login-email-err', 'Email is required.');   valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('login-email-err', 'Enter a valid email.'); valid = false; }
  if (!password)                                       { setErr('login-pass-err', 'Password is required.'); valid = false; }
  if (!valid) return;

  const btn = $('login-submit-btn');
  btn.textContent = 'Logging in…';
  btn.disabled = true;

  const result = await login(email, password);

  btn.textContent = 'Log in';
  btn.disabled = false;

  if (!result.ok) { setErr('login-global-err', result.error); return; }

  localStorage.setItem(STORAGE_TOKEN, result.token);
  localStorage.setItem(STORAGE_USER,  JSON.stringify(result.user));
  setSession(result.user);
  closeAllModals();
  await initDashboard();
}

/* ========== SIGNUP FORM ========== */
async function handleSignup() {
  const name     = val('signup-name');
  const email    = val('signup-email');
  const password = val('signup-password');
  clearErr('signup-name-err', 'signup-email-err', 'signup-pass-err', 'signup-global-err');

  let valid = true;
  if (!name)                                          { setErr('signup-name-err', 'Full name is required.');      valid = false; }
  if (!email)                                         { setErr('signup-email-err', 'Email is required.');         valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setErr('signup-email-err', 'Enter a valid email.');       valid = false; }
  if (!password)                                      { setErr('signup-pass-err', 'Password is required.');       valid = false; }
  else if (password.length < 6)                       { setErr('signup-pass-err', 'Minimum 6 characters.');       valid = false; }
  if (!valid) return;

  const btn = $('signup-submit-btn');
  btn.textContent = 'Creating account…';
  btn.disabled = true;

  const result = await register(name, email, password);

  btn.textContent = 'Create account';
  btn.disabled = false;

  if (!result.ok) { setErr('signup-global-err', result.error); return; }

  localStorage.setItem(STORAGE_TOKEN, result.token);
  localStorage.setItem(STORAGE_USER,  JSON.stringify(result.user));
  setSession(result.user);
  closeAllModals();
  await initDashboard();
  showToast('Welcome to DevHire AI! 🎉');
}

/* ========== DASHBOARD INIT ========== */
async function initDashboard() {
  await loadJobs();
  hide('landing-page');
  show('dashboard-page');

  const initials = (currentUser.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  setText('sidebar-avatar', initials);
  setText('sidebar-name',  currentUser.name  || 'User');
  setText('sidebar-email', currentUser.email || '');

  renderAll();
}

/* ========== STATS ========== */
function computeStats() {
  const total = jobs.length;
  const interview = jobs.filter(j => j.status === 'Interview').length;
  const offer = jobs.filter(j => j.status === 'Offer').length;
  const rejected = jobs.filter(j => j.status === 'Rejected').length;
  const responded = jobs.filter(j => ['Interview', 'Offer', 'Rejected', 'Screening'].includes(j.status)).length;
  const rate = total > 0 ? Math.round((responded / total) * 100) : 0;

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCount = jobs.filter(j => j.createdAt && j.createdAt > oneWeekAgo).length;

  return { total, interview, offer, rejected, rate, weekCount };
}

function renderStats() {
  const s = computeStats();
  setText('stat-total', s.total);
  setText('stat-interview', s.interview);
  setText('stat-offer', s.offer);
  setText('stat-rejected', s.rejected);
  setText('stat-rate', s.rate + '%');
  setText('stat-week', s.weekCount);
}

/* ========== PIPELINE ========== */
function renderPipeline() {
  const track = $('pipeline-track');
  if (!track) return;
  const counts = {};
  STATUS_ORDER.forEach(s => counts[s] = 0);
  jobs.forEach(j => { if (counts[j.status] !== undefined) counts[j.status]++; });
  const max = Math.max(...Object.values(counts), 1);

  track.innerHTML = STATUS_ORDER.map(status => {
    const count = counts[status];
    const pct = Math.round((count / max) * 100);
    return `
      <div class="pipe-step pipe-${status}">
        <div class="pipe-step-label">${status}</div>
        <div class="pipe-step-count">${count}</div>
        <div class="pipe-step-bar">
          <div class="pipe-step-fill" style="width:${pct}%; background:${STATUS_COLORS[status]}"></div>
        </div>
      </div>`;
  }).join('');
}

/* ========== TABLE ========== */
function getFilteredJobs() {
  const search = val('search-input').toLowerCase();
  const statusFilter = val('filter-status');
  const sort = val('filter-sort');

  let filtered = jobs.filter(j => {
    const matchSearch = !search ||
      (j.company || '').toLowerCase().includes(search) ||
      (j.role || '').toLowerCase().includes(search) ||
      (j.location || '').toLowerCase().includes(search) ||
      (j.notes || '').toLowerCase().includes(search);
    const matchStatus = !statusFilter || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (sort === 'date-asc') filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  else if (sort === 'date-desc') filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  else if (sort === 'company') filtered.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
  else filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return filtered;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return dateStr; }
}

function renderTable() {
  const tbody = $('app-table-body');
  const emptyState = $('empty-state');
  if (!tbody) return;

  const filtered = getFilteredJobs();

  if (jobs.length === 0) {
    tbody.innerHTML = '';
    show(emptyState);
    hide($('app-table').querySelector('thead'));
    return;
  }

  hide(emptyState);
  show($('app-table').querySelector('thead'));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:40px;">No applications match your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(j => `
    <tr data-id="${j._id}">
      <td class="col-company">${escHtml(j.company)}</td>
      <td class="col-role">${escHtml(j.role)}</td>
      <td><span class="badge badge-${j.status}">${j.status}</span></td>
      <td class="col-date">${formatDate(j.dateApplied)}</td>
      <td class="col-location">${escHtml(j.location || '—')}</td>
      <td class="col-salary">${escHtml(j.salary || '—')}</td>
      <td class="col-actions">
        <div class="table-actions">
          ${j.url ? `<a href="${escAttr(j.url)}" target="_blank" rel="noopener" class="btn btn-icon" title="Open job URL">↗</a>` : ''}
          <button class="btn btn-icon edit-btn" data-id="${j._id}" title="Edit">✎</button>
          <button class="btn btn-icon btn-danger delete-btn" data-id="${j._id}" title="Delete">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAll() {
  renderStats();
  renderPipeline();
  renderTable();
}

/* ========== SECURITY HELPERS ========== */
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(str) {
  return String(str || '').replace(/"/g,'&quot;');
}

/* ========== JOB CRUD ========== */
function openAddJobModal() {
  editingJobId = null;
  setText('job-modal-title', 'Add Application');
  setText('job-submit-btn', 'Save Application');
  // Clear fields
  ['job-company','job-role','job-salary','job-location','job-url','job-notes'].forEach(id => setVal(id, ''));
  setVal('job-status', 'Applied');
  setVal('job-date', new Date().toISOString().slice(0, 10));
  openModal('job-modal');
}

function openEditJobModal(id) {
  const j = jobs.find(j => j._id === id);
  if (!j) return;
  editingJobId = id;
  setText('job-modal-title', 'Edit Application');
  setText('job-submit-btn', 'Update Application');
  setVal('job-company', j.company || '');
  setVal('job-role', j.role || '');
  setVal('job-status', j.status || 'Applied');
  setVal('job-date', j.dateApplied || '');
  setVal('job-salary', j.salary || '');
  setVal('job-location', j.location || '');
  setVal('job-url', j.url || '');
  setVal('job-notes', j.notes || '');
  openModal('job-modal');
}

async function handleJobSubmit() {
  const company = val('job-company');
  const role    = val('job-role');
  clearErr('job-company-err', 'job-role-err');

  let valid = true;
  if (!company) { setErr('job-company-err', 'Company name is required.'); valid = false; }
  if (!role)    { setErr('job-role-err', 'Role is required.');            valid = false; }
  if (!valid) return;

  const payload = {
    company,
    role,
    status:      val('job-status') || 'Applied',
    dateApplied: val('job-date')   || new Date().toISOString().slice(0, 10),
    salary:      val('job-salary'),
    location:    val('job-location'),
    url:         val('job-url'),
    notes:       val('job-notes'),
  };

  const btn = $('job-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  let result;
  if (editingJobId) {
    result = await apiFetch(`/applications/${editingJobId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    result = await apiFetch('/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  btn.disabled = false;
  btn.textContent = editingJobId ? 'Update Application' : 'Save Application';

  if (result.status === 401) { handleExpiredSession(); return; }

  if (!result.ok) {
    showToast(result.data.message || 'Failed to save application.', 'error');
    return;
  }

  const saved = result.data.data;

  if (editingJobId) {
    jobs = jobs.map(j => j._id === editingJobId ? saved : j);
    showToast('Application updated.');
  } else {
    jobs.unshift(saved);
    showToast('Application added!');
  }

  editingJobId = null;
  closeModal('job-modal');
  renderAll();
}

async function deleteJob(id) {
  if (!confirm('Delete this application? This cannot be undone.')) return;

  const { ok, status, data } = await apiFetch(`/applications/${id}`, { method: 'DELETE' });

  if (status === 401) { handleExpiredSession(); return; }
  if (!ok) { showToast(data.message || 'Failed to delete application.', 'error'); return; }

  jobs = jobs.filter(j => j._id !== id);
  renderAll();
  showToast('Application removed.', 'error');
}

/* ========== SIDEBAR MOBILE ========== */
function initSidebarMobile() {
  // Create overlay
  let overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  const sidebar = document.querySelector('.sidebar');

  $('mobile-menu-btn').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}

/* ========== INIT ========== */
function init() {
  initToast();

  /* Check session */
  if (checkSession()) {
    initDashboard();
  }

  /* LANDING */
  $('nav-login-btn')?.addEventListener('click', () => openModal('login-modal'));
  $('nav-signup-btn')?.addEventListener('click', () => openModal('signup-modal'));
  $('hero-login-btn')?.addEventListener('click', () => openModal('login-modal'));
  $('hero-signup-btn')?.addEventListener('click', () => openModal('signup-modal'));

  /* MODAL close buttons */
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  /* Close modal on overlay click */
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  /* ESC key */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  /* AUTH switches */
  $('switch-to-signup')?.addEventListener('click', () => { closeModal('login-modal'); openModal('signup-modal'); });
  $('switch-to-login')?.addEventListener('click', () => { closeModal('signup-modal'); openModal('login-modal'); });

  /* AUTH submits */
  $('login-submit-btn')?.addEventListener('click', handleLogin);
  $('signup-submit-btn')?.addEventListener('click', handleSignup);

  /* Enter key on modal inputs */
  $('login-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  $('signup-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSignup(); });

  /* LOGOUT */
  $('logout-btn')?.addEventListener('click', () => {
    clearSession();
    jobs = [];
    hide('dashboard-page');
    show('landing-page');
    showToast('Logged out successfully.');
  });

  /* ADD JOB */
  $('add-job-btn')?.addEventListener('click', openAddJobModal);
  $('empty-add-btn')?.addEventListener('click', openAddJobModal);
  $('job-submit-btn')?.addEventListener('click', handleJobSubmit);

  /* TABLE: edit & delete (event delegation) */
  $('app-table-body')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');
    if (editBtn) openEditJobModal(editBtn.dataset.id);
    if (deleteBtn) deleteJob(deleteBtn.dataset.id);
  });

  /* SEARCH */
  $('search-input')?.addEventListener('input', renderTable);

  /* FILTERS */
  $('filter-status')?.addEventListener('change', renderTable);
  $('filter-sort')?.addEventListener('change', renderTable);

  /* SIDEBAR MOBILE */
  if ($('mobile-menu-btn')) initSidebarMobile();

  /* SIDEBAR NAV (single-page) */
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      // Close mobile sidebar
      document.querySelector('.sidebar')?.classList.remove('open');
      document.querySelector('.sidebar-overlay')?.classList.remove('visible');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
