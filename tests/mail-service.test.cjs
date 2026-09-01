const assert = require('assert');
const { EventEmitter } = require('events');

const {
  changeMailPassword,
  createMailIdleController,
  createImapCommandLedger,
  createMailSyncCoordinator,
  createPersistentImapConnectionManager,
  createMailAccount,
  extractVerificationCode,
  findOriginalRecipient,
  imapDiagnosticsEnabled,
  imapCommandDiagnosticEnabled,
  imapLogMarker,
  imapClientOptions,
  IMAP_CONNECTION_TIMEOUT_MS,
  IMAP_GREETING_TIMEOUT_MS,
  IMAP_SOCKET_TIMEOUT_MS,
  MAIL_SYNC_BOOTSTRAP_TIMEOUT_MS,
  mailPollIntervalMs,
  mailSyncDeadlineMs,
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

function checkpointTestDb({ checkpoint = null, accounts = [{ _id: 'account-1', email: 'client@heysmart.lv', active: true }], checkpointUpdateError = null, messageUpdateError = null, initialRaceCheckpoint = null, duplicateKeyRaceCheckpoint = null } = {}) {
  const state = { checkpoint, messages: [], calls: [] };
  return {
    state,
    collection(name) {
      if (name === 'mail_sync_checkpoints') return {
        findOne: async () => state.checkpoint,
        insertOne: async doc => { state.checkpoint = { ...doc }; },
        updateOne: async (filter, patch, options = {}) => {
          if (checkpointUpdateError) throw checkpointUpdateError;
          state.calls.push({ name, filter, patch });
          if (!state.checkpoint) {
            if (options.upsert) {
              if (duplicateKeyRaceCheckpoint) {
                state.checkpoint = { ...duplicateKeyRaceCheckpoint };
                const err = new Error('duplicate key');
                err.code = 11000;
                throw err;
              }
              if (initialRaceCheckpoint) {
                state.checkpoint = { ...initialRaceCheckpoint };
                return { matchedCount: 1, upsertedCount: 0 };
              }
              state.checkpoint = { ...(patch.$setOnInsert || {}) };
              return { matchedCount: 0, upsertedCount: 1 };
            }
            return { matchedCount: 0 };
          }
          Object.assign(state.checkpoint, patch.$set || {});
          for (const key of Object.keys(patch.$unset || {})) delete state.checkpoint[key];
          return { matchedCount: 1, upsertedCount: 0 };
        },
        createIndex: async () => 'checkpoint-index',
      };
      if (name === 'mail_accounts') return {
        findOne: async query => accounts.find(account => account.email === query.email && account.active === query.active) || null,
      };
      if (name === 'mail_messages') return {
        updateOne: async (query, patch) => {
          if (messageUpdateError) throw messageUpdateError;
          const existing = state.messages.find(message => message.accountId === query.accountId && message.messageId === query.messageId);
          if (existing) {
            Object.assign(existing, patch.$set || {});
            return { upsertedCount: 0 };
          }
          state.messages.push({ ...(patch.$setOnInsert || {}), ...(patch.$set || {}) });
          return { upsertedCount: 1 };
        },
      };
      return { createIndex: async () => 'index' };
    },
  };
}

function uidClient({ uidValidity = 1n, uidNext = 1, searchResults = [], fetched = [], fetchError = null } = {}) {
  const calls = { status: 0, search: [], fetch: [] };
  return {
    calls,
    usable: true,
    mailbox: { uidValidity, uidNext },
    getMailboxLock: async () => ({ release() {} }),
    status: async () => { calls.status++; return { uidValidity, uidNext }; },
    search: async query => { calls.search.push(query); return typeof searchResults === 'function' ? searchResults(query) : searchResults; },
    fetch: async function* (uids) {
      calls.fetch.push([...uids]);
      if (fetchError) throw fetchError;
      for (const message of fetched) yield message;
    },
  };
}

function reusedManager(client) {
  return { getClient: async () => ({ client, reused: true }), usable: () => true, invalidate() {} };
}

function idleClient() {
  const client = new EventEmitter();
  client.usable = true;
  client.isClosed = false;
  client.socket = { destroyed: false };
  client.logout = async () => {};
  client.close = () => { client.isClosed = true; client.socket.destroyed = true; client.emit('close'); };
  client.idle = () => new Promise(() => {});
  return client;
}

async function flushAsync() {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

function parsedClientMessage(uid, recipient = 'client@heysmart.lv', messageId = `<${uid}@mail>`) {
  return {
    uid,
    source: Buffer.from(`To: ${recipient}\r\nMessage-ID: ${messageId}\r\n\r\nHello`),
  };
}

async function parseTestMessage(source) {
  const raw = String(source);
  const uid = (raw.match(/<([^>]+)>/) || [])[1] || 'message@mail';
  const recipient = (raw.match(/To:\s*([^\r\n]+)/i) || [])[1] || '';
  return {
    messageId: `<${uid}>`,
    to: { text: recipient, value: [{ address: recipient }] },
    from: { text: 'sender@example.com' },
    subject: 'Test', text: 'Hello', html: '', date: new Date(), headers: headers([]),
  };
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
  assert.strictEqual(options.disableAutoIdle, true);
});

test('IMAP diagnostics are disabled unless explicitly enabled', () => {
  assert.strictEqual(imapDiagnosticsEnabled({}), false);
  assert.strictEqual(imapDiagnosticsEnabled({ MAIL_IMAP_DIAGNOSTICS: 'false' }), false);
  assert.strictEqual(imapDiagnosticsEnabled({ MAIL_IMAP_DIAGNOSTICS: 'true' }), true);
  assert.strictEqual(imapClientOptions({}).emitLogs, false);
  assert.strictEqual(imapClientOptions({ MAIL_IMAP_DIAGNOSTICS: 'true' }, true).emitLogs, true);
});

test('IMAP command ledger correlates tags and DONE with the active IDLE command without payloads', () => {
  const lines = [];
  const ledger = createImapCommandLedger({ enabled: true, log: (_phase, data) => lines.push(data) });
  ledger.onLog({ src: 'c', msg: 'A1 IDLE', t: 1 });
  ledger.onLog({ src: 's', msg: '+ idling', t: 2 });
  ledger.onLog({ src: 'c', msg: 'DONE', t: 2 });
  ledger.onLog({ src: 's', msg: 'A1 OK IDLE terminated', t: 3 });
  ledger.onLog({ src: 'c', msg: 'A2 UID SEARCH UID 999:*', t: 4 });
  ledger.onLog({ src: 's', msg: '* SEARCH', t: 5 });
  ledger.onLog({ src: 's', msg: 'A2 OK SEARCH done', t: 6 });
  assert.deepStrictEqual(lines.map(line => [line.command, line.tag, line.state]), [
    ['IDLE', 'A1', 'sent'], ['IDLE', 'A1', 'accepted'], ['DONE', 'A1', 'sent'],
    ['IDLE', 'A1', 'completed'], ['SEARCH', 'A2', 'sent'], ['SEARCH', 'A2', 'completed'],
  ]);
  const idleCompletion = lines.find(line => line.command === 'IDLE' && line.state === 'completed');
  assert.ok(idleCompletion.idleDoneToCompletionMs >= 0);
  assert.strictEqual(idleCompletion.queueWaitMs, null);
  assert.strictEqual(idleCompletion.resolveLagMs, null);
  assert.ok(!JSON.stringify(lines).includes('999:*'));
  assert.strictEqual(imapCommandDiagnosticEnabled({}), false);
  assert.strictEqual(imapCommandDiagnosticEnabled({ MAIL_IMAP_COMMAND_DIAGNOSTIC: 'true' }), true);
});

test('IMAP diagnostic markers never include command payloads or credentials', () => {
  const secret = 'never-log-this-password';
  assert.deepStrictEqual(imapLogMarker({ src: 'auth', msg: 'User authenticated' }), { phase: 'authentication-completed', direction: 'received', kind: 'lifecycle' });
  assert.deepStrictEqual(imapLogMarker({ src: 'c', msg: `A1 AUTHENTICATE user@example.com ${secret}` }), { phase: 'imap-command-AUTHENTICATE', direction: 'sent', kind: 'command' });
  assert.deepStrictEqual(imapLogMarker({ src: 's', msg: '* NAMESPACE (("" "/")) NIL NIL' }), { phase: 'imap-command-NAMESPACE', direction: 'received', kind: 'untagged-response' });
  assert.deepStrictEqual(imapLogMarker({ src: 'c', msg: `A1 FETCH 1 BODY[] ${secret}` }), { phase: 'imap-command-FETCH', direction: 'sent', kind: 'command' });
  assert.deepStrictEqual(imapLogMarker({ src: 's', msg: '* 1 FETCH (UID 1)' }), { phase: 'imap-command-FETCH', direction: 'received', kind: 'untagged-response' });
});

test('first legacy migration creates a UIDNEXT-safe unread-only baseline', async () => {
  const db = checkpointTestDb();
  const client = uidClient({ uidNext: 101, searchResults: [99], fetched: [parsedClientMessage(99)] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 100);
  assert.strictEqual(db.state.checkpoint.legacyBaselineUid, 100);
  assert.strictEqual(db.state.messages.length, 1);
  assert.deepStrictEqual(client.calls.search[0], { uid: '1:100', seen: false });
  assert.strictEqual(db.state.calls.filter(call => call.name === 'mail_sync_checkpoints').length, 1);
});

test('steady poll ingests Gmail-Seen messages above the baseline and avoids STATUS', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 100, mode: 'post-legacy-baseline' } });
  const client = uidClient({ uidNext: 102, searchResults: [101], fetched: [parsedClientMessage(101)] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.deepStrictEqual(client.calls.search[0], { uid: '101:*' });
  assert.strictEqual(client.calls.status, 0);
  assert.deepStrictEqual(client.calls.fetch[0], [101]);
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 101);
  assert.strictEqual(db.state.messages[0].imapUid, 101);
});

