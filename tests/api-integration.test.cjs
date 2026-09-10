const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-api-test-'));
const port = 43117;
const baseUrl = `http://127.0.0.1:${port}`;
const jwtSecret = 'integration-test-secret';
const adminToken = jwt.sign({ username: 'admin', role: 'admin' }, jwtSecret, { expiresIn: '10m' });
const viewerToken = jwt.sign({ username: 'andrey', role: 'viewer' }, jwtSecret, { expiresIn: '10m' });

let server;

function headers(token) {
  return {
    'content-type': 'application/json',
    host: `127.0.0.1:${port}`,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { ...headers(options.token), ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function json(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server start timeout')), 10_000);
    const onData = chunk => {
      const text = String(chunk);
      if (text.includes('Inventory app running at')) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`server exited before ready: ${code}`));
    });
  });
}

async function run() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_DIR: dataDir,
      JWT_SECRET: jwtSecret,
      MONGODB_URI: '',
      MAXMIND_LICENSE_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', chunk => process.stderr.write(`[api-test server] ${chunk}`));
  await waitForServer(server);

  // Authentication and authorization are enforced on inventory APIs.
  let response = await request('/api/data');
  assert.equal(response.status, 401, 'anonymous inventory read must be rejected');

  response = await request('/api/save', {
    method: 'POST',
    token: viewerToken,
    body: { key: 'products', data: [] },
  });
  assert.equal(response.status, 403, 'viewer must not be allowed to mutate inventory');

  const products = [
    {
      id: 'light2-blue',
      productType: 'Лайт 2',
      color: 'Голубой',
      purchasePrice: 71,
      sellPrice: 100,
      renewalDate: '2026-10-15',
      lots: [{ id: 'lot-1', qty: 2, price: 71 }],
    },
    {
      id: 'light2-black-empty',
      productType: 'Лайт 2',
      color: 'Чёрный',
      purchasePrice: 71,
      sellPrice: 100,
      renewalDate: '2026-09-01',
      lots: [{ id: 'lot-2', qty: 0, price: 71 }],
    },
    {
      id: 'yandex-plus-12m',
      productType: 'Yandex Plus',
      color: '12 месяцев',
      purchasePrice: 31.5,
      sellPrice: 45,
      renewalDate: null,
      lots: [{ id: 'lot-plus', qty: 1, price: 31.5 }],
    },
  ];

  response = await request('/api/save', {
    method: 'POST',
    token: adminToken,
    body: { key: 'products', data: products },
  });
  assert.equal(response.status, 200, 'admin product save should succeed');
  assert.deepEqual(await json(response), { ok: true });

  // Internal product metadata survives the authenticated round trip.
  response = await request('/api/data', { token: adminToken });
  assert.equal(response.status, 200);
  let data = await json(response);
  const savedLight = data.products.find(product => product.id === 'light2-blue');
  assert.equal(savedLight.renewalDate, '2026-10-15', 'renewal date must survive save/read');
  assert.equal(savedLight.purchasePrice, 71, 'purchase price must survive save/read');
  assert.equal(savedLight.lots[0].qty, 2, 'stock lot must survive save/read');

  // Public projection exposes only safe storefront fields and hides zero stock.
  response = await request('/api/public/products');
  assert.equal(response.status, 200);
  let publicData = await json(response);
  assert.deepEqual(publicData.products.map(product => product.id), ['light2-blue', 'yandex-plus-12m']);
  const publicLight = publicData.products.find(product => product.id === 'light2-blue');
  assert.equal(publicLight.sellPrice, 100);
  assert.equal(publicLight.inStock, true);
  assert.equal('purchasePrice' in publicLight, false, 'purchase price must never leak publicly');
  assert.equal('renewalDate' in publicLight, false, 'renewal date must never leak publicly');
  assert.equal('lots' in publicLight, false, 'stock lots must never leak publicly');

  // Editing sellPrice in admin storage is reflected immediately by the public API.
  const updatedProducts = products.map(product => product.id === 'yandex-plus-12m'
    ? { ...product, sellPrice: 49 }
    : product);
  response = await request('/api/save', {
    method: 'POST',
    token: adminToken,
    body: { key: 'products', data: updatedProducts },
  });
  assert.equal(response.status, 200);

  response = await request('/api/public/products');
  publicData = await json(response);
  assert.equal(
    publicData.products.find(product => product.id === 'yandex-plus-12m').sellPrice,
    49,
    'storefront price must follow admin sellPrice without deploy',
  );

  // Sales persistence and reporting stay consistent.
  const transactions = [
    {
      id: 'sale-1',
      type: 'sale',
      date: '2026-09-10T10:00:00.000Z',
      productId: 'light2-blue',
      qty: 1,
      total: 100,
      costTotal: 71,
      profit: 29,
    },
    {
      id: 'sale-2',
      type: 'sale',
      date: '2026-09-10T11:00:00.000Z',
      productId: 'yandex-plus-12m',
      qty: 1,
      total: 49,
      costTotal: 31.5,
      profit: 17.5,
    },
  ];
  response = await request('/api/save', {
    method: 'POST',
    token: adminToken,
    body: { key: 'transactions', data: transactions },
  });
  assert.equal(response.status, 200);

  response = await request('/api/reports/sales?groupBy=month&years=2026', { token: adminToken });
  assert.equal(response.status, 200);
  const report = await json(response);
  assert.equal(report.totals.qty, 2);
  assert.equal(report.totals.revenue, 149);
  assert.equal(report.totals.cost, 102.5);
  assert.equal(report.totals.profit, 46.5);

  // Unknown storage keys are rejected instead of creating arbitrary files/collections.
  response = await request('/api/save', {
    method: 'POST',
    token: adminToken,
    body: { key: 'totallyUnknown', data: [] },
  });
  assert.equal(response.status, 400);

  console.log('inventory API integration regression passed');
}

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server && !server.killed) server.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
