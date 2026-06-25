const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { ObjectId } = require('mongodb');

const MAIL_DOMAIN = 'heysmart.lv';
const MAIL_COOKIE = 'hs_mail_token';
const MAIL_TOKEN_PURPOSE = 'mailbox';
const DEFAULT_MAIL_POLL_MS = 12000;
const DEFAULT_MAIL_TTL_SECONDS = 30 * 24 * 60 * 60;
const loginAttempts = new Map();

function normalizeMailEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@heysmart\.lv$/.test(email)) return '';
  return email;
}

function headerValues(parsed, name) {
  const headers = parsed?.headers;
  if (!headers || typeof headers.get !== 'function') return [];
  const value = headers.get(String(name).toLowerCase());
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function emailsFromValue(value) {
  if (!value) return [];
  if (typeof value === 'object' && Array.isArray(value.value)) {
    return value.value.map(item => item.address).filter(Boolean);
  }
  const text = typeof value === 'string' ? value : String(value.text || value.html || value.address || '');
  return [...text.matchAll(/[a-z0-9._%+-]+@heysmart\.lv/gi)].map(match => match[0]);
}

function findOriginalRecipient(parsed) {
  const headerNames = [
    'x-original-to',
    'delivered-to',
    'envelope-to',
    'x-envelope-to',
    'apparently-to',
  ];
  for (const name of headerNames) {
    for (const value of headerValues(parsed, name)) {
      const match = emailsFromValue(value).map(normalizeMailEmail).find(Boolean);
      if (match) return match;
    }
  }
  const addressFields = [parsed?.to, parsed?.cc, parsed?.bcc];
  for (const field of addressFields) {
    const match = emailsFromValue(field).map(normalizeMailEmail).find(Boolean);
    if (match) return match;
  }
  return '';
}

function sanitizeMailHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img'],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  }).trim();
}

function extractVerificationCode(value) {
  const text = String(value || '').replace(/\s+/g, ' ');
  const codeContext = text.match(/(?:код|code|verification|confirm|подтвержд)[^\d]{0,30}(\d[\d\s-]{3,10}\d)/i);
  const raw = codeContext ? codeContext[1] : (text.match(/\b\d{4,8}\b/) || [])[0];
  const code = String(raw || '').replace(/\D/g, '');
  return code.length >= 4 && code.length <= 8 ? code : '';
}

function mapParsedMessage(parsed, options) {
  const text = String(parsed?.text || '').trim();
  const html = sanitizeMailHtml(parsed?.html || '');
  const receivedAt = parsed?.date instanceof Date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : new Date();
  const messageId = String(parsed?.messageId || options.fallbackMessageId || crypto.randomUUID());
  return {
    accountId: options.accountId,
    email: normalizeMailEmail(options.email),
    messageId,
    from: String(parsed?.from?.text || ''),
    to: String(parsed?.to?.text || options.email || ''),
    subject: String(parsed?.subject || '').slice(0, 500),
    text,
    html,
    verificationCode: extractVerificationCode(`${parsed?.subject || ''} ${text}`),
    receivedAt,
    isRead: false,
    createdAt: new Date(),
  };
}

function publicAccount(account) {
  return {
    _id: String(account._id),
    email: account.email,
    active: account.active !== false,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastLoginAt: account.lastLoginAt || null,
  };
}

function publicMessage(message) {
  return {
    _id: String(message._id),
    email: message.email,
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    verificationCode: message.verificationCode || extractVerificationCode(`${message.subject || ''} ${message.text || ''}`),
    receivedAt: message.receivedAt,
    isRead: Boolean(message.isRead),
    createdAt: message.createdAt,
  };
}

function generateMailboxPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '');
  const found = raw.split(';').map(part => part.trim()).find(part => part.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}

