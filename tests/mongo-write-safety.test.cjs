const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');
const { startServer } = require('./helpers/safety-server.cjs');
const { backupFixture } = require('./helpers/backup-fixture.cjs');
let repl, client, db, server, env;
const name = key => `${key}__${env}`;
const coll = key => db.collection(name(key));
const products = [{ id: 'p1', productType: 'Mini 3', lots: [{ qty: 2, buyPrice: 50 }], sellPrice: 100 }];
const data = async () => (await server.request('/api/data')).json();
const post = (url, body) => server.request(url, { method: 'POST', body });

test.before(async () => {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryReplSet } = require('mongodb-memory-server-core');
    repl = await MongoMemoryReplSet.create({ binary: { version: '8.0.16' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
    uri = repl.getUri();
  }
  assert.ok(/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(uri), 'safety tests accept only a disposable localhost MongoDB');
  client = new MongoClient(uri); await client.connect(); db = client.db('inventory');
  env = 'safety-' + crypto.randomUUID();
  server = await startServer({ MONGODB_URI: uri, RAILWAY_ENVIRONMENT_NAME: env });
});
test.after(async () => {
  if (server) await server.close();
  if (db) for (const item of await db.listCollections({}, { nameOnly: true }).toArray()) if (item.name.endsWith('__' + env)) await db.collection(item.name).drop();
  if (client) await client.close(); if (repl) await repl.stop();
});
test.beforeEach(async () => {
  for (const key of ['products', 'transactions', 'subAccounts', 'hostSubscriptions', 'dataSnapshots']) await coll(key).deleteMany({});
  await coll('products').insertMany(structuredClone(products));
});

test('two concurrent movements with one version accept one sale and reject the stale sale', async () => {
  const loaded = await data();
  const move = id => post('/api/inventory/movement', { products: [{ ...products[0], lots: [{ qty: 1, buyPrice: 50 }] }], transactions: [{ id, type: 'sale', qty: 1 }], expectedFingerprints: loaded._meta.fingerprints });
  const responses = await Promise.all([move('sale-A'), move('sale-B')]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200,409]);
  assert.equal(await coll('transactions').countDocuments({}), 1);
  assert.equal((await coll('products').findOne({ id: 'p1' })).lots[0].qty, 1);
  const snapshot = await coll('dataSnapshots').findOne({ key: 'products' });
  assert.equal(snapshot.documents[0].lots[0].qty, 2);
});

test('concurrent generic saves from an empty collection cannot both commit', async () => {
  await coll('products').deleteMany({}); const loaded = await data();
  const save = id => post('/api/save', { key: 'products', data: [{ id, lots: [] }], expectedFingerprint: loaded._meta.fingerprints.products });
  const responses = await Promise.all([save('A'),save('B')]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200,409]);
  assert.equal(await coll('products').countDocuments({}), 1);
});

test('a failed insert rolls back stock, history and uncommitted recovery snapshots', async () => {
  await coll('transactions').insertOne({ id: 'old-sale', type: 'sale', qty: 1 });
  const loaded = await data();
  await db.command({ collMod: name('transactions'), validator: { qty: { $gt: 0 } } });
  try {
    const res = await post('/api/inventory/movement', { products: [], transactions: [{ id: 'bad-sale', qty: 0 }], expectedFingerprints: loaded._meta.fingerprints });
    assert.equal(res.status, 500);
    assert.equal((await coll('products').findOne({ id: 'p1' })).lots[0].qty, 2);
    assert.equal((await coll('transactions').findOne({ id: 'old-sale' })).qty, 1);
    assert.equal(await coll('dataSnapshots').countDocuments({}), 0);
  } finally { await db.command({ collMod: name('transactions'), validator: {} }); }
});

test('Mongo ZIP restore replaces selected data, snapshots the previous data, and preserves restocks', async () => {
  await coll('transactions').insertMany([{ id: 'sale', type: 'sale', qty: 1 }, { id: 'restock', type: 'restock', qty: 3 }]);
  const zip = Buffer.from(await (await post('/api/backups/export', { sections: ['products','sales','settings'] })).arrayBuffer());
  await coll('products').updateOne({ id: 'p1' }, { $set: { sellPrice: 120 } });
  await coll('transactions').insertOne({ id: 'new-restock', type: 'restock', qty: 2 });
  const loaded = await data();
  const res = await post('/api/backups/import', { backupBase64: zip.toString('base64'), sections: ['products','sales','settings'], confirm: true, expectedFingerprints: loaded._meta.fingerprints });
  assert.equal(res.status, 200);
  assert.equal((await coll('products').findOne({ id: 'p1' })).sellPrice, 100);
  assert.equal(await coll('transactions').countDocuments({ type: 'restock' }), 2);
  assert.equal((await coll('dataSnapshots').findOne({ key: 'products' })).documents[0].sellPrice, 120);
});

test('stale multi-section restore does not overwrite any selected collection', async () => {
  const loaded = await data();
  const zip = Buffer.from(await (await post('/api/backups/export', { sections: ['products','settings'] })).arrayBuffer());
  await coll('hostSubscriptions').insertOne({ id: 'new-host', email: 'new@example.com' });
  const res = await post('/api/backups/import', { backupBase64: zip.toString('base64'), sections: ['products','settings'], confirm: true, expectedFingerprints: loaded._meta.fingerprints });
  assert.equal(res.status, 409);
  assert.equal(await coll('hostSubscriptions').countDocuments({ id: 'new-host' }), 1);
  assert.equal(await coll('dataSnapshots').countDocuments({}), 0);
});

test('Mongo restore without selected data versions is refused before any overwrite', async () => {
  const zip = Buffer.from(await (await post('/api/backups/export', { sections: ['products'] })).arrayBuffer());
  await coll('products').updateOne({ id: 'p1' }, { $set: { sellPrice: 120 } });
  const res = await post('/api/backups/import', { backupBase64: zip.toString('base64'), sections: ['products'], confirm: true });
  assert.equal(res.status, 428);
  assert.equal((await coll('products').findOne({ id: 'p1' })).sellPrice, 120);
  assert.equal(await coll('dataSnapshots').countDocuments({}), 0);
});

test('an insertion error in the last restored collection leaves all selected Mongo data unchanged', async () => {
  await coll('transactions').insertOne({ id: 'old-sale', type: 'sale', qty: 1 });
  await db.command({ collMod: name('transactions'), validator: { qty: { $gt: 0 } } });
  try {
    const zip = backupFixture(['products','sales'], { 'products.json': [], 'sales.json': [{ id: 'bad-sale', type: 'sale', qty: 0 }] });
    const res = await post('/api/backups/import', { backupBase64: zip.toString('base64'), sections: ['products','sales'], confirm: true, expectedFingerprints: (await data())._meta.fingerprints });
    assert.equal(res.status, 400);
    assert.equal((await coll('products').findOne({ id: 'p1' })).lots[0].qty, 2);
    assert.equal(await coll('transactions').countDocuments({ id: 'old-sale' }), 1);
    assert.equal(await coll('dataSnapshots').countDocuments({}), 0);
  } finally { await db.command({ collMod: name('transactions'), validator: {} }); }
});