test('inclusive checkpoint 65 filters a stale UID 65 result without fetching or processing it', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 65 } });
  const client = uidClient({ searchResults: [65] });
  const searches = [];
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, {
    connectionManager: reusedManager(client), parser: parseTestMessage,
    onProgress(event, data) { if (event === 'uid-search') searches.push(data); },
  });
  assert.deepStrictEqual(client.calls.search[0], { uid: '66:*' });
  assert.strictEqual(searches[0].requestedFromUid, 66);
  assert.strictEqual(searches[0].rawFoundCount, 1);
  assert.strictEqual(searches[0].candidateFoundCount, 0);
  assert.strictEqual(searches[0].rawMinUid, 65);
  assert.strictEqual(searches[0].rawMaxUid, 65);
  assert.strictEqual(client.calls.fetch.length, 0);
  assert.strictEqual(db.state.messages.length, 0);
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 65);
});

test('steady UID filtering fetches only candidates above the inclusive checkpoint', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 65 } });
  const client = uidClient({ searchResults: [65, 66], fetched: [parsedClientMessage(66)] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, {
    connectionManager: reusedManager(client), parser: parseTestMessage,
  });
  assert.deepStrictEqual(client.calls.fetch[0], [66]);
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 66);
});

test('steady UID filtering fetches and advances an exact next UID candidate', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 65 } });
  const client = uidClient({ searchResults: [66], fetched: [parsedClientMessage(66)] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, {
    connectionManager: reusedManager(client), parser: parseTestMessage,
  });
  assert.deepStrictEqual(client.calls.fetch[0], [66]);
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 66);
});

