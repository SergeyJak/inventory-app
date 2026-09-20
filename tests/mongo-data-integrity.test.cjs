const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const invoice = fs.readFileSync(path.join(root, 'finance-invoice.js'), 'utf8');

assert.doesNotThrow(() => new vm.Script(server), 'server.js must remain syntactically valid');
assert.doesNotThrow(() => new vm.Script(app), 'app.js must remain syntactically valid');

assert.match(server, /dataSnapshots:\s*'dataSnapshots'/, 'critical data snapshots must have a dedicated Mongo collection');
assert.match(server, /CRITICAL_DATA_KEYS = new Set\(\['products', 'transactions', 'andreyReturns', 'subAccounts', 'hostSubscriptions'\]\)/, 'all business-critical collections must be protected');
assert.match(server, /createDataSnapshot\(key, existing, options\.actor \|\| ''\)/, 'a snapshot must be created before generic critical-data replacement');
assert.match(server, /options\.expectedFingerprint !== currentFingerprint/, 'stale browser state must be rejected');
assert.match(server, /error\.code = 'STALE_DATA'/, 'stale-write rejection must have an explicit error code');
assert.match(server, /res\.status\(409\).*Data changed in another session/, 'stale writes must return HTTP 409');
assert.match(server, /res\.status\(428\).*Data version required/, 'unversioned Mongo writes must be rejected');
assert.match(server, /Post-write verification failed/, 'critical writes must be verified after persistence');
assert.match(server, /if \(existing\.length > 0\) await coll\.insertMany\(existing\)/, 'failed critical writes must restore the previous snapshot');
assert.match(server, /GENERIC_SAVE_BLOCKED_KEYS = new Set\([^\n]*'dataSnapshots'/, 'snapshot collection must not be writable through generic save');

assert.match(server, /app\.post\('\/api\/inventory\/movement'/, 'stock and transaction history must have a joint endpoint');
assert.match(server, /session\.withTransaction/, 'inventory movements must use a Mongo transaction');
assert.match(server, /productColl\.deleteMany\(\{\}, \{ session \}\)/, 'product replacement must participate in the transaction');
assert.match(server, /transactionColl\.deleteMany\(\{\}, \{ session \}\)/, 'transaction replacement must participate in the transaction');
assert.match(server, /Inventory movement post-write verification failed/, 'atomic inventory movement must be verified');

assert.match(app, /const _cacheMeta = \{\}/, 'browser must track server data versions');
assert.match(app, /const _persistChains = \{\}/, 'writes to the same collection must be serialized');
assert.match(app, /expectedFingerprint/, 'browser saves must send the expected Mongo fingerprint');
assert.match(app, /\/api\/inventory\/movement/, 'sale/restock/return must use the atomic movement endpoint');
assert.match(app, /async function recordSale\(\)/, 'sale flow must wait for atomic persistence');
assert.match(app, /async function recordRestock\(\)/, 'restock flow must wait for atomic persistence');
assert.match(app, /async function returnOneSaleItem\(txId\)/, 'return flow must wait for atomic persistence');
assert.doesNotMatch(app, /saveProducts\(products\);\s*const txs = loadTransactions\(\);\s*txs\.unshift\(\{ id: genId\(\), type: 'sale'/, 'sale must not save stock and history separately');

assert.match(invoice, /hostSubscriptionsFingerprint/, 'invoice settings must track the Host collection version');
assert.match(invoice, /expectedFingerprint: hostSubscriptionsFingerprint/, 'invoice settings save must be versioned');

const helperSource = [
  "const CRITICAL_DATA_KEYS = new Set(['products', 'transactions', 'andreyReturns', 'subAccounts', 'hostSubscriptions']);",
  server.match(/function canonicalValue\(value\) \{[\s\S]*?\n\}/)?.[0],
  server.match(/function datasetFingerprint\(rows\) \{[\s\S]*?\n\}/)?.[0],
  server.match(/function validateCriticalDataset\(key, rows\) \{[\s\S]*?\n\}/)?.[0],
].join('\n');
assert.ok(!helperSource.includes('undefined'), 'data-integrity helper functions must be extractable');

const sandbox = { Set, JSON, String, Number, Array, crypto };
vm.createContext(sandbox);
vm.runInContext(helperSource, sandbox);

const a = [{ id: 'b', lots: [{ qty: 1 }] }, { id: 'a', lots: [{ qty: 2 }] }];
const b = [a[1], a[0]];
assert.equal(
  sandbox.datasetFingerprint(a),
  sandbox.datasetFingerprint(b),
  'top-level document order must not change the dataset fingerprint'
);
assert.throws(
  () => sandbox.validateCriticalDataset('products', [{ id: 'x', lots: [] }, { id: 'x', lots: [] }]),
  /Duplicate id/,
  'duplicate ids must be rejected before Mongo write'
);
assert.throws(
  () => sandbox.validateCriticalDataset('products', [{ id: 'x', lots: [{ qty: -1 }] }]),
  /Invalid stock qty/,
  'negative stock must be rejected before Mongo write'
);

console.log('mongo-data-integrity.test.cjs: OK');
