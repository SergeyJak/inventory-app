const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-backup-test-'));
const dataDir = path.join(tmp, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const port = 4301 + Math.floor(Math.random() * 1000);
const adminPassword = 'admin-pass';
const viewerPassword = 'viewer-pass';

function writeJson(name, value) {
  fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value, null, 2), 'utf8');
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntries(buffer) {
  const entries = {};
  let offset = 0;
  while (offset < buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString('utf8');
    const dataStart = nameStart + fileNameLength + extraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    assert.strictEqual(method, 0, `Unexpected compression method for ${name}`);
    assert.strictEqual(crc32(data), buffer.readUInt32LE(offset + 14), `CRC mismatch for ${name}`);
    entries[name] = data;
    offset = dataStart + compressedSize;
  }
  return entries;
}

async function request(pathname, options = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await res.json()
    : Buffer.from(await res.arrayBuffer());
  return { res, body };
}

async function login(username, password) {
  const { res, body } = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(res.status, 200, `login failed for ${username}`);
  return body.token;
}

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    proc.stdout.on('data', chunk => {
      if (String(chunk).includes('Inventory app running')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', chunk => process.stderr.write(chunk));
    proc.on('exit', code => reject(new Error(`server exited early with code ${code}`)));
  });
}

(async () => {
  writeJson('products.json', [
    { id: 'p1', productType: 'Mini 3', color: 'Gray', sellPrice: 99, lots: [{ qty: 2, buyPrice: 50, date: '2026-01-01' }] },
    { id: 'p2', productType: 'Street', color: 'Green', sellPrice: 129, lots: [{ qty: 1, buyPrice: 70, date: '2026-01-02' }] },
  ]);
  writeJson('transactions.json', [
    { id: 's1', type: 'sale', productId: 'p1', productLabel: 'Mini 3 / Gray', qty: 1, price: 99, total: 99, costTotal: 50, profit: 49, date: '2026-02-01T12:00:00' },
    { id: 'r1', type: 'restock', productId: 'p2', productLabel: 'Street / Green', qty: 1, price: 70, total: 70, costTotal: 0, profit: 0, date: '2026-02-02T12:00:00' },
  ]);
  writeJson('andrey-returns.json', []);
  writeJson('sub-accounts.json', [{ id: 'sub1', email: 'user@example.com', hostId: 'host1', status: 'active' }]);
  writeJson('host-subscriptions.json', [{ id: 'host1', email: 'host@example.com', status: 'active' }]);
  writeJson('assistant-questions.json', []);

  const expectedProducts = readJson('products.json');
  const expectedTransactions = readJson('transactions.json');
  const expectedSubAccounts = readJson('sub-accounts.json');
  const expectedHostSubscriptions = readJson('host-subscriptions.json');

  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      JWT_SECRET: 'backup-test-secret',
      ADMIN_HASH: bcrypt.hashSync(adminPassword, 4),
      ANDREY_HASH: bcrypt.hashSync(viewerPassword, 4),
      MONGODB_URI: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const adminToken = await login('admin', adminPassword);
    const viewerToken = await login('andrey', viewerPassword);

    const viewerExport = await request('/api/backups/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
      body: JSON.stringify({ sections: ['products'] }),
    });
    assert.strictEqual(viewerExport.res.status, 403, 'viewer must not export backups');

    const exported = await request('/api/backups/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ sections: ['products', 'sales', 'settings', 'faq', 'categories', 'translations', 'users'] }),
    });
    assert.strictEqual(exported.res.status, 200, 'admin export should succeed');
    assert.match(exported.res.headers.get('content-type') || '', /application\/zip/);

    const entries = zipEntries(exported.body);
    const manifest = JSON.parse(entries['manifest.json'].toString('utf8'));
    assert.strictEqual(manifest.version, 1);
    assert.deepStrictEqual(manifest.collections, ['products', 'sales', 'settings', 'faq', 'categories', 'translations', 'users']);
    assert.deepStrictEqual(JSON.parse(entries['products.json'].toString('utf8')), expectedProducts);
    assert.deepStrictEqual(JSON.parse(entries['sales.json'].toString('utf8')), expectedTransactions.filter(tx => tx.type === 'sale'));
    assert.deepStrictEqual(JSON.parse(entries['settings.json'].toString('utf8')), {
      subAccounts: expectedSubAccounts,
      hostSubscriptions: expectedHostSubscriptions,
    });
    assert.deepStrictEqual(JSON.parse(entries['categories.json'].toString('utf8')), ['Mini 3', 'Street']);
    assert.deepStrictEqual(JSON.parse(entries['users.json'].toString('utf8')), [
      { username: 'admin', role: 'admin' },
      { username: 'andrey', role: 'viewer' },
    ]);

    const inspect = await request('/api/backups/import/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip', Authorization: `Bearer ${adminToken}` },
      body: exported.body,
    });
    assert.strictEqual(inspect.res.status, 200, 'inspect should succeed');
    assert.deepStrictEqual(inspect.body.restorableCollections, ['products', 'sales', 'settings', 'faq', 'translations']);
    assert.deepStrictEqual(inspect.body.exportOnlyCollections.sort(), ['categories', 'users']);

    writeJson('products.json', [{ id: 'changed', productType: 'Changed', color: 'Black', lots: [] }]);
    writeJson('transactions.json', [{ id: 'r2', type: 'restock', productId: 'changed', qty: 1 }]);
    writeJson('sub-accounts.json', []);
    writeJson('host-subscriptions.json', []);

    const imported = await request('/api/backups/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        backupBase64: exported.body.toString('base64'),
        sections: ['products', 'sales', 'settings'],
        confirm: true,
      }),
    });
    assert.strictEqual(imported.res.status, 200, 'import should succeed');
    assert.deepStrictEqual(readJson('products.json'), expectedProducts);
    assert.deepStrictEqual(readJson('transactions.json'), expectedTransactions.filter(tx => tx.type === 'sale'));
    assert.deepStrictEqual(readJson('sub-accounts.json'), expectedSubAccounts);
    assert.deepStrictEqual(readJson('host-subscriptions.json'), expectedHostSubscriptions);

    console.log('backup export/import regression passed');
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
