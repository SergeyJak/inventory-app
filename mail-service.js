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
const IMAP_CONNECTION_TIMEOUT_MS = 15000;
const IMAP_GREETING_TIMEOUT_MS = 10000;
const IMAP_SOCKET_TIMEOUT_MS = 30000;
const MAIL_SYNC_TIMEOUT_MS = 45000;
const MAIL_LOGOUT_TIMEOUT_MS = 5000;
const MAIL_SYNC_OPERATION_TIMEOUT_MS = MAIL_SYNC_TIMEOUT_MS - MAIL_LOGOUT_TIMEOUT_MS;
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
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'span',
      'div',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
  }).trim();
}

function extractVerificationCode(value) {
  const text = String(value || '').replace(/\s+/g, ' ');
  const codeContext = text.match(
    /(?:код|code|verification|confirm|подтвержд)[^\d]{0,30}(\d[\d\s-]{3,10}\d)/i
  );
  const raw = codeContext
    ? codeContext[1]
    : (text.match(/\b\d{4,8}\b/) || [])[0];

  const code = String(raw || '').replace(/\D/g, '');
  return code.length >= 4 && code.length <= 8 ? code : '';
}

function mapParsedMessage(parsed, options) {
  const text = String(parsed?.text || '').trim();
  const html = sanitizeMailHtml(parsed?.html || '');
  const receivedAt =
    parsed?.date instanceof Date && !Number.isNaN(parsed.date.getTime())
      ? parsed.date
      : new Date();

  const messageId = String(
    parsed?.messageId ||
      options.fallbackMessageId ||
      crypto.randomUUID()
  );

  return {
    accountId: options.accountId,
    email: normalizeMailEmail(options.email),
    messageId,
    from: String(parsed?.from?.text || ''),
    to: String(parsed?.to?.text || options.email || ''),
    subject: String(parsed?.subject || '').slice(0, 500),
    text,
    html,
    verificationCode: extractVerificationCode(
      `${parsed?.subject || ''} ${text}`
    ),
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
    verificationCode:
      message.verificationCode ||
      extractVerificationCode(
        `${message.subject || ''} ${message.text || ''}`
      ),
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
  const found = raw
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(name + '='));

  return found
    ? decodeURIComponent(found.slice(name.length + 1))
    : '';
}

