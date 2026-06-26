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

const LANGUAGES = ['ru', 'lv', 'en'];
const MAIL_I18N = {
  ru: {
    catalog: '← Каталог',
    loginTitle: 'Вход в почту',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'Password',
    login: 'Войти',
    checking: 'Проверяем...',
    loading: 'Загрузка...',
    updating: 'Обновляем...',
    checkingMail: 'Проверяем почту...',
    refresh: 'Обновить',
    logout: 'Выйти',
    inbox: 'Входящие',
    emptyTitle: 'Писем пока нет.',
    emptyText: 'Если вы ожидаете код подтверждения, нажмите "Обновить" через несколько секунд.',
    noMessages: 'Нет писем',
    oneMessage: '1 письмо',
    manyMessages: count => `${count} писем`,
    updated: 'Письма обновлены',
    newMessage: 'Пришло новое письмо',
    connectionError: 'Ошибка соединения',
    invalidLogin: 'Неверный email или пароль.',
    loginSuccess: 'Успешный вход',
    loggedOut: 'Вы вышли',
    back: 'Назад к письмам',
    openError: 'Не удалось открыть письмо',
    codeTitle: 'Код подтверждения',
    copyCode: 'Копировать код',
    copiedCode: 'Код скопирован',
    copiedButton: 'Скопировано',
    noSubject: '(без темы)',
  },
  lv: {
    catalog: '← Katalogs',
    loginTitle: 'Pieteikšanās pastam',
    email: 'Email',
    password: 'Parole',
    passwordPlaceholder: 'Parole',
    login: 'Ieiet',
    checking: 'Pārbaudām...',
    loading: 'Ielādējas...',
    updating: 'Atjaunojam...',
    checkingMail: 'Pārbaudām pastu...',
    refresh: 'Atjaunot',
    logout: 'Iziet',
    inbox: 'Iesūtne',
    emptyTitle: 'Vēstuļu pagaidām nav.',
    emptyText: 'Ja gaidāt apstiprinājuma kodu, pēc dažām sekundēm nospiediet "Atjaunot".',
    noMessages: 'Nav vēstuļu',
    oneMessage: '1 vēstule',
    manyMessages: count => `${count} vēstules`,
    updated: 'Vēstules atjaunotas',
    newMessage: 'Saņemta jauna vēstule',
    connectionError: 'Savienojuma kļūda',
    invalidLogin: 'Nepareizs email vai parole.',
    loginSuccess: 'Pieteikšanās veiksmīga',
    loggedOut: 'Jūs izgājāt',
    back: 'Atpakaļ uz vēstulēm',
    openError: 'Neizdevās atvērt vēstuli',
    codeTitle: 'Apstiprinājuma kods',
    copyCode: 'Kopēt kodu',
    copiedCode: 'Kods nokopēts',
    copiedButton: 'Nokopēts',
    noSubject: '(bez temata)',
  },
  en: {
    catalog: '← Catalog',
    loginTitle: 'Mail sign in',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'Password',
    login: 'Sign in',
    checking: 'Checking...',
    loading: 'Loading...',
    updating: 'Refreshing...',
    checkingMail: 'Checking mail...',
    refresh: 'Refresh',
    logout: 'Logout',
    inbox: 'Inbox',
    emptyTitle: 'No emails yet.',
    emptyText: 'If you are waiting for a confirmation code, press "Refresh" in a few seconds.',
    noMessages: 'No emails',
    oneMessage: '1 email',
    manyMessages: count => `${count} emails`,
    updated: 'Emails refreshed',
    newMessage: 'New email received',
    connectionError: 'Connection error',
    invalidLogin: 'Incorrect email or password.',
    loginSuccess: 'Signed in',
    loggedOut: 'You are logged out',
    back: 'Back to emails',
    openError: 'Could not open email',
    codeTitle: 'Confirmation code',
    copyCode: 'Copy code',
    copiedCode: 'Code copied',
    copiedButton: 'Copied',
    noSubject: '(no subject)',
  },
};

let currentLang = resolveInitialLanguage();
let messages = [];
let activeMessageId = '';
let refreshTimer = null;
let toastTimer = null;