test('steady UID filtering ignores only-stale results below or at the checkpoint', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 65 } });
  const client = uidClient({ searchResults: [64, 65] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, {
    connectionManager: reusedManager(client), parser: parseTestMessage,
  });
  assert.strictEqual(client.calls.fetch.length, 0);
  assert.strictEqual(db.state.messages.length, 0);
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 65);
});

test('legacy baseline B-1 and restart/reconnect checkpoints resume from B/P+1', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 65, legacyBaselineUid: 65 } });
  for (const client of [uidClient({ searchResults: [] }), uidClient({ searchResults: [] })]) {
    await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
    assert.deepStrictEqual(client.calls.search[0], { uid: '66:*' });
  }
});

test('legacy checkpoint initialization is idempotent and preserves a concurrent newer checkpoint', async () => {
  const newer = { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 65, legacyBaselineUid: 65, mode: 'post-legacy-baseline' };
  const db = checkpointTestDb({ initialRaceCheckpoint: newer });
  const client = uidClient({ uidNext: 11, searchResults: [], fetched: [] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 65);
  assert.strictEqual(db.state.calls.filter(call => call.name === 'mail_sync_checkpoints').length, 1);
});

test('duplicate-key initialization race loads and preserves the winner', async () => {
  const winner = { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 77, legacyBaselineUid: 77, mode: 'post-legacy-baseline' };
  const db = checkpointTestDb({ duplicateKeyRaceCheckpoint: winner });
  const client = uidClient({ uidNext: 11, searchResults: [] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 77);
});

test('steady UID polls skip FETCH for empty results and handle UID gaps in ascending order', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 100 } });
  const emptyClient = uidClient({ searchResults: [] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(emptyClient), parser: parseTestMessage });
  assert.strictEqual(emptyClient.calls.fetch.length, 0);

  const client = uidClient({ searchResults: [101, 103], fetched: [parsedClientMessage(103), parsedClientMessage(101)] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 103);
  assert.deepStrictEqual(db.state.messages.map(message => message.imapUid).sort((a, b) => a - b), [101, 103]);
});

