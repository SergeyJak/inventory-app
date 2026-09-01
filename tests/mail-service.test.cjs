const assert = require('assert');
const { EventEmitter } = require('events');

const {
  changeMailPassword,
  createMailSyncCoordinator,
  createPersistentImapConnectionManager,
  createMailAccount,
  extractVerificationCode,
  findOriginalRecipient,
  imapDiagnosticsEnabled,
  imapLogMarker,
  imapClientOptions,
  IMAP_CONNECTION_TIMEOUT_MS,
  IMAP_GREETING_TIMEOUT_MS,
  IMAP_SOCKET_TIMEOUT_MS,
  mapParsedMessage,
  normalizeMailEmail,
  pollInboxOnce,
  sanitizeMailHtml,
} = require('../mail-service');
const bcrypt = require('bcryptjs');

function headers(entries) {
  return new Map(entries.map(([key, value]) => [key.toLowerCase(), value]));
}

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log('ok - ' + name))
    .catch(err => {
      console.error('not ok - ' + name);
      console.error(err);
      process.exitCode = 1;
    });
}

test('normalizeMailEmail accepts only heysmart.lv mailbox addresses', () => {
  assert.strictEqual(normalizeMailEmail('  Alstrix1023@HeySmart.lv  '), 'alstrix1023@heysmart.lv');
  assert.strictEqual(normalizeMailEmail('bad@gmail.com'), '');
  assert.strictEqual(normalizeMailEmail('bad user@heysmart.lv'), '');
});

test('findOriginalRecipient prefers delivered headers before visible To', () => {
  const parsed = {
    headers: headers([
      ['delivered-to', 'heysmartmailbox@gmail.com'],
      ['x-original-to', 'alstrix1023@heysmart.lv'],
    ]),
    to: { value: [{ address: 'catchall@heysmart.lv' }] },
  };
  assert.strictEqual(findOriginalRecipient(parsed), 'alstrix1023@heysmart.lv');
});

test('findOriginalRecipient reads visible To when routing headers are absent', () => {
  const parsed = {
    headers: headers([]),
    to: { value: [{ address: 'Client.Name+tag@heysmart.lv' }] },
  };
  assert.strictEqual(findOriginalRecipient(parsed), 'client.name+tag@heysmart.lv');
});

test('sanitizeMailHtml removes scripts and event handlers while preserving simple markup', () => {
  const clean = sanitizeMailHtml('<p onclick="x()">Code <strong>123456</strong></p><script>alert(1)</script>');
  assert.strictEqual(clean, '<p>Code <strong>123456</strong></p>');
});

test('extractVerificationCode returns likely confirmation code', () => {
  assert.strictEqual(extractVerificationCode('Ваш код подтверждения: 482 913'), '482913');
  assert.strictEqual(extractVerificationCode('Order #123, code 998877, phone 37126198525'), '998877');
});

test('mapParsedMessage creates stable duplicate key and sanitized payload', () => {
  const parsed = {
    messageId: '<abc@example.com>',
    from: { text: 'Sender <sender@example.com>' },
    to: { text: 'alstrix1023@heysmart.lv', value: [{ address: 'alstrix1023@heysmart.lv' }] },
    subject: 'Verify',
    text: 'Code 123456',
    html: '<b>Code 123456</b><img src="https://example.com/a.png"><script>x()</script>',
    date: new Date('2026-06-25T10:00:00.000Z'),
    headers: headers([]),
  };
  const mapped = mapParsedMessage(parsed, {
    accountId: 'account-1',
    email: 'alstrix1023@heysmart.lv',
    fallbackMessageId: 'uid-42',
  });
  assert.strictEqual(mapped.accountId, 'account-1');
  assert.strictEqual(mapped.email, 'alstrix1023@heysmart.lv');
  assert.strictEqual(mapped.messageId, '<abc@example.com>');
  assert.strictEqual(mapped.verificationCode, '123456');
  assert.strictEqual(mapped.html, '<b>Code 123456</b><img src="https://example.com/a.png" />');
  assert.strictEqual(mapped.receivedAt.toISOString(), '2026-06-25T10:00:00.000Z');
  assert.strictEqual(mapped.isRead, false);
});

