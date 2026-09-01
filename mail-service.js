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
const MAIL_SYNC_BOOTSTRAP_TIMEOUT_MS = 90000;
const DEFAULT_MAIL_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAIL_SYNC_SOURCE = 'gmail-primary';
const MAIL_SYNC_MAILBOX = 'INBOX';
const UIDVALIDITY_RECOVERY_BATCH_SIZE = 100;
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
    ...(options.imapMailbox ? {
      imapMailbox: options.imapMailbox,
      imapUidValidity: String(options.imapUidValidity || ''),
      imapUid: Number(options.imapUid),
    } : {}),
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
    return { phase: 'secure-tcp-established', direction: 'received', kind: 'lifecycle' };
  }
  if (entry?.src === 'auth' && entry.msg === 'User authenticated') {
    return { phase: 'authentication-completed', direction: 'received', kind: 'lifecycle' };
  }
  const commands = 'LIST|SELECT|STATUS|SEARCH|FETCH|NAMESPACE|CAPABILITY|AUTHENTICATE';
  const sent = entry?.src === 'c' && String(entry.msg || '').match(new RegExp(`^\\S+\\s+(${commands})\\b`, 'i'));
  if (sent) return { phase: `imap-command-${sent[1].toUpperCase()}`, direction: 'sent', kind: 'command' };
  const untagged = entry?.src === 's' && String(entry.msg || '').match(new RegExp(`^\\*\\s+(?:\\d+\\s+)?(${commands})\\b`, 'i'));
  if (untagged) return { phase: `imap-command-${untagged[1].toUpperCase()}`, direction: 'received', kind: 'untagged-response' };
  return null;
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