test('duplicate, unknown recipient, and successful omitted UID are terminal checkpoint outcomes', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 100 } });
  db.state.messages.push({ accountId: 'account-1', messageId: '<101@mail>' });
  const client = uidClient({ searchResults: [101, 102, 103], fetched: [parsedClientMessage(101), parsedClientMessage(102, 'unknown@heysmart.lv')] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 103);
  assert.strictEqual(db.state.messages[0].imapUid, 101);
});

test('parse failure stops advancement and checkpoint write failure safely retries', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 100 } });
  const client = uidClient({ searchResults: [101, 102], fetched: [parsedClientMessage(101), parsedClientMessage(102)] });
  await assert.rejects(
    () => pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, {
      connectionManager: reusedManager(client),
      parser: async source => String(source).includes('102@mail>') ? Promise.reject(new Error('parse failed')) : parseTestMessage(source),
    }),
    /parse failed/
  );
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 101);
});

test('Mongo and checkpoint write failures do not advance the UID checkpoint', async () => {
  const checkpoint = { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 100 };
  const messageFailureDb = checkpointTestDb({ checkpoint: { ...checkpoint }, messageUpdateError: new Error('mongo failed') });
  const client = uidClient({ searchResults: [101], fetched: [parsedClientMessage(101)] });
  await assert.rejects(
    () => pollInboxOnce(messageFailureDb, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage }),
    /mongo failed/
  );
  assert.strictEqual(messageFailureDb.state.checkpoint.lastProcessedUid, 100);

  const checkpointFailureDb = checkpointTestDb({ checkpoint: { ...checkpoint }, checkpointUpdateError: new Error('checkpoint failed') });
  await assert.rejects(
    () => pollInboxOnce(checkpointFailureDb, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage }),
    /checkpoint failed/
  );
  assert.strictEqual(checkpointFailureDb.state.checkpoint.lastProcessedUid, 100);
});

test('failed UID FETCH does not classify missing messages as expunged', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 100 } });
  const client = uidClient({ searchResults: [101], fetchError: new Error('fetch failed') });
  await assert.rejects(
    () => pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage }),
    /fetch failed/
  );
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 100);
});

