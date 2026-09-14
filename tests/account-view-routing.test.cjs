const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'account-view-routing.js'), 'utf8');
assert.doesNotThrow(() => new vm.Script(source, { filename: 'account-view-routing.js' }));

const sandbox = {
  accountsView: 'subs',
  isCancelledSub(sub) {
    return ['cancelled', 'canceled', 'annulled', 'off'].includes(String(sub?.status || '').trim().toLowerCase());
  },
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const active = { status: 'active', tel: '', startDate: '', hostProvider: '' };
const inactive = { status: 'not active', tel: '+37100000000', startDate: '14.09.2026', hostProvider: 'host@example.com' };
const cancelled = { status: 'cancelled', tel: '+37111111111', startDate: '01.01.2026', hostProvider: 'host@example.com' };

sandbox.accountsView = 'subs';
assert.equal(sandbox.subFitsAccountsView(active), true, 'active must be in Subscribers');
assert.equal(sandbox.subFitsAccountsView(inactive), false, 'not active must not be in Subscribers');
assert.equal(sandbox.subFitsAccountsView(cancelled), false, 'cancelled must not be in Subscribers');

sandbox.accountsView = 'new';
assert.equal(sandbox.subFitsAccountsView(active), false, 'active must not be in New');
assert.equal(sandbox.subFitsAccountsView(inactive), true, 'not active must be in New regardless of phone/date/host');
assert.equal(sandbox.subFitsAccountsView(cancelled), false, 'cancelled must not be in New');

sandbox.accountsView = 'cancelled';
assert.equal(sandbox.subFitsAccountsView(active), false, 'active must not be in Cancelled');
assert.equal(sandbox.subFitsAccountsView(inactive), false, 'not active must not be in Cancelled');
assert.equal(sandbox.subFitsAccountsView(cancelled), true, 'cancelled must be in Cancelled');

assert.equal(sandbox.isNewUnassignedSub(inactive), true, 'New classification must depend on not active status');
assert.equal(sandbox.isNewUnassignedSub(active), false, 'active is not New');

console.log('account-view-routing.test.cjs: OK');