function resolveInitialLanguage() {
  const saved = localStorage.getItem('catalogLanguage');
  if (LANGUAGES.includes(saved)) return saved;
  const browserLang = String(navigator.language || '').slice(0, 2).toLowerCase();
  return LANGUAGES.includes(browserLang) ? browserLang : 'ru';
}

function t(key, ...args) {
  const value = (MAIL_I18N[currentLang] || MAIL_I18N.ru)[key] ?? MAIL_I18N.ru[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
}

function emptyStateHtml() {
  return `<div class="empty-state"><span>📭</span><strong>${escapeHtml(t('emptyTitle'))}</strong><p>${escapeHtml(t('emptyText'))}</p></div>`;
}

function messageCountLabel(count) {
  if (!count) return t('noMessages');
  if (count === 1) return t('oneMessage');
  return t('manyMessages', count);
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-mail-i18n]').forEach(node => {
    node.textContent = t(node.dataset.mailI18n);
  });
  document.querySelectorAll('[data-mail-placeholder]').forEach(node => {
    node.setAttribute('placeholder', t(node.dataset.mailPlaceholder));
  });
  refreshBtn.textContent = t('refresh');
  logoutBtn.textContent = t('logout');
  if (messages.length) renderList();
  else {
    messageList.innerHTML = emptyStateHtml();
    renderEmptyDetail();
  }
  setStatus(messageCountLabel(messages.length));
}

function setScreen(screen) {
  const mode = screen === 'inbox' ? 'inbox' : screen === 'login' ? 'login' : 'checking';
  document.body.dataset.mailScreen = mode;
  const isLogin = mode === 'login';
  const isInbox = mode === 'inbox';
  loginView.hidden = !isLogin;
  inboxView.hidden = !isInbox;
  loginView.setAttribute('aria-hidden', String(!isLogin));
  inboxView.setAttribute('aria-hidden', String(!isInbox));
  loginView.classList.toggle('screen-active', isLogin);
  inboxView.classList.toggle('screen-active', isInbox);
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(value) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toLocaleString(currentLang === 'en' ? 'en-GB' : currentLang === 'lv' ? 'lv-LV' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' });
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

function loginEmailValue() {
  const raw = document.getElementById('mail-email').value.trim().toLowerCase();
  const username = raw.replace(/@heysmart\.lv$/i, '').trim();
  return username ? `${username}@heysmart.lv` : '';
}

function showInbox(email) {
  setScreen('inbox');
  inboxView.classList.remove('detail-open');
  mailboxTitle.textContent = email;
  loginError.classList.remove('show');
  loginForm.reset();
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => loadMessages({ silent: true }), 12000);
}

function showLogin() {
  setScreen('login');
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
  setScreen('checking');
  setStatus(t('loading'), true);
  try {
    const data = await api('/api/mail/me');
    showInbox(data.account.email);
    await loadMessages({ statusText: t('loading') });
  } catch {
    showLogin();
  }
}

function renderList() {
  if (!messages.length) {
    messageList.innerHTML = emptyStateHtml();
    renderEmptyDetail();
    return;
  }
  messageList.innerHTML = `<div class="list-heading">${escapeHtml(t('inbox'))}</div>${messages.map(message => `
    <button class="message-item ${message.isRead ? '' : 'unread'} ${message._id === activeMessageId ? 'active' : ''}" type="button" data-id="${escapeHtml(message._id)}">
      <strong>${escapeHtml(message.subject || t('noSubject'))}</strong>
      <span>${escapeHtml(message.from || '')}</span>
      <time>${escapeHtml(formatDate(message.receivedAt))}</time>
    </button>
  `).join('')}`;
  if (!activeMessageId && window.matchMedia('(min-width: 781px)').matches) {
    openMessage(messages[0]._id, { silent: true });
  }
}

function renderEmptyDetail() {
  messageDetail.innerHTML = emptyStateHtml();
}

async function loadMessages(options = {}) {
  const previousIds = new Set(messages.map(message => message._id));
  if (!options.silent) setStatus(options.statusText || t('updating'), true);
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
    if (!options.silent) notify(t('updated'));
    if (options.silent && hasNew) notify(t('newMessage'));
    setStatus(messageCountLabel(messages.length));
  } catch (e) {
    setStatus(t('connectionError'));
    if (!options.silent) notify(t('connectionError'), 'error');
    messageList.innerHTML = `<div class="empty-state"><strong>${escapeHtml(t('connectionError'))}</strong><p>${escapeHtml(e.message)}</p></div>`;
  } finally {
    refreshBtn.disabled = false;
    mailStatus.classList.remove('loading');
  }
}