function mailCookieOptions(req) {
  const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function rateKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function mailLoginAllowed(req) {
  const key = rateKey(req);
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter(time => now - time < 10 * 60 * 1000);
  if (recent.length >= 8) {
    loginAttempts.set(key, recent);
    return false;
  }
  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
}

async function ensureMailIndexes(db, options = {}) {
  const ttlSeconds = Number(options.ttlSeconds || process.env.MAIL_TTL_SECONDS || DEFAULT_MAIL_TTL_SECONDS);
  await Promise.all([
    db.collection('mail_accounts').createIndex({ email: 1 }, { unique: true }),
    db.collection('mail_messages').createIndex({ accountId: 1, messageId: 1 }, { unique: true }),
    db.collection('mail_messages').createIndex({ accountId: 1, receivedAt: -1 }),
    db.collection('mail_messages').createIndex({ createdAt: 1 }, { expireAfterSeconds: ttlSeconds }),
  ]);
}

async function createMailAccount(db, username) {
  const cleanUser = String(username || '').trim().toLowerCase().replace(/@heysmart\.lv$/, '');
  if (!/^[a-z0-9._%+-]{2,64}$/.test(cleanUser)) {
    const err = new Error('Invalid username');
    err.status = 400;
    throw err;
  }
  const email = normalizeMailEmail(`${cleanUser}@${MAIL_DOMAIN}`);
  const password = generateMailboxPassword();
  const now = new Date();
  const doc = {
    email,
    passwordHash: await bcrypt.hash(password, 10),
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  await db.collection('mail_accounts').insertOne(doc);
  return { account: publicAccount(doc), password, link: 'https://heysmart.lv/mail' };
}

async function resetMailPassword(db, id) {
  const password = generateMailboxPassword();
  const result = await db.collection('mail_accounts').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { passwordHash: await bcrypt.hash(password, 10), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) {
    const err = new Error('Mail account not found');
    err.status = 404;
    throw err;
  }
  return { account: publicAccount(result), password, link: 'https://heysmart.lv/mail' };
}

async function authenticateMailbox(db, email, password) {
  const normalized = normalizeMailEmail(email);
  if (!normalized || !password) return null;
  const account = await db.collection('mail_accounts').findOne({ email: normalized, active: true });
  if (!account) return null;
  const ok = await bcrypt.compare(password, account.passwordHash);
  if (!ok) return null;
  await db.collection('mail_accounts').updateOne({ _id: account._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() } });
  return account;
}

async function testImapConnection(env = process.env) {
  if (!env.IMAP_USER || !env.IMAP_PASSWORD) {
    return { ok: false, disabled: true, reason: 'IMAP_USER or IMAP_PASSWORD missing' };
  }
  const client = new ImapFlow({
    host: env.IMAP_HOST || 'imap.gmail.com',
    port: Number(env.IMAP_PORT || 993),
    secure: true,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASSWORD },
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true, unseen: true });
      let newest = null;
      for await (const message of client.fetch({ seq: `${Math.max(1, status.messages || 1)}:*` }, { envelope: true, uid: true, source: false })) {
        newest = {
          uid: message.uid,
          subject: message.envelope?.subject || '',
          date: message.envelope?.date || null,
          from: (message.envelope?.from || []).map(item => item.address).join(', '),
        };
      }
      return { ok: true, messages: status.messages || 0, unseen: status.unseen || 0, newest };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

function imapReady(env = process.env) {
  return Boolean(env.IMAP_USER && env.IMAP_PASSWORD);
}

async function pollInboxOnce(db, env = process.env) {
  if (!imapReady(env)) return { ok: false, disabled: true, saved: 0, skipped: 0 };
  const client = new ImapFlow({
    host: env.IMAP_HOST || 'imap.gmail.com',
    port: Number(env.IMAP_PORT || 993),
    secure: true,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASSWORD },
    logger: false,
  });
  let saved = 0;
  let skipped = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const message of client.fetch({ seen: false }, { uid: true, source: true, envelope: true })) {
        const parsed = await simpleParser(message.source);
        const email = findOriginalRecipient(parsed);
        if (!email) {
          skipped++;
          continue;
        }
        const account = await db.collection('mail_accounts').findOne({ email, active: true });
        if (!account) {
          skipped++;
          continue;
        }
        const doc = mapParsedMessage(parsed, {
          accountId: account._id,
          email,
          fallbackMessageId: `imap:${message.uid}`,
        });
        const result = await db.collection('mail_messages').updateOne(
          { accountId: account._id, messageId: doc.messageId },
          { $setOnInsert: doc },
          { upsert: true }
        );
        if (result.upsertedCount) saved++;
        else skipped++;
      }
      return { ok: true, saved, skipped };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

