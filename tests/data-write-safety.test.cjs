const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { startServer } = require('./helpers/safety-server.cjs');
const { backupFixture } = require('./helpers/backup-fixture.cjs');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const fn = (name, text = source) => text.match(new RegExp('^(?:async )?function ' + name + '\\([^]*?^}', 'm'))[0];
const product = [{ id: 'p1', productType: 'Mini 3', lots: [{ qty: 2, buyPrice: 50 }], sellPrice: 100 }];

test('JSON responses let the real browser persistence function save changes', async () => {
  const s = await startServer();
  try {
    const data = await (await s.request('/api/data')).json();
    assert.equal(typeof data._meta?.fingerprints?.products, 'string');
    const sandbox = { _persistChains: {}, _cacheMeta: data._meta.fingerprints, Promise, console, showToast() {}, setTimeout() {}, location: { reload() {} }, authHeaders: () => ({}), fetch: (url, options) => s.request(url, { method: options.method, body: JSON.parse(options.body) }) };
    vm.runInNewContext(fn('_persist', client), sandbox);
    assert.equal(await sandbox._persist('products', product), true);
    assert.equal((await (await s.request('/api/data')).json()).products[0].lots[0].qty, 2);
  } finally { await s.close(); }
});

test('metadata describes the exact arrays returned even if storage changes between reads', async () => {
  let reads = 0;
  const sandbox = { crypto, USE_MONGO: true, ADMIN_ONLY_KEYS: [], CRITICAL_DATA_KEYS: new Set(['products']), console,
    dbGetAll: async () => ({ products: [{ id: 'p1', sellPrice: reads++ === 0 ? 100 : 120 }] }),
    requireInventoryHost() {}, requireAuth() {}, sendGenericError() {}, app: { get(p, ...handlers) { sandbox.route = handlers.at(-1); } },
  };
  vm.runInNewContext(fn('canonicalValue') + '\n' + fn('datasetFingerprint') + '\n' + fn('currentCriticalDataMeta'), sandbox);
  const start = source.indexOf("app.get('/api/data'");
  vm.runInNewContext(source.slice(start, source.indexOf('\n});', start) + 4), sandbox);
  let body; await sandbox.route({ user: { role: 'admin' } }, { json(data) { body = data; } });
  assert.equal(body.products[0].sellPrice, 100);
  assert.equal(body._meta.fingerprints.products, crypto.createHash('sha256').update('[{"id":"p1","sellPrice":100}]').digest('hex'));
});

test('malformed replacements and stale JSON writes leave existing stock unchanged', async () => {
  const s = await startServer();
  try {
    assert.equal((await s.request('/api/save', { method: 'POST', body: { key: 'products', data: product } })).status, 200);
    const invalid = await s.request('/api/save', { method: 'POST', body: { key: 'products', data: {} } });
    assert.equal(invalid.status, 400);
    const stale = await s.request('/api/save', { method: 'POST', body: { key: 'products', data: [], expectedFingerprint: 'old-version' } });
    assert.equal(stale.status, 409);
    assert.deepEqual((await (await s.request('/api/data')).json()).products, product);
  } finally { await s.close(); }
});

test('startup rolls back all files in an interrupted JSON write journal', async () => {
  const s = await startServer({}, dir => {
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify([{ ...product[0], lots: [{ qty: 1 }] }]));
    fs.writeFileSync(path.join(dir, 'transactions.json'), JSON.stringify([{ id: 'partial-sale', type: 'sale' }]));
    fs.writeFileSync(path.join(dir, '.inventory-write-journal.json'), JSON.stringify({ version: 1, previous: { products: product, transactions: [] } }));
  });
  try {
    const data = await (await s.request('/api/data')).json();
    assert.deepEqual(data.products, product); assert.deepEqual(data.transactions, []);
    assert.equal(fs.existsSync(path.join(s.dir, '.inventory-write-journal.json')), false);
  } finally { await s.close(); }
});