function createImapClient(env = process.env, label = 'IMAP', diagnostics = null, diagnosticsRef = null) {
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

  if (diagnostics?.enabled) {
    client.on('log', entry => {
      const marker = imapLogMarker(entry);
      const activeDiagnostics = diagnosticsRef?.current || diagnostics;
      if (marker) activeDiagnostics.log(marker.phase, { direction: marker.direction, kind: marker.kind });
    });
    client.on('response', response => {
      const activeDiagnostics = diagnosticsRef?.current || diagnostics;
      activeDiagnostics.log('imap-tagged-completion', {
        direction: 'received',
        kind: 'tagged-completion',
        completionStatus: response.response || null,
        completionCode: response.code || null,
      });
    });
  }

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
  let deferredTimeout = null;
  try {
    return await Promise.race([
      Promise.resolve(operation).then(result => {
        if (deferredTimeout) throw deferredTimeout;
        return result;
      }),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          try {
            const defer = onTimeout?.();
            if (defer) {
              deferredTimeout = mailSyncTimeoutError(timeoutMs);
              return;
            }
          } finally {
            if (!deferredTimeout) reject(mailSyncTimeoutError(timeoutMs));
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function mailSyncDeadlineMs({ persistent = false, connectionMode = 'new', timeoutMs } = {}) {
  if (Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0) return Number(timeoutMs);
  return persistent && connectionMode === 'new'
    ? MAIL_SYNC_BOOTSTRAP_TIMEOUT_MS
    : MAIL_SYNC_OPERATION_TIMEOUT_MS;
}

function isApplicationProcessingPhase(phase) {
  return phase === 'parse' || phase === 'account' || phase === 'write';
}

function uidValidityValue(value) {
  const normalized = String(value || '').trim();
  if (!/^\d+$/.test(normalized)) throw new Error('IMAP UIDVALIDITY is unavailable');
  return normalized;
}

function checkpointFilter() {
  return { source: MAIL_SYNC_SOURCE, mailbox: MAIL_SYNC_MAILBOX };
}

// lastProcessedUid is inclusive: every terminal UID through it is handled.
// Every future UID SEARCH must therefore begin at lastProcessedUid + 1.
function nextUidAfter(lastProcessedUid) {
  return Number(lastProcessedUid) + 1;
}

async function initializeCheckpoint(db, checkpointDoc) {
  const collection = db.collection('mail_sync_checkpoints');
  try {
    const result = await collection.updateOne(
      checkpointFilter(),
      { $setOnInsert: checkpointDoc },
      { upsert: true }
    );
    if (result.upsertedCount) return { created: true, checkpoint: checkpointDoc };
  } catch (err) {
    // A concurrent initializer can still win the unique-index race. Load it below.
    if (err?.code !== 11000 && err?.codeName !== 'DuplicateKey') throw err;
  }

  const existing = await collection.findOne(checkpointFilter());
  if (!existing) throw new Error('Mail checkpoint initialization did not persist');
  return { created: false, checkpoint: existing };
}

async function fetchUidMessages(client, uids, diagnostics) {
  if (!uids.length) return [];
  const startedAt = Date.now();
  const messages = [];
  for await (const message of client.fetch(
    uids,
    { uid: true, source: true, envelope: true },
    { uid: true }
  )) {
    messages.push(message);
  }
  diagnostics.log('uid-fetch', { durationMs: Date.now() - startedAt, fetchedCount: messages.length });
  return messages;
}

async function processUidMessages(db, messages, requestedUids, uidValidity, options = {}) {
  const byUid = new Map(messages.map(message => [Number(message.uid), message]));
  const requested = [...requestedUids].sort((a, b) => a - b);
  const parser = options.parser || simpleParser;
  const result = { saved: 0, skipped: 0, matched: 0, terminalCount: 0, lastTerminalUid: null, failure: null };

  for (const uid of requested) {
    try {
      const message = byUid.get(uid);
      if (!message) {
        // SEARCH succeeded and FETCH completed without this UID: it was expunged.
        result.skipped++;
      } else {
        const parsed = await parser(message.source);
        const email = findOriginalRecipient(parsed);
        if (!email) {
          result.skipped++;
        } else {
          const account = await db.collection('mail_accounts').findOne({ email, active: true });
          if (!account) {
            result.skipped++;
          } else {
            result.matched++;
            const doc = mapParsedMessage(parsed, {
              accountId: account._id,
              email,
              fallbackMessageId: `imap:${uid}`,
            });
            const audit = {
              imapMailbox: MAIL_SYNC_MAILBOX,
              imapUidValidity: uidValidity,
              imapUid: uid,
            };
            const write = await db.collection('mail_messages').updateOne(
              { accountId: account._id, messageId: doc.messageId },
              { $setOnInsert: doc, $set: audit },
              { upsert: true }
            );
            if (write.upsertedCount) result.saved++;
            else result.skipped++;
          }
        }
      }
      result.terminalCount++;
      result.lastTerminalUid = uid;
    } catch (err) {
      result.failure = err;
      break;
    }
  }
  return result;
}

async function advanceCheckpoint(db, checkpoint, checkpointAfter, extra = {}) {
  const result = await db.collection('mail_sync_checkpoints').updateOne(
    {
      ...checkpointFilter(),
      uidValidity: checkpoint.uidValidity,
      lastProcessedUid: checkpoint.lastProcessedUid,
    },
    { $set: { lastProcessedUid: checkpointAfter, updatedAt: new Date(), lastSuccessAt: new Date(), ...extra } }
  );
  if (!result.matchedCount) throw new Error('Mail checkpoint update did not match the current generation');
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

    db
      .collection('mail_sync_checkpoints')
      .createIndex({ source: 1, mailbox: 1 }, { unique: true }),
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

function createPersistentImapConnectionManager({ env = process.env, createClient = createImapClient } = {}) {
  let client = null;
  const diagnosticsRef = { current: null };

  function usable() {
    return Boolean(client && client.usable && !client.isClosed && !client.socket?.destroyed);
  }

  function invalidate(reason = 'invalidated') {
    if (!client) return;
    const staleClient = client;
    client = null;
    diagnosticsRef.current?.log('persistent-connection-invalidated', { reason });
    closeImapClient(staleClient);
  }

  async function getClient(diagnostics) {
    diagnosticsRef.current = diagnostics;
    if (usable()) {
      diagnostics.log('persistent-connection-reused');
      return { client, reused: true };
    }

    invalidate('unusable');
    const newClient = createClient(env, 'poll', diagnostics, diagnosticsRef);
    client = newClient;
    newClient.on('close', () => {
      if (client === newClient) client = null;
    });
    diagnostics.log('persistent-connection-created');
    return { client, reused: false };
  }

  async function shutdown() {
    if (!client) return;
    const activeClient = client;
    client = null;
    await safeImapLogout(activeClient, 'persistent poll');
    closeImapClient(activeClient);
  }

  return { getClient, invalidate, shutdown, usable };
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
  const connectionManager = options.connectionManager || null;
  const clientInfo = connectionManager
    ? await connectionManager.getClient(diagnostics)
    : { client: (options.createClient || createImapClient)(env, 'poll', diagnostics), reused: false };
  const client = clientInfo.client;
  const connectionMode = clientInfo.reused ? 'reused' : 'new';
  const deadlineMs = mailSyncDeadlineMs({
    persistent: Boolean(connectionManager),
    connectionMode,
    timeoutMs: options.timeoutMs,
  });

  let saved = 0;
  let skipped = 0;
  let fetched = 0;
  let matched = 0;
  let phase = 'connect';
  let preservedApplicationTimeout = false;
  const startedAt = Date.now();
  const progress = (event, data = {}) => options.onProgress?.(event, {
    pollId: options.pollId,
    trigger: options.trigger,
    durationMs: Date.now() - startedAt,
    ...data,
  });

  progress('deadline', { connectionMode, deadlineMs });

  try {
    return await withMailSyncDeadline((async () => {
      if (!clientInfo.reused) {
        const connectStartedAt = Date.now();
        const connectPromise = client.connect();
        attachSocketDiagnostics(client.socket, diagnostics);
        await connectPromise;
        diagnostics.log('connect', { durationMs: Date.now() - connectStartedAt });
      }
      progress('connected', { connectDurationMs: Date.now() - startedAt });

      phase = 'inbox';
      const lockStartedAt = Date.now();
      const lock = await client.getMailboxLock(MAIL_SYNC_MAILBOX);
      diagnostics.log('mailbox-lock', { durationMs: Date.now() - lockStartedAt });
      let checkpoint;
      let mode;
      let boundaryUid = null;
      let requestedUids = [];
      let uidValidity;
      let fetchedMessages = [];
      let searchFromUid = 1;

      try {
        uidValidity = uidValidityValue(client.mailbox?.uidValidity);
        checkpoint = await db.collection('mail_sync_checkpoints').findOne(checkpointFilter());
        if (checkpoint) {
          progress('checkpoint-loaded', {
            uidValidity: checkpoint.uidValidity,
            checkpointBefore: checkpoint.lastProcessedUid,
            recoveryMode: checkpoint.mode || 'post-legacy-baseline',
          });
        }

        if (!checkpoint) {
          mode = 'legacy-baseline';
          progress('checkpoint-initializing', { uidValidity, recoveryMode: mode });
          const statusStartedAt = Date.now();
          const status = await client.status(MAIL_SYNC_MAILBOX, { uidValidity: true, uidNext: true });
          diagnostics.log('status', { durationMs: Date.now() - statusStartedAt });
          uidValidity = uidValidityValue(status.uidValidity || client.mailbox?.uidValidity);
          boundaryUid = Math.max(1, Number(status.uidNext || client.mailbox?.uidNext || 1));
          const legacyRange = boundaryUid > 1 ? `1:${boundaryUid - 1}` : '';
          searchFromUid = 1;
          requestedUids = legacyRange
            ? await client.search({ uid: legacyRange, seen: false }, { uid: true })
            : [];
        } else if (checkpoint.uidValidity !== uidValidity) {
          mode = 'uidvalidity-recovery';
          progress('uidvalidity-changed', { checkpointBefore: checkpoint.lastProcessedUid, uidValidity, recoveryMode: mode });
          if (checkpoint.recoveryUidValidity !== uidValidity) {
            const statusStartedAt = Date.now();
            const status = await client.status(MAIL_SYNC_MAILBOX, { uidValidity: true, uidNext: true });
            diagnostics.log('status', { durationMs: Date.now() - statusStartedAt });
            uidValidity = uidValidityValue(status.uidValidity || uidValidity);
            boundaryUid = Math.max(1, Number(status.uidNext || client.mailbox?.uidNext || 1));
            await db.collection('mail_sync_checkpoints').updateOne(checkpointFilter(), {
              $set: {
                mode,
                recoveryUidValidity: uidValidity,
                recoveryBoundaryUid: boundaryUid,
                recoveryNextUid: 1,
                updatedAt: new Date(),
              },
            });
            checkpoint = { ...checkpoint, recoveryUidValidity: uidValidity, recoveryBoundaryUid: boundaryUid, recoveryNextUid: 1 };
            progress('uidvalidity-recovery-start', { uidValidity, toUid: boundaryUid - 1, recoveryMode: mode });
          }
          boundaryUid = Number(checkpoint.recoveryBoundaryUid);
          searchFromUid = Number(checkpoint.recoveryNextUid || 1);
          requestedUids = searchFromUid < boundaryUid
            ? (await client.search({ uid: `${searchFromUid}:${boundaryUid - 1}` }, { uid: true })).slice(0, UIDVALIDITY_RECOVERY_BATCH_SIZE)
            : [];
        } else {
          mode = 'steady';
          searchFromUid = nextUidAfter(checkpoint.lastProcessedUid);
          requestedUids = await client.search({ uid: `${searchFromUid}:*` }, { uid: true });
        }

        const rawUids = [...new Set((requestedUids || []).map(Number))].sort((a, b) => a - b);
        if (mode === 'steady') {
          // IMAP sequence sets are inclusive even when "*" resolves below the
          // left endpoint (for example, UID 66:* may return UID 65). The
          // durable checkpoint is authoritative, so never fetch it again.
          requestedUids = rawUids.filter(uid => uid > Number(checkpoint.lastProcessedUid));
        } else if (mode === 'uidvalidity-recovery') {
          // Recovery intentionally revisits historical UIDs, but only within
          // the exact requested recovery range.
          requestedUids = rawUids.filter(uid => uid >= searchFromUid && uid < boundaryUid);
        } else {
          requestedUids = rawUids;
        }
        progress('uid-search', {
          uidValidity,
          requestedFromUid: searchFromUid,
          rawFoundCount: rawUids.length,
          candidateFoundCount: requestedUids.length,
          rawMinUid: rawUids.at(0) || null,
          rawMaxUid: rawUids.at(-1) || null,
          recoveryMode: mode,
        });
        phase = 'fetch';
        fetchedMessages = await fetchUidMessages(client, requestedUids, diagnostics);
        fetched = fetchedMessages.length;
        progress('uid-fetch', { uidValidity, foundCount: requestedUids.length, fetchedCount: fetched, recoveryMode: mode });
      } finally {
        lock.release();
      }

      phase = 'parse';
      const processed = await processUidMessages(db, fetchedMessages, requestedUids, uidValidity, options);
      saved += processed.saved;
      skipped += processed.skipped;
      matched += processed.matched;

      if (mode === 'legacy-baseline') {
        if (processed.failure) throw processed.failure;
        const checkpointDoc = {
          ...checkpointFilter(), uidValidity, lastProcessedUid: boundaryUid - 1,
          legacyBaselineUid: boundaryUid - 1, mode: 'post-legacy-baseline',
          initializedAt: new Date(), updatedAt: new Date(), lastSuccessAt: new Date(),
        };
        const initialized = await initializeCheckpoint(db, checkpointDoc);
        checkpoint = initialized.checkpoint;
        progress(initialized.created ? 'checkpoint-initialized' : 'checkpoint-loaded', {
          uidValidity: checkpoint.uidValidity,
          checkpointAfter: checkpoint.lastProcessedUid,
          recoveryMode: mode,
        });
      } else if (mode === 'uidvalidity-recovery') {
        const nextUid = processed.lastTerminalUid ? processed.lastTerminalUid + 1 : Number(checkpoint.recoveryNextUid || 1);
        if (processed.lastTerminalUid) {
          await db.collection('mail_sync_checkpoints').updateOne(checkpointFilter(), { $set: { recoveryNextUid: nextUid, updatedAt: new Date() } });
        }
        if (processed.failure) throw processed.failure;
        if (!requestedUids.length) {
          await db.collection('mail_sync_checkpoints').updateOne(checkpointFilter(), {
            $set: { uidValidity, lastProcessedUid: boundaryUid - 1, mode: 'post-legacy-baseline', updatedAt: new Date(), lastSuccessAt: new Date() },
            $unset: { recoveryUidValidity: '', recoveryBoundaryUid: '', recoveryNextUid: '' },
          });
          progress('uidvalidity-recovery-complete', { uidValidity, checkpointAfter: boundaryUid - 1, recoveryMode: mode });
        } else {
          progress('uidvalidity-recovery-progress', { uidValidity, checkpointAfter: nextUid - 1, terminalCount: processed.terminalCount, recoveryMode: mode });
        }
      } else if (processed.lastTerminalUid) {
        await advanceCheckpoint(db, checkpoint, processed.lastTerminalUid);
        progress('checkpoint-advanced', { uidValidity, checkpointBefore: checkpoint.lastProcessedUid, checkpointAfter: processed.lastTerminalUid, terminalCount: processed.terminalCount });
        if (processed.failure) throw processed.failure;
      } else if (processed.failure) {
        throw processed.failure;
      }

      return { ok: true, saved, skipped, fetched, matched };
    })(), () => {
      const preserveConnection = Boolean(
        connectionManager &&
        clientInfo.reused &&
        isApplicationProcessingPhase(phase) &&
        connectionManager.usable()
      );
      if (preserveConnection) {
        preservedApplicationTimeout = true;
        return true;
      }
      if (connectionManager) connectionManager.invalidate('sync-timeout');
      else closeImapClient(client);
      return false;
    }, deadlineMs);
  } catch (err) {
    err.mailSyncPhase = phase;
    if (connectionManager && !(preservedApplicationTimeout && err.code === 'MAIL_SYNC_TIMEOUT')) {
      connectionManager.invalidate(err.code || 'sync-error');
    }
    throw err;
  } finally {
    if (!connectionManager) {
      await safeImapLogout(client, 'poll');
      closeImapClient(client);
    }
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
  let imapConnectionManager = null;

  function connectionManager(env = process.env) {
    if (!imapConnectionManager) {
      imapConnectionManager = createPersistentImapConnectionManager({ env });
    }
    return imapConnectionManager;
  }

  function createPersistentCoordinator(database, env) {
    const manager = connectionManager(env);
    return createMailSyncCoordinator({
      db: database,
      env,
      intervalMs: mailPollIntervalMs(env),
      sync: (pollDb, pollEnv, options) => pollInboxOnce(pollDb, pollEnv, {
        ...options,
        connectionManager: manager,
      }),
    });
  }

  function coordinator() {
    if (!syncCoordinator) {
      syncCoordinator = createPersistentCoordinator(db(), process.env);
    }
    return syncCoordinator;
  }

  function startServiceMailPoller(database, env = process.env) {
    syncCoordinator = createPersistentCoordinator(database, env);
    return startMailPoller(database, env, syncCoordinator);
  }

  async function shutdownMailPoller() {
    await imapConnectionManager?.shutdown();
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
    shutdownMailPoller,
  };
}

module.exports = {
  changeMailPassword,
  createMailSyncCoordinator,
  createPersistentImapConnectionManager,
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
  MAIL_SYNC_BOOTSTRAP_TIMEOUT_MS,
  MAIL_SYNC_TIMEOUT_MS,
  mailSyncDeadlineMs,
  mailPollIntervalMs,
  mapParsedMessage,
  normalizeMailEmail,
  pollInboxOnce,
  sanitizeMailHtml,
  startMailPoller,
  testImapConnection,
};
