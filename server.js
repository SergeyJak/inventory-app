require('dotenv').config();
const express   = require('express');
const fs        = require('fs');
const path      = require('path');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const { MongoClient } = require('mongodb');

const app      = express();
const PORT     = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const USE_MONGO = !!process.env.MONGODB_URI;
const INVENTORY_HOST = 'inv-app.up.railway.app';
const CATALOG_HOSTS = ['mysmart.up.railway.app', 'heysmart.up.railway.app'];

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌  JWT_SECRET not set in .env — refusing to start');
  process.exit(1);
}

const USERS = [
  { username: 'admin',  role: 'admin',  hash: process.env.ADMIN_HASH },
  { username: 'andrey', role: 'viewer', hash: process.env.ANDREY_HASH },
];

// ── JSON FILE STORAGE (local) ────────────────────────────────
if (!USE_MONGO) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
}
const FILES = {
  products:      path.join(DATA_DIR, 'products.json'),
  transactions:  path.join(DATA_DIR, 'transactions.json'),
  andreyReturns: path.join(DATA_DIR, 'andrey-returns.json'),
  subAccounts: path.join(DATA_DIR, 'sub-accounts.json'),
  hostSubscriptions: path.join(DATA_DIR, 'host-subscriptions.json'),
};
if (!USE_MONGO) {
  Object.values(FILES).forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
  });
}

// ── MONGODB STORAGE ──────────────────────────────────────────
let db = null;
const COLL = {
  products: 'products',
  transactions: 'transactions',
  andreyReturns: 'andreyReturns',
  subAccounts: 'subAccounts',
  hostSubscriptions: 'hostSubscriptions',
};
const ADMIN_ONLY_KEYS = ['subAccounts', 'hostSubscriptions'];

async function connectMongo() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('inventory');
  console.log('✅  MongoDB connected');
}

// ── STORAGE ABSTRACTION ──────────────────────────────────────
async function dbGetAll() {
  if (USE_MONGO) {
    const [products, transactions, andreyReturns, subAccounts, hostSubscriptions] = await Promise.all([
      db.collection(COLL.products).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLL.transactions).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLL.andreyReturns).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLL.subAccounts).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLL.hostSubscriptions).find({}, { projection: { _id: 0 } }).toArray(),
    ]);
    return { products, transactions, andreyReturns, subAccounts, hostSubscriptions };
  }
  return {
    products:      JSON.parse(fs.readFileSync(FILES.products,      'utf8')),
    transactions:  JSON.parse(fs.readFileSync(FILES.transactions,  'utf8')),
    andreyReturns: JSON.parse(fs.readFileSync(FILES.andreyReturns, 'utf8')),
    subAccounts: JSON.parse(fs.readFileSync(FILES.subAccounts, 'utf8')),
    hostSubscriptions: JSON.parse(fs.readFileSync(FILES.hostSubscriptions, 'utf8')),
  };
}

async function dbSave(key, data) {
  if (USE_MONGO) {
    const coll = db.collection(COLL[key]);
    await coll.deleteMany({});
    if (data.length > 0) await coll.insertMany(data);
  } else {
    fs.writeFileSync(FILES[key], JSON.stringify(data, null, 2), 'utf8');
  }
}

function getProductStock(product) {
  return (product.lots || []).reduce((sum, lot) => sum + (Number(lot.qty) || 0), 0);
}

function publicProduct(product) {
  const stock = getProductStock(product);
  const productType = product.productType || '';
  const color = product.color || '';
  return {
    id: product.id,
    productType,
    color,
    label: [productType, color].filter(Boolean).join(' / '),
    sellPrice: Number(product.sellPrice) || 0,
    inStock: stock > 0,
    accent: productType.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'speaker',
  };
}

// ── MIDDLEWARE ───────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  `https://${INVENTORY_HOST}`,
  ...CATALOG_HOSTS.map(host => `https://${host}`),
]);

const INVENTORY_PUBLIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/login.html', 'login.html'],
  ['/app.js', 'app.js'],
  ['/style.css', 'style.css'],
  ['/favicon.ico', 'favicon.ico'],
]);

function setSecurityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
}