function startMailPoller(db, env = process.env) {
  if (!imapReady(env)) {
    console.log('HeySmart Mail IMAP disabled: IMAP_USER or IMAP_PASSWORD missing');
    return null;
  }
  const intervalMs = Math.max(5000, Number(env.MAIL_POLL_INTERVAL_MS || DEFAULT_MAIL_POLL_MS));
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await pollInboxOnce(db, env);
      if (result.saved) console.log(`HeySmart Mail saved ${result.saved} message(s)`);
    } catch (err) {
      console.error('HeySmart Mail poll error:', err.message);
    } finally {
      running = false;
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

function createMailService({ express, dbProvider, jwtSecret, requireAuth, requireAdmin }) {
  const router = express.Router();

  function db() {
    const value = dbProvider();
    if (!value) throw new Error('MongoDB is required for HeySmart Mail');
    return value;
  }

  function signMailbox(account) {
    return jwt.sign(
      { purpose: MAIL_TOKEN_PURPOSE, accountId: String(account._id), email: account.email },
      jwtSecret,
      { expiresIn: '7d' }
    );
  }

  function requireMailbox(req, res, next) {
    try {
      const token = cookieValue(req, MAIL_COOKIE);
      const payload = jwt.verify(token, jwtSecret);
      if (payload.purpose !== MAIL_TOKEN_PURPOSE || !normalizeMailEmail(payload.email)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.mailbox = payload;
      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  router.get('/api/admin/mail/accounts', requireAuth, requireAdmin, async (req, res) => {
    try {
      const accounts = await db().collection('mail_accounts').find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).toArray();
      res.json({ accounts: accounts.map(publicAccount) });
    } catch (err) {
      console.error('Mail accounts list error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/mail/accounts', requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await createMailAccount(db(), req.body?.username);
      res.status(201).json(result);
    } catch (err) {
      const duplicate = err.code === 11000;
      res.status(err.status || (duplicate ? 409 : 500)).json({ error: duplicate ? 'Mail account already exists' : err.message });
    }
  });

  router.post('/api/admin/mail/accounts/:id/deactivate', requireAuth, requireAdmin, async (req, res) => {
    try {
      await db().collection('mail_accounts').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { active: false, updatedAt: new Date() } });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Invalid account id' });
    }
  });

  router.post('/api/admin/mail/accounts/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
    try {
      res.json(await resetMailPassword(db(), req.params.id));
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.get('/api/admin/mail/accounts/:id/messages', requireAuth, requireAdmin, async (req, res) => {
    try {
      const accountId = new ObjectId(req.params.id);
      const messages = await db().collection('mail_messages').find({ accountId }).sort({ receivedAt: -1 }).limit(100).toArray();
      res.json({ messages: messages.map(publicMessage) });
    } catch {
      res.status(400).json({ error: 'Invalid account id' });
    }
  });

  router.post('/api/mail/login', async (req, res) => {
    try {
      if (!mailLoginAllowed(req)) return res.status(429).json({ error: 'Too many attempts' });
      const account = await authenticateMailbox(db(), req.body?.email, req.body?.password);
      if (!account) return res.status(401).json({ error: 'Invalid credentials' });
      res.cookie(MAIL_COOKIE, signMailbox(account), mailCookieOptions(req));
      res.json({ account: { email: account.email } });
    } catch (err) {
      console.error('Mailbox login error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/mail/logout', (req, res) => {
    res.clearCookie(MAIL_COOKIE, {
      path: '/',
      sameSite: 'lax',
      secure: req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https',
    });
    res.json({ ok: true });
  });

  router.get('/api/mail/me', requireMailbox, (req, res) => {
    res.json({ account: { email: req.mailbox.email } });
  });

  router.get('/api/mail/messages', requireMailbox, async (req, res) => {
    const accountId = new ObjectId(req.mailbox.accountId);
    const messages = await db().collection('mail_messages').find({ accountId }).sort({ receivedAt: -1 }).limit(100).toArray();
    res.json({ messages: messages.map(publicMessage) });
  });

  router.get('/api/mail/messages/:id', requireMailbox, async (req, res) => {
    try {
      const accountId = new ObjectId(req.mailbox.accountId);
      const _id = new ObjectId(req.params.id);
      const message = await db().collection('mail_messages').findOne({ _id, accountId });
      if (!message) return res.status(404).json({ error: 'Not found' });
      await db().collection('mail_messages').updateOne({ _id, accountId }, { $set: { isRead: true } });
      res.json({ message: publicMessage({ ...message, isRead: true }) });
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  router.post('/api/mail/sync', requireMailbox, async (req, res) => {
    try {
      res.json(await pollInboxOnce(db()));
    } catch (err) {
      console.error('Manual mail sync error:', err.message);
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  router.get('/api/admin/mail/imap-test', requireAuth, requireAdmin, async (req, res) => {
    try {
      res.json(await testImapConnection());
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return { router, ensureMailIndexes, startMailPoller };
}

module.exports = {
  createMailAccount,
  createMailService,
  ensureMailIndexes,
  extractVerificationCode,
  findOriginalRecipient,
  mapParsedMessage,
  normalizeMailEmail,
  pollInboxOnce,
  sanitizeMailHtml,
  startMailPoller,
  testImapConnection,
};
