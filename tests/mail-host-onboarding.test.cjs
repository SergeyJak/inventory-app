const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.doesNotThrow(() => new vm.Script(app, { filename: 'app.js' }));

assert.match(html, /id="mail-purpose"/, 'mail creation must expose a purpose selector');
assert.match(html, /value="host"/, 'mail purpose must support Host');
assert.match(html, /value="subscriber"/, 'mail purpose must support Subscriber');
assert.match(html, /id="mail-host-renewal-date"/, 'Host onboarding must support renewal date');

assert.match(app, /function createHostFromMailbox\(/, 'mail onboarding must be able to create a host');
assert.match(app, /findHostSubscriptionByEmail\(email\)/, 'Host creation must guard against duplicates');
assert.match(app, /hostMail:\s*String\(email/, 'created host must reuse the mailbox email');
assert.match(app, /password:\s*String\(password/, 'created host must reuse the supplied password');
assert.match(app, /purpose === 'host'/, 'mail creation must handle Host purpose');
assert.match(app, /purpose === 'subscriber'/, 'mail creation must handle Subscriber purpose');
assert.match(app, /connectMailAccount\(createdAccount\._id\)/, 'Subscriber purpose must continue into Connect flow');
assert.match(app, /makeMailAccountHost\(/, 'existing mailboxes must support Make host');
assert.match(app, /This mailbox is already a host/, 'existing Hosts must not be duplicated');
assert.match(app, /title="This mailbox is a host">HOST</, 'mail table must visibly identify host mailboxes');

console.log('mail-host-onboarding.test.cjs: OK');
