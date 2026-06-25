const loginView = document.getElementById('login-view');
const inboxView = document.getElementById('inbox-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const mailboxTitle = document.getElementById('mailbox-title');
const messageList = document.getElementById('message-list');
const messageDetail = document.getElementById('message-detail');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');

let messages = [];
let activeMessageId = '';
let refreshTimer = null;

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(value) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.add('show');
}

function showInbox(email) {
  loginView.hidden = true;
  inboxView.hidden = false;
  mailboxTitle.textContent = email;
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(loadMessages, 12000);
}

function showLogin() {
  loginView.hidden = false;
  inboxView.hidden = true;
  window.clearInterval(refreshTimer);
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
  try {
    const data = await api('/api/mail/me');
    showInbox(data.account.email);
    await loadMessages();
  } catch {
    showLogin();
  }
}

function renderList() {
  if (!messages.length) {
    messageList.innerHTML = '<div class="empty-state">Писем пока нет. Если Яндекс отправил код, нажмите Обновить через несколько секунд.</div>';
    renderEmptyDetail();
    return;
  }
  messageList.innerHTML = messages.map(message => `
    <button class="message-item ${message.isRead ? '' : 'unread'} ${message._id === activeMessageId ? 'active' : ''}" type="button" data-id="${escapeHtml(message._id)}">
      <strong>${escapeHtml(message.subject || '(no subject)')}</strong>
      <span>${escapeHtml(message.from || '')}</span>
      <time>${escapeHtml(formatDate(message.receivedAt))}</time>
    </button>
  `).join('');
  if (!activeMessageId) openMessage(messages[0]._id);
}

function renderEmptyDetail() {
  messageDetail.innerHTML = '<div class="empty-state">Писем пока нет. Если Яндекс отправил код, нажмите Обновить через несколько секунд.</div>';
}

async function loadMessages() {
  refreshBtn.disabled = true;
  try {
    const data = await api('/api/mail/messages');
    messages = data.messages || [];
    if (activeMessageId && !messages.some(message => message._id === activeMessageId)) activeMessageId = '';
    renderList();
  } catch (e) {
    messageList.innerHTML = `<div class="empty-state">Не удалось загрузить письма: ${escapeHtml(e.message)}</div>`;
  } finally {
    refreshBtn.disabled = false;
  }
}

async function syncAndLoad() {
  refreshBtn.disabled = true;
  try {
    await api('/api/mail/sync', { method: 'POST', body: '{}' });
  } catch {
    // Polling may be disabled locally without IMAP secrets; still reload saved messages.
  }
  await loadMessages();
}

async function openMessage(id) {
  activeMessageId = id;
  renderList();
  messageDetail.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const data = await api(`/api/mail/messages/${encodeURIComponent(id)}`);
    renderMessage(data.message);
    const cached = messages.find(message => message._id === id);
    if (cached) cached.isRead = true;
  } catch (e) {
    messageDetail.innerHTML = `<div class="empty-state">Не удалось открыть письмо: ${escapeHtml(e.message)}</div>`;
  }
}

function renderMessage(message) {
  const body = message.html || `<pre>${escapeHtml(message.text || '')}</pre>`;
  const code = message.verificationCode ? `
    <div class="code-card">
      <div><span>Код подтверждения</span><strong>${escapeHtml(message.verificationCode)}</strong></div>
      <button type="button" data-copy-code="${escapeHtml(message.verificationCode)}">Скопировать код</button>
    </div>` : '';
  messageDetail.innerHTML = `
    <div class="message-meta">
      <h2>${escapeHtml(message.subject || '(no subject)')}</h2>
      <div><strong>From:</strong> ${escapeHtml(message.from || '')}</div>
      <div><strong>To:</strong> ${escapeHtml(message.to || '')}</div>
      <div>${escapeHtml(formatDate(message.receivedAt))}</div>
    </div>
    ${code}
    <div class="message-body">${body}</div>
  `;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.classList.remove('show');
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  try {
    const data = await api('/api/mail/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('mail-email').value.trim(),
        password: document.getElementById('mail-password').value,
      }),
    });
    showInbox(data.account.email);
    await loadMessages();
  } catch (e) {
    showLoginError(e.message === 'Invalid credentials' ? 'Неверный email или пароль' : e.message);
  } finally {
    btn.disabled = false;
  }
});

messageList.addEventListener('click', event => {
  const item = event.target.closest('[data-id]');
  if (item) openMessage(item.dataset.id);
});

messageDetail.addEventListener('click', event => {
  const button = event.target.closest('[data-copy-code]');
  if (!button) return;
  navigator.clipboard.writeText(button.dataset.copyCode).then(() => {
    button.textContent = 'Скопировано';
    window.setTimeout(() => { button.textContent = 'Скопировать код'; }, 1400);
  });
});

refreshBtn.addEventListener('click', syncAndLoad);
logoutBtn.addEventListener('click', async () => {
  await api('/api/mail/logout', { method: 'POST', body: '{}' }).catch(() => {});
  messages = [];
  activeMessageId = '';
  showLogin();
});

checkSession();