test('createMailAccount requires admin-provided password and stores its hash', async () => {
  let inserted = null;
  const fakeDb = {
    collection() {
      return {
        async insertOne(doc) {
          inserted = doc;
          inserted._id = 'account-1';
        },
      };
    },
  };
  await assert.rejects(
    () => createMailAccount(fakeDb, 'client1', ''),
    /Password is required/
  );
  const result = await createMailAccount(fakeDb, 'client1', 'ManualPass123');
  assert.strictEqual(result.account.email, 'client1@heysmart.lv');
  assert.strictEqual(result.password, 'ManualPass123');
  assert.strictEqual(await bcrypt.compare('ManualPass123', inserted.passwordHash), true);
});

test('changeMailPassword stores admin-provided password hash', async () => {
  let update = null;
  const fakeDb = {
    collection() {
      return {
        async findOneAndUpdate(query, patch) {
          update = { query, patch };
          return {
            _id: 'account-1',
            email: 'client1@heysmart.lv',
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
          };
        },
      };
    },
  };
  await assert.rejects(
    () => changeMailPassword(fakeDb, '507f1f77bcf86cd799439011', 'short'),
    /at least 8 characters/
  );
  const result = await changeMailPassword(fakeDb, '507f1f77bcf86cd799439011', 'NewManual123');
  assert.strictEqual(result.password, 'NewManual123');
  assert.strictEqual(await bcrypt.compare('NewManual123', update.patch.$set.passwordHash), true);
});

test('IMAP client uses explicit bounded timeouts', () => {
  const options = imapClientOptions({ IMAP_USER: 'user', IMAP_PASSWORD: 'pass' });
  assert.strictEqual(options.connectionTimeout, IMAP_CONNECTION_TIMEOUT_MS);
  assert.strictEqual(options.greetingTimeout, IMAP_GREETING_TIMEOUT_MS);
  assert.strictEqual(options.socketTimeout, IMAP_SOCKET_TIMEOUT_MS);
  assert.strictEqual(options.socketTimeout, 30000);
  assert.strictEqual(options.disableCompression, true);
  assert.strictEqual(options.disableAutoEnable, true);
});

test('IMAP diagnostics are disabled unless explicitly enabled', () => {
  assert.strictEqual(imapDiagnosticsEnabled({}), false);
  assert.strictEqual(imapDiagnosticsEnabled({ MAIL_IMAP_DIAGNOSTICS: 'false' }), false);
  assert.strictEqual(imapDiagnosticsEnabled({ MAIL_IMAP_DIAGNOSTICS: 'true' }), true);
  assert.strictEqual(imapClientOptions({}).emitLogs, false);
  assert.strictEqual(imapClientOptions({ MAIL_IMAP_DIAGNOSTICS: 'true' }, true).emitLogs, true);
});

test('IMAP diagnostic markers never include command payloads or credentials', () => {
  const secret = 'never-log-this-password';
  assert.deepStrictEqual(imapLogMarker({ src: 'auth', msg: 'User authenticated' }), { phase: 'authentication-completed', direction: 'received', kind: 'lifecycle' });
  assert.deepStrictEqual(imapLogMarker({ src: 'c', msg: `A1 AUTHENTICATE user@example.com ${secret}` }), { phase: 'imap-command-AUTHENTICATE', direction: 'sent', kind: 'command' });
  assert.deepStrictEqual(imapLogMarker({ src: 's', msg: '* NAMESPACE (("" "/")) NIL NIL' }), { phase: 'imap-command-NAMESPACE', direction: 'received', kind: 'untagged-response' });
  assert.deepStrictEqual(imapLogMarker({ src: 'c', msg: `A1 FETCH 1 BODY[] ${secret}` }), { phase: 'imap-command-FETCH', direction: 'sent', kind: 'command' });
  assert.deepStrictEqual(imapLogMarker({ src: 's', msg: '* 1 FETCH (UID 1)' }), { phase: 'imap-command-FETCH', direction: 'received', kind: 'untagged-response' });
});

