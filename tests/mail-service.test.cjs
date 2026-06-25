const assert = require('assert');

const {
  createMailAccount,
  extractVerificationCode,
  findOriginalRecipient,
  mapParsedMessage,
  normalizeMailEmail,
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