test('a rejected sale does not mutate cached stock or transaction history before retry', async () => {
  const products = structuredClone(product); const transactions = [];
  const fields = { 'sale-product': { value: 'p1' }, 'sale-qty': { value: '1' }, 'sale-price': { value: '100' }, 'sale-date': { value: '2026-11-02' } };
  const sandbox = { document: { getElementById: id => fields[id] }, loadProducts: () => products, loadTransactions: () => transactions,
    getStock: p => p.lots.reduce((s,l) => s+l.qty,0), consumeFIFO: (p,q) => { p.lots[0].qty -= q; return 50; },
    genId: () => 'sale1', pLabel: () => 'Mini 3', showToast() {}, _persistInventoryMovement: async () => false, structuredClone, JSON,
  };
  vm.runInNewContext(fn('recordSale', client), sandbox); await sandbox.recordSale();
  assert.equal(products[0].lots[0].qty, 2); assert.equal(transactions.length, 0);
});

test('an invalid later backup section never overwrites an earlier valid inventory section', async () => {
  const s = await startServer();
  try {
    await s.request('/api/save', { method: 'POST', body: { key: 'products', data: product } });
    const zip = backupFixture(['products','settings'], { 'products.json': [], 'settings.json': { subAccounts: [{ email: 'missing-id@example.com' }], hostSubscriptions: [] } });
    const res = await s.request('/api/backups/import', { method: 'POST', body: { backupBase64: zip.toString('base64'), sections: ['products','settings'], confirm: true } });
    assert.equal(res.status, 400);
    assert.deepEqual((await (await s.request('/api/data')).json()).products, product);
  } finally { await s.close(); }
});

test('mixed inventory and website-file restore is rejected before either store changes', async () => {
  const s = await startServer();
  const languageFile = path.join(__dirname, '../i18n.js');
  const original = fs.readFileSync(languageFile, 'utf8');
  try {
    await s.request('/api/save', { method: 'POST', body: { key: 'products', data: product } });
    const zip = backupFixture(['products','translations'], { 'products.json': [], 'translations.json': { file: 'i18n.js', content: '// test translation fixture' } });
    const res = await s.request('/api/backups/import', { method: 'POST', body: { backupBase64: zip.toString('base64'), sections: ['products','translations'], confirm: true } });
    assert.equal(res.status, 400, 'separate stores require separate restore operations');
    assert.deepEqual((await (await s.request('/api/data')).json()).products, product);
    assert.equal(fs.readFileSync(languageFile, 'utf8'), original);
  } finally { fs.writeFileSync(languageFile, original); await s.close(); }
});