function setCorsHeaders(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

function sendGenericError(res, status = 500) {
  return res.status(status).json({ error: status === 500 ? 'Internal server error' : 'Request failed' });
}

app.use(setSecurityHeaders);
app.use(setCorsHeaders);
app.use(express.json({ limit: '10mb' }));

function requestHost(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const rawHost = forwardedHost || req.headers.host || req.hostname || '';
  return String(rawHost).toLowerCase().replace(/:\d+$/, '');
}

function isCatalogHost(req) {
  return CATALOG_HOSTS.includes(requestHost(req));
}

function isInventoryHost(req) {
  const host = requestHost(req);
  return host === INVENTORY_HOST || host === 'localhost' || host === '127.0.0.1';
}

function requireInventoryHost(req, res, next) {
  if (isInventoryHost(req)) return next();
  return res.status(404).send('Not found');
}

// Domain split for one Railway service:
// - inv-app.up.railway.app keeps the existing Inventory App behavior.
// - heysmart.up.railway.app exposes only the public catalog site and its safe assets.
// - mysmart.up.railway.app is kept as a catalog alias.
app.get('/', (req, res, next) => {
  if (isCatalogHost(req)) {
    return res.sendFile(path.join(__dirname, 'catalog.html'));
  }
  return next();
});

app.get('/catalog.html', (req, res, next) => {
  if (isCatalogHost(req)) {
    return res.redirect(302, '/');
  }
  return next();
});

app.get(['/catalog.css', '/catalog.js', '/i18n.js', '/site.webmanifest', '/robots.txt', '/sitemap.xml', '/404.html', '/favicon.ico'], (req, res, next) => {
  if (isCatalogHost(req)) {
    return res.sendFile(path.join(__dirname, req.path.slice(1)));
  }
  return next();
});

app.use('/icons', (req, res, next) => {
  if (isCatalogHost(req)) {
    return express.static(path.join(__dirname, 'icons'), {
      maxAge: '30d',
      immutable: true,
    })(req, res, next);
  }
  return next();
});

app.use('/images/catalog', (req, res, next) => {
  if (isCatalogHost(req)) {
    return express.static(path.join(__dirname, 'images', 'catalog'), {
      maxAge: '30d',
      immutable: true,
    })(req, res, next);
  }
  return next();
});

app.use((req, res, next) => {
  if (
    isCatalogHost(req) &&
    (
      ['/index.html', '/app.js', '/style.css'].includes(req.path) ||
      req.path.startsWith('/data/') ||
      (req.path.startsWith('/images/') && !req.path.startsWith('/images/catalog/'))
    )
  ) {
    return res.status(404).send('Not found');
  }
  return next();
});

app.use((req, res, next) => {
  if (isCatalogHost(req) && req.path.startsWith('/api/') && req.path !== '/api/public/products') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (isCatalogHost(req)) return next();
  return requireInventoryHost(req, res, () => {
    const file = INVENTORY_PUBLIC_FILES.get(req.path);
    if (!file) return next();
    return res.sendFile(path.join(__dirname, file));
  });
});

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  next();
}

// ── LOGIN ────────────────────────────────────────────────────
app.post('/api/login', requireInventoryHost, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = USERS.find(u => u.username === username);
  if (!user || !user.hash) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, role: user.role, username: user.username });
});

// ── DATA ROUTES ──────────────────────────────────────────────
app.get('/api/public/products', async (req, res) => {
  try {
    const { products } = await dbGetAll();
    const publicProducts = products
      .map(publicProduct)
      .filter(product => product.inStock)
      .sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color));
    res.json({ products: publicProducts });
  } catch (e) {
    console.error('Public products error:', e.message);
    sendGenericError(res);
  }
});

app.get('/api/data', requireInventoryHost, requireAuth, async (req, res) => {
  try {
    const data = await dbGetAll();
    if (req.user.role !== 'admin') {
      ADMIN_ONLY_KEYS.forEach(key => delete data[key]);
    }
    res.json(data);
  } catch (e) {
    console.error('Data route error:', e.message);
    sendGenericError(res);
  }
});

app.post('/api/save', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  const { key, data } = req.body;
  if (!COLL[key]) return res.status(400).json({ error: 'Unknown key: ' + key });
  try {
    await dbSave(key, data);
    res.json({ ok: true });
  } catch (e) {
    console.error('Save route error:', e.message);
    sendGenericError(res);
  }
});

// ── START ────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (isCatalogHost(req)) {
    res.type('html');
    return res.status(404).sendFile(path.join(__dirname, '404.html'));
  }
  next();
});

app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err.message);
  if (res.headersSent) return next(err);
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (req.path.startsWith('/api/')) return sendGenericError(res, status);
  return res.status(status).send(status === 500 ? 'Internal server error' : 'Bad request');
});

async function start() {
  if (USE_MONGO) await connectMongo();
  else console.log('📁  Using local JSON files (no MONGODB_URI set)');
  app.listen(PORT, () => {
    console.log(`Inventory app running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('❌  Failed to start:', err.message);
  process.exit(1);
});