test('persistent IMAP manager reuses a usable client and reconnects after close or unusable state', async () => {
  let created = 0;
  const clients = [];
  const manager = createPersistentImapConnectionManager({
    env: {},
    createClient: () => {
      created++;
      const client = new EventEmitter();
      client.usable = true;
      client.isClosed = false;
      client.socket = { destroyed: false };
      client.close = () => { client.isClosed = true; client.socket.destroyed = true; client.emit('close'); };
      client.logout = async () => {};
      clients.push(client);
      return client;
    },
  });
  const diagnostics = { enabled: false, log() {} };
  const first = await manager.getClient(diagnostics);
  const second = await manager.getClient(diagnostics);
  assert.strictEqual(created, 1);
  assert.strictEqual(first.reused, false);
  assert.strictEqual(second.reused, true);
  clients[0].emit('close');
  const third = await manager.getClient(diagnostics);
  assert.strictEqual(created, 2);
  assert.strictEqual(third.reused, false);
  clients[1].usable = false;
  const fourth = await manager.getClient(diagnostics);
  assert.strictEqual(created, 3);
  assert.strictEqual(fourth.reused, false);
});

test('persistent IMAP manager logs out and closes its client during graceful shutdown', async () => {
  let loggedOut = false;
  let closed = false;
  const manager = createPersistentImapConnectionManager({
    env: {},
    createClient: () => {
      const client = new EventEmitter();
      client.usable = true;
      client.isClosed = false;
      client.socket = { destroyed: false };
      client.logout = async () => { loggedOut = true; };
      client.close = () => { closed = true; client.emit('close'); };
      return client;
    },
  });
  await manager.getClient({ enabled: false, log() {} });
  await manager.shutdown();
  assert.strictEqual(loggedOut, true);
  assert.strictEqual(closed, true);
});

test('mail sync coordinator prevents overlapping manual sync while background sync runs', async () => {
  let release;
  const coordinator = createMailSyncCoordinator({
    db: {},
    env: {},
    intervalMs: 12000,
    sync: async () => new Promise(resolve => { release = resolve; }),
  });
  const background = coordinator.run('interval');
  assert.strictEqual(coordinator.isRunning(), true);
  assert.deepStrictEqual(await coordinator.run('manual'), { ok: false, inProgress: true });
  release({ ok: true, saved: 0, skipped: 0, fetched: 0, matched: 0 });
  await background;
  assert.strictEqual(coordinator.isRunning(), false);
});

test('mail sync coordinator releases its lock after failure', async () => {
  let attempts = 0;
  const coordinator = createMailSyncCoordinator({
    db: {}, env: {}, intervalMs: 12000,
    sync: async () => {
      attempts++;
      if (attempts === 1) throw new Error('temporary IMAP failure');
      return { ok: true, saved: 0, skipped: 0, fetched: 0, matched: 0 };
    },
  });
  await assert.rejects(() => coordinator.run('interval'), /temporary IMAP failure/);
  assert.strictEqual(coordinator.isRunning(), false);
  assert.strictEqual((await coordinator.run('interval')).ok, true);
});

test('poll timeout closes IMAP client and coordinator lock is released', async () => {
  let closed = false;
  const client = {
    usable: false,
    connect: () => new Promise(() => {}),
    close: () => { closed = true; },
  };
  const coordinator = createMailSyncCoordinator({
    db: {},
    env: { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' },
    intervalMs: 12000,
    sync: (db, env, options) => pollInboxOnce(db, env, {
      ...options,
      timeoutMs: 20,
      createClient: () => client,
    }),
  });
  await assert.rejects(() => coordinator.run('interval'), err => err.code === 'MAIL_SYNC_TIMEOUT');
  assert.strictEqual(closed, true);
  assert.strictEqual(coordinator.isRunning(), false);
});