test('UIDVALIDITY recovery searches all UIDs and never uses Seen-only filtering', async () => {
  const db = checkpointTestDb({ checkpoint: { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 80 } });
  const client = uidClient({ uidValidity: 2n, uidNext: 4, searchResults: query => query.uid === '1:3' ? [1, 2, 3] : [], fetched: [parsedClientMessage(1), parsedClientMessage(2), parsedClientMessage(3)] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.deepStrictEqual(client.calls.search[0], { uid: '1:3' });
  assert.strictEqual(client.calls.status, 1);
  assert.strictEqual(db.state.checkpoint.recoveryUidValidity, '2');
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.strictEqual(db.state.checkpoint.uidValidity, '2');
  assert.strictEqual(db.state.checkpoint.lastProcessedUid, 3);
});

test('UIDVALIDITY recovery batches resume from their inclusive next UID without refetching the prior prefix', async () => {
  const db = checkpointTestDb({ checkpoint: {
    source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 50,
    recoveryUidValidity: '2', recoveryBoundaryUid: 6, recoveryNextUid: 4,
  } });
  const client = uidClient({ uidValidity: 2n, searchResults: [4, 5], fetched: [parsedClientMessage(5), parsedClientMessage(4)] });
  await pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: reusedManager(client), parser: parseTestMessage });
  assert.deepStrictEqual(client.calls.search[0], { uid: '4:5' });
  assert.strictEqual(db.state.checkpoint.recoveryNextUid, 6);
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

test('IDLE exists notifications trigger one coalesced sync through the existing coordinator', async () => {
  const client = idleClient();
  const manager = createPersistentImapConnectionManager({ env: {}, createClient: () => client });
  const triggers = [];
  const coordinator = createMailSyncCoordinator({
    db: {}, env: {}, intervalMs: 120000,
    sync: async (_db, _env, options) => { triggers.push(options.trigger); return { ok: true }; },
  });
  const controller = createMailIdleController({ connectionManager: manager, coordinator, log() {} });
  await manager.getClient({ enabled: false, log() {} });
  client.emit('exists', { count: 2, prevCount: 1 });
  client.emit('exists', { count: 3, prevCount: 2 });
  await flushAsync();
  assert.deepStrictEqual(triggers, ['idle']);
  controller.shutdown();
});

test('one-shot IMAP command benchmark is explicitly gated and runs through the coordinator without ingestion', async () => {
  const client = idleClient();
  client.mailbox = { uidNext: 2, path: 'INBOX' };
  let lockCount = 0;
  let noopCount = 0;
  let searchCount = 0;
  let fetchCount = 0;
  client.getMailboxLock = async () => ({ release() { lockCount++; } });
  client.noop = async () => { noopCount++; };
  client.search = async () => { searchCount++; return []; };
  client.fetch = async function* () { fetchCount++; };
  const manager = createPersistentImapConnectionManager({ env: {}, createClient: () => client });
  const triggers = [];
  const coordinator = createMailSyncCoordinator({
    db: {}, env: {}, intervalMs: 120000,
    sync: async (_db, _env, options) => { triggers.push(options.trigger); return { ok: true }; },
  });
  const output = [];
  const controller = createMailIdleController({
    connectionManager: manager, coordinator, env: { MAIL_IMAP_COMMAND_DIAGNOSTIC: 'true' },
    log: (...parts) => output.push(parts),
  });
  await manager.getClient({ enabled: false, log() {} });
  await coordinator.run('startup');
  for (let i = 0; i < 4; i++) await flushAsync();
  assert.deepStrictEqual(triggers, ['startup']);
  assert.strictEqual(noopCount, 3);
  assert.strictEqual(searchCount, 3);
  assert.strictEqual(fetchCount, 3);
  assert.strictEqual(lockCount, 1);
  assert.ok(output.some(parts => parts[0] === '[mail-imap-benchmark-summary]'));
  controller.shutdown();
});

test('IDLE notification during a sync schedules exactly one follow-up catch-up', async () => {
  const client = idleClient();
  const manager = createPersistentImapConnectionManager({ env: {}, createClient: () => client });
  let release;
  const triggers = [];
  const coordinator = createMailSyncCoordinator({
    db: {}, env: {}, intervalMs: 120000,
    sync: async (_db, _env, options) => {
      triggers.push(options.trigger);
      if (triggers.length === 1) await new Promise(resolve => { release = resolve; });
      return { ok: true };
    },
  });
  const controller = createMailIdleController({ connectionManager: manager, coordinator, log() {} });
  await manager.getClient({ enabled: false, log() {} });
  client.emit('exists', { count: 2, prevCount: 1 });
  await flushAsync();
  client.emit('exists', { count: 3, prevCount: 2 });
  client.emit('exists', { count: 4, prevCount: 3 });
  release();
  await flushAsync();
  assert.deepStrictEqual(triggers, ['idle', 'idle']);
  controller.shutdown();
});

test('IDLE controller ignores stale-generation events and removes listeners on shutdown', async () => {
  const clients = [];
  const manager = createPersistentImapConnectionManager({ env: {}, createClient: () => { const client = idleClient(); clients.push(client); return client; } });
  let runs = 0;
  const coordinator = createMailSyncCoordinator({ db: {}, env: {}, intervalMs: 120000, sync: async () => { runs++; return { ok: true }; } });
  const controller = createMailIdleController({ connectionManager: manager, coordinator, log() {} });
  await manager.getClient({ enabled: false, log() {} });
  manager.invalidate('test-reconnect');
  clients[0].emit('exists', { count: 2, prevCount: 1 });
  await flushAsync();
  assert.strictEqual(runs, 1);
  await manager.getClient({ enabled: false, log() {} });
  controller.shutdown();
  assert.strictEqual(clients[1].listenerCount('exists'), 0);
});

test('IDLE fallback default is two minutes while explicit poll interval overrides it', () => {
  assert.strictEqual(mailPollIntervalMs({}), 120000);
  assert.strictEqual(mailPollIntervalMs({ MAIL_POLL_INTERVAL_MS: '15000' }), 15000);
});

test('persistent bootstrap uses a longer deadline while reused polls retain the normal deadline', () => {
  assert.strictEqual(mailSyncDeadlineMs({ persistent: true, connectionMode: 'new' }), MAIL_SYNC_BOOTSTRAP_TIMEOUT_MS);
  assert.strictEqual(mailSyncDeadlineMs({ persistent: true, connectionMode: 'reused' }), 40000);
  assert.strictEqual(mailSyncDeadlineMs({ persistent: true, connectionMode: 'new', timeoutMs: 20 }), 20);
});

test('successful bootstrap client survives and is reused by the second poll', async () => {
  let created = 0;
  let connected = 0;
  const deadlineEvents = [];
  const client = new EventEmitter();
  client.usable = true;
  client.isClosed = false;
  client.socket = { destroyed: false };
  client.mailbox = { uidValidity: 1n, uidNext: 1 };
  client.connect = async () => { connected++; };
  client.getMailboxLock = async () => ({ release() {} });
  client.status = async () => ({ uidValidity: 1n, uidNext: 1 });
  client.search = async () => [];
  client.fetch = async function* () {};
  client.close = () => { client.isClosed = true; client.socket.destroyed = true; client.emit('close'); };
  client.logout = async () => {};
  const manager = createPersistentImapConnectionManager({
    env: {},
    createClient: () => { created++; return client; },
  });
  let checkpoint = null;
  const db = {
    collection(name) {
      if (name === 'mail_sync_checkpoints') return {
        findOne: async () => checkpoint,
        insertOne: async doc => { checkpoint = doc; },
        updateOne: async (filter, patch, options = {}) => {
          if (!checkpoint && options.upsert) {
            checkpoint = { ...(patch.$setOnInsert || {}) };
            return { matchedCount: 0, upsertedCount: 1 };
          }
          return { matchedCount: 1, upsertedCount: 0 };
        },
      };
      return {};
    },
  };
  const env = { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' };
  await pollInboxOnce(db, env, {
    connectionManager: manager,
    onProgress(event, data) { if (event === 'deadline') deadlineEvents.push(data); },
  });
  await pollInboxOnce(db, env, {
    connectionManager: manager,
    onProgress(event, data) { if (event === 'deadline') deadlineEvents.push(data); },
  });
  assert.strictEqual(created, 1);
  assert.strictEqual(connected, 1);
  assert.deepStrictEqual(deadlineEvents.map(event => [event.connectionMode, event.deadlineMs]), [
    ['new', MAIL_SYNC_BOOTSTRAP_TIMEOUT_MS],
    ['reused', 40000],
  ]);
});

test('processing timeout preserves a healthy reused IMAP client after releasing its mailbox lock', async () => {
  let released = false;
  let closed = false;
  const client = new EventEmitter();
  client.usable = true;
  client.isClosed = false;
  client.socket = { destroyed: false };
  client.mailbox = { uidValidity: 1n, uidNext: 2 };
  client.getMailboxLock = async () => ({ release() { released = true; } });
  client.search = async () => [1];
  client.fetch = async function* () {
    yield { uid: 1, source: Buffer.from('To: client@heysmart.lv\r\n\r\nHello') };
  };
  client.close = () => { closed = true; client.isClosed = true; client.socket.destroyed = true; client.emit('close'); };
  client.logout = async () => {};
  const manager = createPersistentImapConnectionManager({ env: {}, createClient: () => client });
  await manager.getClient({ enabled: false, log() {} });
  const checkpoint = { source: 'gmail-primary', mailbox: 'INBOX', uidValidity: '1', lastProcessedUid: 0 };
  const db = {
    collection(name) {
      if (name === 'mail_sync_checkpoints') return {
        findOne: async () => checkpoint,
        updateOne: async () => ({ matchedCount: 1 }),
      };
      if (name === 'mail_accounts') return {
        findOne: async () => {
          assert.strictEqual(released, true);
          return new Promise(resolve => setTimeout(() => resolve(null), 30));
        },
      };
      return {};
    },
  };
  await assert.rejects(
    () => pollInboxOnce(db, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, {
      connectionManager: manager,
      timeoutMs: 10,
    }),
    err => err.code === 'MAIL_SYNC_TIMEOUT'
  );
  assert.strictEqual(released, true);
  assert.strictEqual(closed, false);
  assert.strictEqual((await manager.getClient({ enabled: false, log() {} })).reused, true);
});

test('IMAP operation failure invalidates the persistent client', async () => {
  let closed = false;
  let created = 0;
  const client = new EventEmitter();
  client.usable = true;
  client.isClosed = false;
  client.socket = { destroyed: false };
  client.getMailboxLock = async () => {
    const err = new Error('socket reset');
    err.code = 'ECONNRESET';
    throw err;
  };
  client.close = () => { closed = true; client.isClosed = true; client.socket.destroyed = true; client.emit('close'); };
  client.logout = async () => {};
  const replacement = new EventEmitter();
  replacement.usable = true;
  replacement.isClosed = false;
  replacement.socket = { destroyed: false };
  replacement.close = () => {};
  replacement.logout = async () => {};
  const manager = createPersistentImapConnectionManager({
    env: {},
    createClient: () => (++created === 1 ? client : replacement),
  });
  await manager.getClient({ enabled: false, log() {} });
  await assert.rejects(
    () => pollInboxOnce({}, { IMAP_USER: 'user', IMAP_PASSWORD: 'pass' }, { connectionManager: manager }),
    /socket reset/
  );
  assert.strictEqual(closed, true);
  assert.strictEqual((await manager.getClient({ enabled: false, log() {} })).reused, false);
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
