const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const port = Number(process.env.PORT || 4173);

const products = [
  { id: 'light2-blue', productType: 'Лайт 2', color: 'Голубой', label: 'Лайт 2 / Голубой', sellPrice: 100, inStock: true },
  { id: 'light2-pink', productType: 'Лайт 2', color: 'Розовый', label: 'Лайт 2 / Розовый', sellPrice: 90, inStock: true },
  { id: 'mini3-gray', productType: 'Мини 3', color: 'Серый', label: 'Мини 3 / Серый', sellPrice: 140, inStock: true },
  { id: 'street-green', productType: 'Street', color: 'Зелёный', label: 'Street / Зелёный', sellPrice: 180, inStock: true },
  { id: 'yandex-plus-12m', productType: 'Yandex Plus', color: '12 месяцев', label: 'Yandex Plus / 12 месяцев', sellPrice: 45, inStock: true },
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function safeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const relative = clean.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  return resolved;
}

function renderCatalogHtml() {
  const file = path.join(root, 'catalog.html');
  return fs.readFileSync(file, 'utf8')
    .replace('__CATALOG_PAGE_LOCALE__', JSON.stringify('ru'))
    .replace('__CATALOG_INITIAL_DATA__', 'null');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  if (url.pathname === '/health') return send(res, 200, 'ok');

  if (url.pathname === '/api/public/products') {
    return send(res, 200, JSON.stringify({ products }), 'application/json; charset=utf-8');
  }

  if (url.pathname === '/api/public/analytics/event' && req.method === 'POST') {
    req.resume();
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (url.pathname === '/api/public/assistant/question' && req.method === 'POST') {
    req.resume();
    return send(res, 200, JSON.stringify({ id: 'e2e-question' }), 'application/json; charset=utf-8');
  }

  if (url.pathname === '/' || url.pathname === '/ru' || url.pathname === '/lv' || url.pathname === '/en' || url.pathname === '/catalog.html') {
    return send(res, 200, renderCatalogHtml(), 'text/html; charset=utf-8');
  }

  const file = safeFile(url.pathname);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return send(res, 404, 'not found');
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[e2e] storefront server listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
