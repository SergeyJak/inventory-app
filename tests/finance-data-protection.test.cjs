const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const match = source.match(/function mergeProtectedFinanceFields\(key, incoming, existing\) \{[\s\S]*?\n\}/);
assert.ok(match, 'mergeProtectedFinanceFields must exist');

const sandbox = { Map, Set, Array, String };
vm.createContext(sandbox);
vm.runInContext(match[0], sandbox);

const protect = sandbox.mergeProtectedFinanceFields;
assert.equal(typeof protect, 'function');

const storedSubs = [
  { id: 'a', email: 'a@example.com', financePayments: [{ id: 'p1', invoiceNo: 'HS-2026-001' }] },
  { id: 'b', email: 'b@example.com', financePayments: [{ id: 'p2', invoiceNo: 'HS-2026-002' }] },
];
const staleSubs = [
  { id: 'a', email: 'a-new@example.com' },
];
const mergedSubs = protect('subAccounts', staleSubs, storedSubs);

assert.deepEqual(
  JSON.parse(JSON.stringify(mergedSubs.find(row => row.id === 'a').financePayments)),
  [{ id: 'p1', invoiceNo: 'HS-2026-001' }],
  'editing an existing account must preserve its financePayments'
);
assert.ok(
  mergedSubs.some(row => row.id === 'b' && row.financePayments?.[0]?.invoiceNo === 'HS-2026-002'),
  'a stale full-save must not delete an omitted account that owns finance history'
);

const storedHosts = [
  { id: 'h1', hostMail: 'h@example.com', financeExpenses: [{ id: 'e1', amount: 10.2 }] },
];
const mergedHosts = protect('hostSubscriptions', [{ id: 'h1', hostMail: 'changed@example.com' }], storedHosts);
assert.deepEqual(
  JSON.parse(JSON.stringify(mergedHosts[0].financeExpenses)),
  [{ id: 'e1', amount: 10.2 }],
  'editing a Host must preserve financeExpenses'
);

const products = [{ id: 'x', value: 1 }];
assert.equal(protect('products', products, []), products, 'non-finance collections must not be changed');

console.log('finance-data-protection.test.cjs: OK');