async function syncAndLoad() {
  setStatus(t('checkingMail'), true);
  refreshBtn.disabled = true;
  try {
    await api('/api/mail/sync', { method: 'POST', body: '{}' });
  } catch {
    // Polling may be disabled locally without IMAP secrets; still reload saved messages.
  }
  await loadMessages({ statusText: t('updating') });
}

async function openMessage(id, options = {}) {
  activeMessageId = id;
  inboxView.classList.add('detail-open');
  renderList();
  if (!options.silent) setStatus(t('loading'), true);
  messageDetail.innerHTML = `<button class="detail-back" type="button" data-back>${escapeHtml(t('back'))}</button><div class="empty-state"><strong>${escapeHtml(t('loading'))}</strong></div>`;
  try {
    const data = await api(`/api/mail/messages/${encodeURIComponent(id)}`);
    renderMessage(data.message);
    const cached = messages.find(message => message._id === id);
    if (cached) cached.isRead = true;
    setStatus(messageCountLabel(messages.length));
  } catch (e) {
    setStatus(t('connectionError'));
    messageDetail.innerHTML = `<button class="detail-back" type="button" data-back>${escapeHtml(t('back'))}</button><div class="empty-state"><strong>${escapeHtml(t('openError'))}</strong><p>${escapeHtml(e.message)}</p></div>`;
  }
}

function renderMessage(message) {
  const body = message.html || `<pre>${escapeHtml(message.text || '')}</pre>`;
  const code = message.verificationCode ? `
    <div class="code-card">
      <div><span>${escapeHtml(t('codeTitle'))}</span><strong>${escapeHtml(message.verificationCode)}</strong></div>
      <button type="button" data-copy-code="${escapeHtml(message.verificationCode)}">${escapeHtml(t('copyCode'))}</button>
    </div>` : '';
  messageDetail.innerHTML = `
    <button class="detail-back" type="button" data-back>${escapeHtml(t('back'))}</button>
    ${code}
    <div class="message-meta">
      <h2>${escapeHtml(message.subject || t('noSubject'))}</h2>
      <div><strong>From:</strong> ${escapeHtml(message.from || '')}</div>
      <div><strong>To:</strong> ${escapeHtml(message.to || '')}</div>
      <div>${escapeHtml(formatDate(message.receivedAt))}</div>
    </div>
    <div class="message-body">${body}</div>
  `;
  messageDetail.querySelectorAll('.message-body img').forEach(img => {
    img.addEventListener('error', () => img.classList.add('is-broken'), { once: true });
    if (img.complete && img.naturalWidth === 0) img.classList.add('is-broken');
  });
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.classList.remove('show');
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = t('checking');
  try {
    const data = await api('/api/mail/login', {
      method: 'POST',
      body: JSON.stringify({
        email: loginEmailValue(),
        password: document.getElementById('mail-password').value,
      }),
    });
    notify(t('loginSuccess'));
    showInbox(data.account.email);
    await loadMessages({ statusText: t('loading') });
  } catch (e) {
    showLoginError(e.message === 'Invalid credentials' ? t('invalidLogin') : t('connectionError'));
  } finally {
    btn.disabled = false;
    btn.textContent = t('login');
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
    notify(t('copiedCode'));
    button.textContent = t('copiedButton');
    window.setTimeout(() => { button.textContent = t('copyCode'); }, 1400);
  });
});

refreshBtn.addEventListener('click', syncAndLoad);
logoutBtn.addEventListener('click', async () => {
  await api('/api/mail/logout', { method: 'POST', body: '{}' }).catch(() => {});
  messages = [];
  activeMessageId = '';
  notify(t('loggedOut'));
  showLogin();
});

applyTranslations();
checkSession();