function mailCookieOptions(req) {
  const secure =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function rateKey(req) {
  return String(
    req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      'unknown'
  )
    .split(',')[0]
    .trim();
}

function mailLoginAllowed(req) {
  const key = rateKey(req);
  const now = Date.now();

  const recent = (loginAttempts.get(key) || []).filter(
    time => now - time < 10 * 60 * 1000
  );

  if (recent.length >= 8) {
    loginAttempts.set(key, recent);
    return false;
  }

  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
}

function imapDiagnosticsEnabled(env = process.env) {
  return String(env.MAIL_IMAP_DIAGNOSTICS || '').trim().toLowerCase() === 'true';
}

function addressFamilyName(family) {
  return Number(family) === 6 ? 'IPv6' : Number(family) === 4 ? 'IPv4' : null;
}

function createImapDiagnostics(env = process.env, context = {}) {
  const enabled = imapDiagnosticsEnabled(env);
  const startedAt = Date.now();
  const log = (phase, fields = {}) => {
    if (!enabled) return;
    console.log('[mail-imap-phase]', JSON.stringify({
      pollId: context.pollId || null,
      trigger: context.trigger || null,
      phase,
      durationMs: Date.now() - startedAt,
      ...fields,
    }));
  };

  return { enabled, startedAt, log };
}

function imapLogMarker(entry) {
  if (entry?.src === 'connection' && /Established .*TCP connection/.test(entry.msg || '')) {
    return 'secure-tcp-established';
  }
  if (entry?.src === 'auth' && entry.msg === 'User authenticated') {
    return 'authentication-completed';
  }
  const command = String(entry?.msg || '').match(/^\S+\s+(CAPABILITY|ID|AUTHENTICATE|LOGIN|NAMESPACE|COMPRESS|ENABLE|SELECT|STATUS)\b/i);
  return command ? `imap-command-${command[1].toUpperCase()}` : '';
}

function attachSocketDiagnostics(socket, diagnostics) {
  if (!diagnostics?.enabled || !socket || socket.__mailImapDiagnosticsAttached) return;
  socket.__mailImapDiagnosticsAttached = true;

  socket.on('lookup', (err, _address, family) => {
    diagnostics.log('dns-lookup', {
      resolvedAddressFamily: addressFamilyName(family),
      errorCode: err?.code || null,
    });
  });
  socket.on('connectionAttempt', (_ip, _port, family) => {
    diagnostics.log('tcp-connection-attempt', { resolvedAddressFamily: addressFamilyName(family) });
  });
  socket.on('connectionAttemptFailed', (_ip, _port, family, err) => {
    diagnostics.log('tcp-connection-attempt-failed', {
      resolvedAddressFamily: addressFamilyName(family),
      errorCode: err?.code || null,
    });
  });
  socket.on('connectionAttemptTimeout', (_ip, _port, family) => {
    diagnostics.log('tcp-connection-attempt-timeout', { resolvedAddressFamily: addressFamilyName(family) });
  });
  socket.on('connect', () => {
    diagnostics.log('tcp-connected', { remoteAddressFamily: addressFamilyName(socket.remoteFamily) });
  });
  socket.on('secureConnect', () => {
    diagnostics.log('tls-secure-connect', { remoteAddressFamily: addressFamilyName(socket.remoteFamily) });
  });
}

function imapClientOptions(env = process.env, diagnostics = false) {
  return {
    host: env.IMAP_HOST || 'imap.gmail.com',
    port: Number(env.IMAP_PORT || 993),
    secure: true,
    auth: {
      user: env.IMAP_USER,
      pass: env.IMAP_PASSWORD,
    },
    logger: false,
    emitLogs: diagnostics,
    connectionTimeout: IMAP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: IMAP_GREETING_TIMEOUT_MS,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
    // This poller only opens INBOX, searches unread mail, and fetches message source.
    // Gmail's optional post-auth COMPRESS and ENABLE negotiation is slow in Railway.
    disableCompression: true,
    disableAutoEnable: true,
  };
}

function createImapClient(env = process.env, label = 'IMAP', diagnostics = null) {
  const client = new ImapFlow(imapClientOptions(env, Boolean(diagnostics?.enabled)));

  /*
   * IMPORTANT:
   * ImapFlow is an EventEmitter. If it emits an "error" event
   * without a listener, Node.js can terminate the entire process.
   *
   * IMAP problems must never crash the shop/API process.
   */
  client.on('error', err => {
    console.error(
      `HeySmart Mail ${label} error:`,
      err?.message || err
    );
  });

  return client;
}

async function safeImapLogout(client, label = 'IMAP') {
  if (!client) return;

  try {
    if (client.usable) {
      let timer;
      try {
        await Promise.race([
          client.logout(),
          new Promise(resolve => { timer = setTimeout(resolve, MAIL_LOGOUT_TIMEOUT_MS); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (err) {
    console.warn(
      `HeySmart Mail ${label} logout error:`,
      err?.message || err
    );
  }
}

function closeImapClient(client) {
  try {
    client?.close();
  } catch (err) {
    console.warn('HeySmart Mail IMAP close error:', err?.message || err);
  }
}

function mailSyncTimeoutError(timeoutMs = MAIL_SYNC_TIMEOUT_MS) {
  const err = new Error(`Mail synchronization exceeded ${timeoutMs}ms`);
  err.name = 'MailSyncTimeoutError';
  err.code = 'MAIL_SYNC_TIMEOUT';
  return err;
}

async function withMailSyncDeadline(operation, onTimeout, timeoutMs = MAIL_SYNC_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          try {
            onTimeout?.();
          } finally {
            reject(mailSyncTimeoutError(timeoutMs));
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function ensureMailIndexes(db, options = {}) {
  const ttlSeconds = Number(
    options.ttlSeconds ||
      process.env.MAIL_TTL_SECONDS ||
      DEFAULT_MAIL_TTL_SECONDS
  );

  await Promise.all([
    db
      .collection('mail_accounts')
      .createIndex({ email: 1 }, { unique: true }),

    db
      .collection('mail_messages')
      .createIndex(
        { accountId: 1, messageId: 1 },
        { unique: true }
      ),

    db
      .collection('mail_messages')
      .createIndex({ accountId: 1, receivedAt: -1 }),

    db
      .collection('mail_messages')
      .createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: ttlSeconds }
      ),
  ]);
}

async function createMailAccount(db, username, password) {
  const cleanUser = String(username || '')
    .trim()
    .toLowerCase()
    .replace(/@heysmart\.lv$/, '');

  if (!/^[a-z0-9._%+-]{2,64}$/.test(cleanUser)) {
    const err = new Error('Invalid username');
    err.status = 400;
    throw err;
  }

  const cleanPassword = String(password || '');

  if (cleanPassword.length < 8) {
    const err = new Error(
      'Password is required and must be at least 8 characters'
    );
    err.status = 400;
    throw err;
  }

  const email = normalizeMailEmail(
    `${cleanUser}@${MAIL_DOMAIN}`
  );

  const now = new Date();

  const doc = {
    email,
    passwordHash: await bcrypt.hash(cleanPassword, 10),
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  await db.collection('mail_accounts').insertOne(doc);

  return {
    account: publicAccount(doc),
    password: cleanPassword,
    link: 'https://heysmart.lv/mail',
  };
}

async function resetMailPassword(db, id) {
  const password = generateMailboxPassword();

  const result = await db
    .collection('mail_accounts')
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          passwordHash: await bcrypt.hash(password, 10),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

  if (!result) {
    const err = new Error('Mail account not found');
    err.status = 404;
    throw err;
  }

  return {
    account: publicAccount(result),
    password,
    link: 'https://heysmart.lv/mail',
  };
}

async function changeMailPassword(db, id, password) {
  const cleanPassword = String(password || '');

  if (cleanPassword.length < 8) {
    const err = new Error(
      'Password is required and must be at least 8 characters'
    );
    err.status = 400;
    throw err;
  }

  const result = await db
    .collection('mail_accounts')
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          passwordHash: await bcrypt.hash(cleanPassword, 10),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

  if (!result) {
    const err = new Error('Mail account not found');
    err.status = 404;
    throw err;
  }

  return {
    account: publicAccount(result),
    password: cleanPassword,
    link: 'https://heysmart.lv/mail',
  };
}

async function authenticateMailbox(db, email, password) {
  const normalized = normalizeMailEmail(email);

  if (!normalized || !password) return null;

  const account = await db
    .collection('mail_accounts')
    .findOne({
      email: normalized,
      active: true,
    });

  if (!account) return null;

  const ok = await bcrypt.compare(
    password,
    account.passwordHash
  );

  if (!ok) return null;

  await db.collection('mail_accounts').updateOne(
    { _id: account._id },
    {
      $set: {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  return account;
}

async function testImapConnection(env = process.env, options = {}) {
  if (!env.IMAP_USER || !env.IMAP_PASSWORD) {
    return {
      ok: false,
      disabled: true,
      reason: 'IMAP_USER or IMAP_PASSWORD missing',
    };
  }

  const diagnostics = createImapDiagnostics(env, { trigger: 'imap-test' });
  const client = createImapClient(env, 'IMAP test', diagnostics);
  const startedAt = Date.now();
  const log = (event, data = {}) => console.log(`[mail-imap-test] ${event}`, JSON.stringify({
    durationMs: Date.now() - startedAt,
    ...data,
  }));

  try {
    const connectStartedAt = Date.now();
    const connectPromise = client.connect();
    attachSocketDiagnostics(client.socket, diagnostics);
    await connectPromise;
    diagnostics.log('connect', { durationMs: Date.now() - connectStartedAt });
    log('connected', { connectDurationMs: Date.now() - startedAt });

    const lockStartedAt = Date.now();
    const lock = await client.getMailboxLock('INBOX');
    diagnostics.log('mailbox-lock', { durationMs: Date.now() - lockStartedAt });

    try {
      const statusStartedAt = Date.now();
      const status = await client.status('INBOX', {
        messages: true,
        unseen: true,
      });
      diagnostics.log('status', { durationMs: Date.now() - statusStartedAt });

      let newest = null;

      for await (
        const message of client.fetch(
          {
            seq: `${Math.max(
              1,
              status.messages || 1
            )}:*`,
          },
          {
            envelope: true,
            uid: true,
            source: false,
          }
        )
      ) {
        newest = {
          uid: message.uid,
          subject: message.envelope?.subject || '',
          date: message.envelope?.date || null,
          from: (message.envelope?.from || [])
            .map(item => item.address)
            .join(', '),
        };
      }

      return {
        ok: true,
        messages: status.messages || 0,
        unseen: status.unseen || 0,
        newest,
      };
    } finally {
      lock.release();
    }
  } catch (err) {
    log('error', {
      errorName: err.name || 'Error',
      errorCode: err.code || null,
      errorMessage: err.message || String(err),
    });
    throw err;
  } finally {
    await safeImapLogout(client, 'IMAP test');
    closeImapClient(client);
    log('complete');
  }
}

function imapReady(env = process.env) {
  return Boolean(
    env.IMAP_USER &&
      env.IMAP_PASSWORD
  );
}

async function pollInboxOnce(db, env = process.env, options = {}) {
  if (!imapReady(env)) {
    return {
      ok: false,
      disabled: true,
      saved: 0,
      skipped: 0,
    };
  }

  const diagnostics = createImapDiagnostics(env, {
    pollId: options.pollId,
    trigger: options.trigger,
  });
  const client = (options.createClient || createImapClient)(env, 'poll', diagnostics);

  let saved = 0;
  let skipped = 0;
  let fetched = 0;
  let matched = 0;
  let phase = 'connect';
  const startedAt = Date.now();
  const progress = (event, data = {}) => options.onProgress?.(event, {
    pollId: options.pollId,
    trigger: options.trigger,
    durationMs: Date.now() - startedAt,
    ...data,
  });

  if (diagnostics?.enabled) {
    client.on('log', entry => {
      const marker = imapLogMarker(entry);
      if (marker) diagnostics.log(marker);
    });
  }

  try {
    return await withMailSyncDeadline((async () => {
      const connectStartedAt = Date.now();
      const connectPromise = client.connect();
      attachSocketDiagnostics(client.socket, diagnostics);
      await connectPromise;
      diagnostics.log('connect', { durationMs: Date.now() - connectStartedAt });
      progress('connected', { connectDurationMs: Date.now() - startedAt });

      phase = 'inbox';
      const lockStartedAt = Date.now();
      const lock = await client.getMailboxLock('INBOX');
      diagnostics.log('mailbox-lock', { durationMs: Date.now() - lockStartedAt });

      try {
        const statusStartedAt = Date.now();
        const status = await client.status('INBOX', { unseen: true });
        diagnostics.log('status', { durationMs: Date.now() - statusStartedAt });
        progress('inbox', { unread: status.unseen || 0 });

        phase = 'fetch';
        for await (
          const message of client.fetch(
            { seen: false },
            {
              uid: true,
              source: true,
              envelope: true,
            }
          )
        ) {
          fetched++;
          phase = 'parse';
          const parsed = await simpleParser(message.source);

          const email = findOriginalRecipient(parsed);

          if (!email) {
            skipped++;
            continue;
          }

          phase = 'account';
          const account = await db
            .collection('mail_accounts')
            .findOne({
              email,
              active: true,
            });

          if (!account) {
            skipped++;
            continue;
          }

          matched++;
          const doc = mapParsedMessage(parsed, {
            accountId: account._id,
            email,
            fallbackMessageId: `imap:${message.uid}`,
          });

          phase = 'write';
          const result = await db
            .collection('mail_messages')
            .updateOne(
              {
                accountId: account._id,
                messageId: doc.messageId,
              },
              {
                $setOnInsert: doc,
              },
              {
                upsert: true,
              }
            );

          if (result.upsertedCount) {
            saved++;
          } else {
            skipped++;
          }
        }

        return { ok: true, saved, skipped, fetched, matched };
      } finally {
        lock.release();
      }
    })(), () => closeImapClient(client), options.timeoutMs || MAIL_SYNC_OPERATION_TIMEOUT_MS);
  } catch (err) {
    err.mailSyncPhase = phase;
    throw err;
  } finally {
    await safeImapLogout(client, 'poll');
    closeImapClient(client);
  }
}

function createMailSyncCoordinator({ db, env = process.env, intervalMs, sync = pollInboxOnce }) {
  let running = false;
  let pollSequence = 0;

  async function run(trigger) {
    if (running) return { ok: false, inProgress: true };

    running = true;
    const pollId = `mail-${Date.now()}-${++pollSequence}`;
    const startedAt = Date.now();
    const log = (event, data = {}) => console.log(`[mail-sync] ${event}`, JSON.stringify({
      pollId,
      trigger,
      durationMs: Date.now() - startedAt,
      ...data,
    }));

    log('start', { configuredPollIntervalMs: intervalMs });
    try {
      const result = await sync(db, env, {
        pollId,
        trigger,
        onProgress(event, data) { log(event, data); },
      });
      log('complete', result);
      return result;
    } catch (err) {
      log('error', {
        phase: err.mailSyncPhase || 'unknown',
        errorName: err.name || 'Error',
        errorCode: err.code || null,
        errorMessage: err.message || String(err),
      });
      throw err;
    } finally {
      running = false;
    }
  }

  return { run, isRunning: () => running };
}

function mailPollIntervalMs(env = process.env) {
  return Math.max(5000, Number(env.MAIL_POLL_INTERVAL_MS || DEFAULT_MAIL_POLL_MS));
}

function startMailPoller(db, env = process.env, coordinator = null) {
  if (!imapReady(env)) {
    console.log(
      'HeySmart Mail IMAP disabled: IMAP_USER or IMAP_PASSWORD missing'
    );
    return null;
  }

  const intervalMs = mailPollIntervalMs(env);

  const syncCoordinator = coordinator || createMailSyncCoordinator({ db, env, intervalMs });

  const tick = async () => {
    if (syncCoordinator.isRunning()) {
      console.log('[mail-sync] skipped', JSON.stringify({ trigger: 'interval', reason: 'sync-in-progress' }));
      return;
    }

    try {
      await syncCoordinator.run('startup');
    } catch (err) {
      // The coordinator has already logged structured error details.
    }
  };

  tick();

  return setInterval(async () => {
    if (syncCoordinator.isRunning()) {
      console.log('[mail-sync] skipped', JSON.stringify({ trigger: 'interval', reason: 'sync-in-progress' }));
      return;
    }
    try { await syncCoordinator.run('interval'); } catch { /* logged above */ }
  }, intervalMs);
}

function createMailService({
  express,
  dbProvider,
  jwtSecret,
  requireAuth,
  requireAdmin,
}) {
  const router = express.Router();
  let syncCoordinator = null;

  function coordinator() {
    if (!syncCoordinator) {
      syncCoordinator = createMailSyncCoordinator({
        db: db(),
        env: process.env,
        intervalMs: mailPollIntervalMs(process.env),
      });
    }
    return syncCoordinator;
  }

  function startServiceMailPoller(database, env = process.env) {
    syncCoordinator = createMailSyncCoordinator({
      db: database,
      env,
      intervalMs: mailPollIntervalMs(env),
    });
    return startMailPoller(database, env, syncCoordinator);
  }

  function db() {
    const value = dbProvider();

    if (!value) {
      throw new Error(
        'MongoDB is required for HeySmart Mail'
      );
    }

    return value;
  }

  function signMailbox(account) {
    return jwt.sign(
      {
        purpose: MAIL_TOKEN_PURPOSE,
        accountId: String(account._id),
        email: account.email,
      },
      jwtSecret,
      {
        expiresIn: '7d',
      }
    );
  }

  function requireMailbox(req, res, next) {
    try {
      const token = cookieValue(
        req,
        MAIL_COOKIE
      );

      const payload = jwt.verify(
        token,
        jwtSecret
      );

      if (
        payload.purpose !== MAIL_TOKEN_PURPOSE ||
        !normalizeMailEmail(payload.email)
      ) {
        return res
          .status(401)
          .json({
            error: 'Unauthorized',
          });
      }

      req.mailbox = payload;
      return next();
    } catch {
      return res
        .status(401)
        .json({
          error: 'Unauthorized',
        });
    }
  }

  router.get(
    '/api/admin/mail/accounts',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const accounts = await db()
          .collection('mail_accounts')
          .find(
            {},
            {
              projection: {
                passwordHash: 0,
              },
            }
          )
          .sort({
            createdAt: -1,
          })
          .toArray();

        res.json({
          accounts: accounts.map(
            publicAccount
          ),
        });
      } catch (err) {
        console.error(
          'Mail accounts list error:',
          err.message
        );

        res
          .status(500)
          .json({
            error: 'Internal server error',
          });
      }
    }
  );

  router.post(
    '/api/admin/mail/accounts',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        if (
          String(req.body?.password || '') !==
          String(
            req.body?.confirmPassword || ''
          )
        ) {
          return res
            .status(400)
            .json({
              error:
                'Passwords do not match',
            });
        }

        const result =
          await createMailAccount(
            db(),
            req.body?.username,
            req.body?.password
          );

        res
          .status(201)
          .json(result);
      } catch (err) {
        const duplicate =
          err.code === 11000;

        res
          .status(
            err.status ||
              (duplicate ? 409 : 500)
          )
          .json({
            error: duplicate
              ? 'Mail account already exists'
              : err.message,
          });
      }
    }
  );

  router.post(
    '/api/admin/mail/accounts/:id/deactivate',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        await db()
          .collection('mail_accounts')
          .updateOne(
            {
              _id: new ObjectId(
                req.params.id
              ),
            },
            {
              $set: {
                active: false,
                updatedAt:
                  new Date(),
              },
            }
          );

        res.json({
          ok: true,
        });
      } catch {
        res
          .status(400)
          .json({
            error:
              'Invalid account id',
          });
      }
    }
  );

  router.post(
    '/api/admin/mail/accounts/:id/activate',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        await db()
          .collection('mail_accounts')
          .updateOne(
            {
              _id: new ObjectId(
                req.params.id
              ),
            },
            {
              $set: {
                active: true,
                updatedAt:
                  new Date(),
              },
            }
          );

        res.json({
          ok: true,
        });
      } catch {
        res
          .status(400)
          .json({
            error:
              'Invalid account id',
          });
      }
    }
  );

  router.post(
    '/api/admin/mail/accounts/:id/reset-password',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        if (
          req.body?.password !== undefined
        ) {
          if (
            String(
              req.body?.password || ''
            ) !==
            String(
              req.body
                ?.confirmPassword || ''
            )
          ) {
            return res
              .status(400)
              .json({
                error:
                  'Passwords do not match',
              });
          }

          return res.json(
            await changeMailPassword(
              db(),
              req.params.id,
              req.body.password
            )
          );
        }

        res.json(
          await resetMailPassword(
            db(),
            req.params.id
          )
        );
      } catch (err) {
        res
          .status(
            err.status || 400
          )
          .json({
            error: err.message,
          });
      }
    }
  );

  router.delete(
    '/api/admin/mail/accounts/:id',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const accountId =
          new ObjectId(
            req.params.id
          );

        const accountResult =
          await db()
            .collection(
              'mail_accounts'
            )
            .deleteOne({
              _id: accountId,
            });

        await db()
          .collection(
            'mail_messages'
          )
          .deleteMany({
            accountId,
          });

        if (
          !accountResult.deletedCount
        ) {
          return res
            .status(404)
            .json({
              error:
                'Mail account not found',
            });
        }

        res.json({
          ok: true,
        });
      } catch {
        res
          .status(400)
          .json({
            error:
              'Invalid account id',
          });
      }
    }
  );

  router.get(
    '/api/admin/mail/accounts/:id/messages',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const accountId =
          new ObjectId(
            req.params.id
          );

        const messages =
          await db()
            .collection(
              'mail_messages'
            )
            .find({
              accountId,
            })
            .sort({
              receivedAt: -1,
            })
            .limit(100)
            .toArray();

        res.json({
          messages:
            messages.map(
              publicMessage
            ),
        });
      } catch {
        res
          .status(400)
          .json({
            error:
              'Invalid account id',
          });
      }
    }
  );

  router.post(
    '/api/mail/login',
    async (req, res) => {
      try {
        if (
          !mailLoginAllowed(req)
        ) {
          return res
            .status(429)
            .json({
              error:
                'Too many attempts',
            });
        }

        const account =
          await authenticateMailbox(
            db(),
            req.body?.email,
            req.body?.password
          );

        if (!account) {
          return res
            .status(401)
            .json({
              error:
                'Invalid credentials',
            });
        }

        res.cookie(
          MAIL_COOKIE,
          signMailbox(account),
          mailCookieOptions(req)
        );

        res.json({
          account: {
            email: account.email,
          },
        });
      } catch (err) {
        console.error(
          'Mailbox login error:',
          err.message
        );

        res
          .status(500)
          .json({
            error:
              'Internal server error',
          });
      }
    }
  );

  router.post(
    '/api/mail/logout',
    (req, res) => {
      res.clearCookie(
        MAIL_COOKIE,
        {
          path: '/',
          sameSite: 'lax',
          secure:
            req.secure ||
            String(
              req.headers[
                'x-forwarded-proto'
              ] || ''
            ).split(',')[0] ===
              'https',
        }
      );

      res.json({
        ok: true,
      });
    }
  );

  router.get(
    '/api/mail/me',
    requireMailbox,
    (req, res) => {
      res.json({
        account: {
          email:
            req.mailbox.email,
        },
      });
    }
  );

  router.get(
    '/api/mail/messages',
    requireMailbox,
    async (req, res) => {
      const accountId =
        new ObjectId(
          req.mailbox.accountId
        );

      const messages =
        await db()
          .collection(
            'mail_messages'
          )
          .find({
            accountId,
          })
          .sort({
            receivedAt: -1,
          })
          .limit(100)
          .toArray();

      res.json({
        messages:
          messages.map(
            publicMessage
          ),
      });
    }
  );

  router.get(
    '/api/mail/messages/:id',
    requireMailbox,
    async (req, res) => {
      try {
        const accountId =
          new ObjectId(
            req.mailbox.accountId
          );

        const _id =
          new ObjectId(
            req.params.id
          );

        const message =
          await db()
            .collection(
              'mail_messages'
            )
            .findOne({
              _id,
              accountId,
            });

        if (!message) {
          return res
            .status(404)
            .json({
              error: 'Not found',
            });
        }

        await db()
          .collection(
            'mail_messages'
          )
          .updateOne(
            {
              _id,
              accountId,
            },
            {
              $set: {
                isRead: true,
              },
            }
          );

        res.json({
          message:
            publicMessage({
              ...message,
              isRead: true,
            }),
        });
      } catch {
        res
          .status(404)
          .json({
            error: 'Not found',
          });
      }
    }
  );

  router.post(
    '/api/mail/sync',
    requireMailbox,
    async (req, res) => {
      try {
        const result = await coordinator().run('manual');
        if (result.inProgress) {
          return res.status(409).json({
            ok: false,
            inProgress: true,
            error: 'Mail synchronization is already in progress',
          });
        }
        res.json(result);
      } catch (err) {
        console.error(
          'Manual mail sync error:',
          err.message
        );

        res
          .status(500)
          .json({
            error: 'Sync failed',
          });
      }
    }
  );

  router.get(
    '/api/admin/mail/imap-test',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      let closedEarly = false;
      const onAborted = () => {
        closedEarly = true;
        console.warn('[mail-imap-test] request-aborted', JSON.stringify({ path: req.originalUrl }));
      };
      req.on('aborted', onAborted);
      res.on('close', () => {
        if (!res.writableEnded && !closedEarly) onAborted();
      });
      try {
        res.json(
          await testImapConnection()
        );
      } catch (err) {
        res
          .status(500)
          .json({
            ok: false,
            error: err.message,
          });
      }
    }
  );

  return {
    router,
    ensureMailIndexes,
    startMailPoller: startServiceMailPoller,
  };
}

module.exports = {
  changeMailPassword,
  createMailSyncCoordinator,
  createMailAccount,
  createMailService,
  ensureMailIndexes,
  extractVerificationCode,
  findOriginalRecipient,
  imapDiagnosticsEnabled,
  imapLogMarker,
  imapClientOptions,
  IMAP_CONNECTION_TIMEOUT_MS,
  IMAP_GREETING_TIMEOUT_MS,
  IMAP_SOCKET_TIMEOUT_MS,
  MAIL_SYNC_TIMEOUT_MS,
  mailPollIntervalMs,
  mapParsedMessage,
  normalizeMailEmail,
  pollInboxOnce,
  sanitizeMailHtml,
  startMailPoller,
  testImapConnection,
};
