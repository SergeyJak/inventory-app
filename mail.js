const loginView = document.getElementById('login-view');
const inboxView = document.getElementById('inbox-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const mailboxTitle = document.getElementById('mailbox-title');
const mailStatus = document.getElementById('mail-status');
const messageList = document.getElementById('message-list');
const messageDetail = document.getElementById('message-detail');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');

const EMPTY_STATE = '<div class="empty-state"><span>📭</span><strong>Писем пока нет.</strong><p>Если вы ожидаете код подтверждения,<br>нажмите "Обновить" через несколько секунд.</p></div>';
let messages = [];
let activeMessageId = '';
let refreshTimer = null;
let toastTimer = null;

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(value) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function notify(message, type = 'success') {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  toastTimer = window.setTimeout(() => { toast.className = 'toast'; }, 2600);
}

function setStatus(message, loading = false) {
  mailStatus.textContent = message || '';
  mailStatus.classList.toggle('loading', Boolean(loading));
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.add('show');
  notify(message, 'error');
}

function showInbox(email) {
  loginView.hidden = true;
  inboxView.hidden = false;
  inboxView.classList.remove('detail-open');
  mailboxTitle.textContent = email;
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => loadMessages({ silent: true }), 12000);
}

function showLogin() {
  loginView.hidden = false;
  inboxView.hidden = true;
  inboxView.classList.remove('detail-open');
  window.clearInterval(refreshTimer);
  setStatus('');
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

async function checkSession() {
  setStatus('Загрузка...', true);
  try {
    const data = await api('/api/mail/me');
    showInbox(data.account.email);
    await loadMessages({ statusText: 'Загрузка...' });
  } catch {
    showLogin();
  }
}

function renderList() {
  if (!messages.length) {
    messageList.innerHTML = EMPTY_STATE;
    renderEmptyDetail();
    return;
  }
  messageList.innerHTML = `<div class="list-heading">Входящие</div>${messages.map(message => `
    <button class="message-item ${message.isRead ? '' : 'unread'} ${message._id === activeMessageId ? 'active' : ''}" type="button" data-id="${escapeHtml(message._id)}">
      <strong>${escapeHtml(message.subject || '(no subject)')}</strong>
      <span>${escapeHtml(message.from || '')}</span>
      <time>${escapeHtml(formatDate(message.receivedAt))}</time>
    </button>
  `).join('')}`;
  if (!activeMessageId && window.matchMedia('(min-width: 781px)').matches) {
    openMessage(messages[0]._id, { silent: true });
  }
}

function renderEmptyDetail() {
  messageDetail.innerHTML = EMPTY_STATE;
}

async function loadMessages(options = {}) {
  const previousIds = new Set(messages.map(message => message._id));
  if (!options.silent) setStatus(options.statusText || 'Обновляем...', true);
  refreshBtn.disabled = true;
  try {
    const data = await api('/api/mail/messages');
    messages = data.messages || [];
    const hasNew = messages.some(message => !previousIds.has(message._id));
    if (activeMessageId && !messages.some(message => message._id === activeMessageId)) {
      activeMessageId = '';
      inboxView.classList.remove('detail-open');
      renderEmptyDetail();
    }
    renderList();
    if (!options.silent) notify('Письма обновлены');
    if (options.silent && hasNew) notify('Пришло новое письмо');
    setStatus(messages.length ? `${messages.length} писем` : 'Нет писем');
  } catch (e) {
    setStatus('Ошибка соединения');
    if (!options.silent) notify('Ошибка соединения', 'error');
    messageList.innerHTML = `<div class="empty-state"><strong>Ошибка соединения</strong><p>${escapeHtml(e.message)}</p></div>`;
  } finally {
    refreshBtn.disabled = false;
    mailStatus.classList.remove('loading');
  }
}

async function syncAndLoad() {
  setStatus('Проверяем почту...', true);
  refreshBtn.disabled = true;
  try {
    await api('/api/mail/sync', { method: 'POST', body: '{}' });
  } catch {
    // Polling may be disabled locally without IMAP secrets; still reload saved messages.
  }
  await loadMessages({ statusText: 'Обновляем...' });
}

async function openMessage(id, options = {}) {
  activeMessageId = id;
  inboxView.classList.add('detail-open');
  renderList();
  if (!options.silent) setStatus('Загрузка...', true);
  messageDetail.innerHTML = '<button class="detail-back" type="button" data-back>Назад</button><div class="empty-state"><strong>Загрузка...</strong></div>';
  try {
    const data = await api(`/api/mail/messages/${encodeURIComponent(id)}`);
    renderMessage(data.message);
    const cached = messages.find(message => message._id === id);
    if (cached) cached.isRead = true;
    setStatus(messages.length ? `${messages.length} писем` : 'Нет писем');
  } catch (e) {
    setStatus('Ошибка соединения');
    messageDetail.innerHTML = `<button class="detail-back" type="button" data-back>Назад</button><div class="empty-state"><strong>Не удалось открыть письмо</strong><p>${escapeHtml(e.message)}</p></div>`;
  }
}

function renderMessage(message) {
  const body = message.html || `<pre>${escapeHtml(message.text || '')}</pre>`;
  const code = message.verificationCode ? `
    <div class="code-card">
      <div><span>Код подтверждения</span><strong>${escapeHtml(message.verificationCode)}</strong></div>
      <button type="button" data-copy-code="${escapeHtml(message.verificationCode)}">Копировать код</button>
    </div>` : '';
  messageDetail.innerHTML = `
    <button class="detail-back" type="button" data-back>Назад</button>
    ${code}
    <div class="message-meta">
      <h2>${escapeHtml(message.subject || '(no subject)')}</h2>
      <div><strong>From:</strong> ${escapeHtml(message.from || '')}</div>
      <div><strong>To:</strong> ${escapeHtml(message.to || '')}</div>
      <div>${escapeHtml(formatDate(message.receivedAt))}</div>
    </div>
    <div class="message-body">${body}</div>
  `;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.classList.remove('show');
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Проверяем...';
  try {
    const data = await api('/api/mail/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('mail-email').value.trim(),
        password: document.getElementById('mail-password').value,
      }),
    });
    notify('Успешный вход');
    showInbox(data.account.email);
    await loadMessages({ statusText: 'Загрузка...' });
  } catch (e) {
    showLoginError(e.message === 'Invalid credentials' ? 'Неверный email или пароль.' : 'Ошибка соединения');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Войти';
  }
});

messageList.addEventListener('click', event => {
  const item = event.target.closest('[data-id]');
  if (item) openMessage(item.dataset.id);
});

messageDetail.addEventListener('click', event => {
  const back = event.target.closest('[data-back]');
  if (back) {
    inboxView.classList.remove('detail-open');
    return;
  }
  const button = event.target.closest('[data-copy-code]');
  if (!button) return;
  navigator.clipboard.writeText(button.dataset.copyCode).then(() => {
    notify('Код скопирован');
    button.textContent = 'Скопировано';
    window.setTimeout(() => { button.textContent = 'Копировать код'; }, 1400);
  });
});

refreshBtn.addEventListener('click', syncAndLoad);
logoutBtn.addEventListener('click', async () => {
  await api('/api/mail/logout', { method: 'POST', body: '{}' }).catch(() => {});
  messages = [];
  activeMessageId = '';
  notify('Вы вышли');
  showLogin();
});

checkSession();