test('a disk error on the second JSON file rolls back both files and retains a recovery snapshot', async () => {
  const dir = fs.mkdtempSync('/tmp/inventory-disk-failure-');
  const FILES = { products: path.join(dir, 'products.json'), transactions: path.join(dir, 'transactions.json') };
  fs.writeFileSync(FILES.products, JSON.stringify(product)); fs.writeFileSync(FILES.transactions, '[]');
  let failed = false;
  const failingFs = { ...fs, renameSync(from,to) {
    if (to === FILES.transactions && !failed) { failed = true; throw Object.assign(new Error('simulated disk error'), { code: 'EIO' }); }
    return fs.renameSync(from,to);
  } };
  const sandbox = { DATA_DIR: dir, FILES, fs: failingFs, path, crypto, USE_MONGO: false, CRITICAL_DATA_KEYS: new Set(['products','transactions']) };
  vm.createContext(sandbox);
  for (const name of ['canonicalValue','datasetFingerprint','validateCriticalDataset','dataWriteError','atomicWriteFile','recoverPendingDataWrite','prepareCriticalReplacement','replaceCriticalDatasets']) vm.runInContext(fn(name), sandbox);
  try {
    await assert.rejects(sandbox.replaceCriticalDatasets({ products: [], transactions: [{ id: 'sale', type: 'sale' }] }), e => e.code === 'EIO');
    assert.deepEqual(JSON.parse(fs.readFileSync(FILES.products)), product);
    assert.deepEqual(JSON.parse(fs.readFileSync(FILES.transactions)), []);
    assert.equal(fs.existsSync(path.join(dir, '.inventory-write-journal.json')), false);
    const saved = fs.readdirSync(path.join(dir, '.snapshots'));
    assert.equal(saved.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.snapshots', saved[0]))).documents.products, product);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('failed write and failed rollback make JSON reads fail closed until recovery succeeds', async () => {
  const dir = fs.mkdtempSync('/tmp/inventory-persistent-disk-error-');
  const FILES = { products: path.join(dir, 'products.json'), transactions: path.join(dir, 'transactions.json'), andreyReturns: path.join(dir, 'returns.json'), subAccounts: path.join(dir, 'subs.json'), hostSubscriptions: path.join(dir, 'hosts.json') };
  for (const [key,file] of Object.entries(FILES)) fs.writeFileSync(file, JSON.stringify(key === 'products' ? product : []));
  let broken = false;
  const failingFs = { ...fs, renameSync(from,to) {
    if (to === FILES.transactions) broken = true;
    if (broken) throw Object.assign(new Error('simulated full disk'), { code: 'ENOSPC' });
    return fs.renameSync(from,to);
  } };
  const sandbox = { DATA_DIR: dir, FILES, fs: failingFs, path, crypto, USE_MONGO: false, CRITICAL_DATA_KEYS: new Set(['products','transactions']) };
  vm.createContext(sandbox);
  for (const name of ['canonicalValue','datasetFingerprint','validateCriticalDataset','dataWriteError','atomicWriteFile','recoverPendingDataWrite','prepareCriticalReplacement','replaceCriticalDatasets','dbGetAll']) vm.runInContext(fn(name), sandbox);
  try {
    await assert.rejects(sandbox.replaceCriticalDatasets({ products: [], transactions: [{ id: 'sale', type: 'sale' }] }), e => e.code === 'ENOSPC');
    await assert.rejects(sandbox.dbGetAll(), /simulated full disk/, 'inconsistent stock/history must never be returned');
    assert.equal(fs.existsSync(path.join(dir, '.inventory-write-journal.json')), true);
    sandbox.fs = fs;
    const recovered = await sandbox.dbGetAll();
    assert.deepEqual(JSON.parse(JSON.stringify(recovered.products)), product);
    assert.deepEqual(JSON.parse(JSON.stringify(recovered.transactions)), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('website-file restore snapshots originals and recovers an interrupted multi-file update', () => {
  const dir = fs.mkdtempSync('/tmp/inventory-asset-recovery-');
  const dataDir = path.join(dir, 'data'); fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(dir, 'faq.json'), '["original FAQ"]');
  fs.writeFileSync(path.join(dir, 'i18n.js'), '// original translations');
  const sandbox = { DATA_DIR: dataDir, __dirname: dir, fs, path, crypto };
  vm.createContext(sandbox);
  for (const name of ['atomicWriteFile','readTextFile','recoverPendingAssetWrite','replaceAssetFiles']) vm.runInContext(fn(name), sandbox);
  try {
    sandbox.replaceAssetFiles({ 'faq.json': '["restored FAQ"]', 'i18n.js': '// restored translations' });
    assert.equal(fs.readFileSync(path.join(dir, 'faq.json'), 'utf8'), '["restored FAQ"]');
    const snapshot = JSON.parse(fs.readFileSync(path.join(dataDir, '.snapshots', fs.readdirSync(path.join(dataDir, '.snapshots'))[0])));
    assert.equal(snapshot.documents['i18n.js'], '// original translations');
    fs.writeFileSync(path.join(dataDir, '.asset-write-journal.json'), JSON.stringify({ version: 1, previous: snapshot.documents }));
    sandbox.recoverPendingAssetWrite();
    assert.equal(fs.readFileSync(path.join(dir, 'faq.json'), 'utf8'), '["original FAQ"]');
    assert.equal(fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8'), '// original translations');
    assert.equal(fs.existsSync(path.join(dataDir, '.asset-write-journal.json')), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
