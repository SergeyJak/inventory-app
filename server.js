require('dotenv').config();
const express   = require('express');
const fs        = require('fs');
const path      = require('path');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const { createMailService } = require('./mail-service');

const app      = express();
const PORT     = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USE_MONGO = !!process.env.MONGODB_URI;
const INVENTORY_HOST = 'inv-app.up.railway.app';
const CATALOG_HOSTS = ['mysmart.up.railway.app', 'heysmart.up.railway.app', 'heysmart.lv', 'www.heysmart.lv'];
const BACKUP_VERSION = 1;
const BACKUP_SECTIONS = ['products', 'sales', 'settings', 'faq', 'categories', 'translations', 'users'];
const RESTORABLE_BACKUP_SECTIONS = ['products', 'sales', 'settings', 'faq', 'translations'];

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
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
const FILES = {
  products:      path.join(DATA_DIR, 'products.json'),
  transactions:  path.join(DATA_DIR, 'transactions.json'),
  andreyReturns: path.join(DATA_DIR, 'andrey-returns.json'),
  subAccounts: path.join(DATA_DIR, 'sub-accounts.json'),
  hostSubscriptions: path.join(DATA_DIR, 'host-subscriptions.json'),
  assistantQuestions: path.join(DATA_DIR, 'assistant-questions.json'),
};
if (!USE_MONGO) {
  Object.values(FILES).forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
  });
}

// ── MONGODB STORAGE ──────────────────────────────────────────
let db = null;
let mail = null;
const COLL = {
  products: 'products',
  transactions: 'transactions',
  andreyReturns: 'andreyReturns',
  subAccounts: 'subAccounts',
  hostSubscriptions: 'hostSubscriptions',
  assistantQuestions: 'assistantQuestions',
};
const ADMIN_ONLY_KEYS = ['subAccounts', 'hostSubscriptions'];
const ASSISTANT_LOW_CONFIDENCE_THRESHOLD = 0.5;
const ASSISTANT_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

async function connectMongo() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('inventory');
  await ensureAssistantQuestionIndexes(db);
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

function uniqueProductTypes(products) {
  return [...new Set(products.map(p => String(p.productType || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function safeUsers() {
  return USERS.map(user => ({ username: user.username, role: user.role }));
}

function readTextFile(fileName, fallback = '') {
  const filePath = path.join(__dirname, fileName);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : fallback;
}

function writeTextFile(fileName, value) {
  fs.writeFileSync(path.join(__dirname, fileName), String(value), 'utf8');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createZip(entries) {
  const now = dosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  Object.entries(entries).forEach(([name, value]) => {
    const nameBuffer = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(now.dosTime, 12);
    central.writeUInt16LE(now.dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function parseZip(buffer) {
  const entries = {};
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    if (method !== 0) throw new Error('Only stored ZIP entries are supported');
    const expectedCrc = buffer.readUInt32LE(offset + 14);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString('utf8');
    const dataStart = nameStart + fileNameLength + extraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    if (crc32(data) !== expectedCrc) throw new Error('ZIP entry checksum mismatch');
    entries[name] = data;
    offset = dataStart + compressedSize;
  }
  return entries;
}

function jsonEntry(entries, name) {
  if (!entries[name]) throw new Error(`Missing ${name}`);
  return JSON.parse(entries[name].toString('utf8'));
}

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

function normalizeBackupSections(input, allowed = BACKUP_SECTIONS) {
  const requested = Array.isArray(input) && input.length ? input : allowed;
  return requested.filter((section, index) => (
    allowed.includes(section) && requested.indexOf(section) === index
  ));
}

async function buildBackup(sections) {
  const data = await dbGetAll();
  const selected = normalizeBackupSections(sections);
  const entries = {};
  const manifestCollections = [];

  function addJson(section, fileName, value) {
    if (!selected.includes(section)) return;
    entries[fileName] = jsonText(value);
    manifestCollections.push(section);
  }

  addJson('products', 'products.json', data.products || []);
  addJson('sales', 'sales.json', (data.transactions || []).filter(tx => tx.type === 'sale'));
  addJson('settings', 'settings.json', {
    subAccounts: data.subAccounts || [],
    hostSubscriptions: data.hostSubscriptions || [],
  });
  addJson('faq', 'faq.json', jsonEntry({ 'faq.json': Buffer.from(readTextFile('faq.json', '[]')) }, 'faq.json'));
  addJson('categories', 'categories.json', uniqueProductTypes(data.products || []));
  addJson('translations', 'translations.json', { file: 'i18n.js', content: readTextFile('i18n.js') });
  addJson('users', 'users.json', safeUsers());

  entries['manifest.json'] = jsonText({
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    collections: manifestCollections,
    restorableCollections: manifestCollections.filter(section => RESTORABLE_BACKUP_SECTIONS.includes(section)),
    exportOnlyCollections: manifestCollections.filter(section => !RESTORABLE_BACKUP_SECTIONS.includes(section)),
  });

  return createZip(entries);
}

function inspectBackupBuffer(buffer) {
  const entries = parseZip(buffer);
  const manifest = jsonEntry(entries, 'manifest.json');
  const collections = normalizeBackupSections(manifest.collections || [], BACKUP_SECTIONS);
  return {
    entries,
    manifest,
    collections,
    restorableCollections: collections.filter(section => RESTORABLE_BACKUP_SECTIONS.includes(section)),
    exportOnlyCollections: collections.filter(section => !RESTORABLE_BACKUP_SECTIONS.includes(section)),
  };
}

async function restoreBackup(buffer, sections) {
  const inspected = inspectBackupBuffer(buffer);
  const selected = normalizeBackupSections(sections, RESTORABLE_BACKUP_SECTIONS)
    .filter(section => inspected.restorableCollections.includes(section));
  const restored = [];

  if (selected.includes('products')) {
    await dbSave('products', jsonEntry(inspected.entries, 'products.json'));
    restored.push('products');
  }
  if (selected.includes('sales')) {
    await dbSave('transactions', jsonEntry(inspected.entries, 'sales.json'));
    restored.push('sales');
  }
  if (selected.includes('settings')) {
    const settings = jsonEntry(inspected.entries, 'settings.json');
    await dbSave('subAccounts', settings.subAccounts || []);
    await dbSave('hostSubscriptions', settings.hostSubscriptions || []);
    restored.push('settings');
  }
  if (selected.includes('faq')) {
    writeTextFile('faq.json', jsonText(jsonEntry(inspected.entries, 'faq.json')));
    restored.push('faq');
  }
  if (selected.includes('translations')) {
    const translations = jsonEntry(inspected.entries, 'translations.json');
    if (translations.file !== 'i18n.js' || typeof translations.content !== 'string') {
      throw new Error('Invalid translations payload');
    }
    writeTextFile('i18n.js', translations.content);
    restored.push('translations');
  }

  return { manifest: inspected.manifest, restored };
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

function publicProductsFromData(products) {
  return (products || [])
    .map(publicProduct)
    .filter(product => product.inStock)
    .sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color));
}

const CATALOG_INITIAL_PRODUCTS = [
  { id: 'light2', aliases: ['лайт 2', 'light 2', 'light2', 'lite 2', 'lite2'], title: 'Станция Лайт 2', line: 'Компактная умная колонка с Алисой, LED-дисплеем и управлением голосом.', colors: [
    { key: 'blue', aliases: ['голуб'], image: 'images/catalog/light-2/blue/01.webp', label: 'голубой' },
    { key: 'violet', aliases: ['фиолет'], image: 'images/catalog/light-2/violet/01.webp', label: 'фиолетовый' },
    { key: 'green', aliases: ['зелен', 'зелён'], image: 'images/catalog/light-2/green/01.webp', label: 'зелёный' },
    { key: 'pink', aliases: ['розов'], image: 'images/catalog/light-2/pink/01.webp', label: 'розовый' },
    { key: 'coral', aliases: ['корал'], image: 'images/catalog/light-2/coral/01.webp', label: 'коралловый' },
    { key: 'black', aliases: ['черн', 'чёрн', 'графит'], image: 'images/catalog/light-2/black/01.webp', label: 'чёрный' },
  ] },
  { id: 'mini3', aliases: ['мини 3', 'mini 3', 'mini3'], title: 'Станция Мини 3', line: 'Компактная колонка с более уверенным звуком для кухни, спальни или гостиной.', colors: [
    { key: 'gray', aliases: ['сер', 'сереб'], image: 'images/catalog/mini-3/gray/01.webp', label: 'серый' },
  ] },
  { id: 'miniPro', aliases: ['мини 3 про', 'мини про', 'mini 3 pro', 'mini pro', 'minipro'], title: 'Станция Мини 3 Про', line: 'Колонка для умного дома с насыщенным звуком и управлением совместимыми устройствами.', colors: [
    { key: 'green', aliases: ['зелен', 'зелён'], image: 'images/catalog/mini-pro/green/01.webp', label: 'зелёный' },
    { key: 'blue', aliases: ['голуб', 'син'], image: 'images/catalog/mini-pro/blue/01.webp', label: 'голубой' },
    { key: 'gray', aliases: ['сер', 'сереб'], image: 'images/catalog/mini-pro/gray/01.webp', label: 'серый' },
    { key: 'graphite', aliases: ['черн', 'чёрн', 'графит'], image: 'images/catalog/mini-pro/graphite/01.webp', label: 'графит' },
  ] },
  { id: 'street', aliases: ['стрит', 'street'], title: 'Станция Стрит', line: 'Портативная умная колонка для музыки дома и на улице.', colors: [
    { key: 'green', aliases: ['зелен', 'зелён', 'олив'], image: 'images/catalog/street/green/01.webp', label: 'зелёный' },
    { key: 'gray', aliases: ['сер', 'сереб'], image: 'images/catalog/street/gray/01.webp', label: 'серый' },
    { key: 'violet', aliases: ['фиолет'], image: 'images/catalog/street/violet/01.webp', label: 'фиолетовый' },
    { key: 'black', aliases: ['черн', 'чёрн', 'графит'], image: 'images/catalog/street/black/01.webp', label: 'чёрный' },
  ] },
];

function normalizeCatalogText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
}

function firstCatalogProduct(publicProducts) {
  for (const model of CATALOG_INITIAL_PRODUCTS) {
    const products = productsForCatalogModel(publicProducts, model);
    for (const color of model.colors) {
      const product = productForCatalogColor(products, color);
      if (product) return { model, color, product, price: Number(product.sellPrice) || 0 };
    }
  }
  return null;
}

function productsForCatalogModel(publicProducts, model) {
  return publicProducts.filter(product => {
    const haystack = normalizeCatalogText([product.productType, product.label, product.color].join(' '));
    return model.aliases.some(alias => haystack.includes(normalizeCatalogText(alias)));
  });
}

function productForCatalogColor(products, color) {
  return products.find(product => {
    const haystack = normalizeCatalogText([product.color, product.label, product.productType].join(' '));
    return color.aliases.some(alias => haystack.includes(normalizeCatalogText(alias)));
  }) || null;
}

function requestedCatalogProduct(publicProducts, query = {}) {
  const [selectedModel, selectedColor] = String(query.select || '').split(':');
  const modelId = String(query.model || selectedModel || '');
  const rawColor = query.color ?? selectedColor;
  const hasColor = rawColor !== undefined && rawColor !== '';
  const colorIndex = hasColor ? Number(rawColor) : 0;
  if (!modelId || !Number.isInteger(colorIndex) || colorIndex < 0) return null;

  const model = CATALOG_INITIAL_PRODUCTS.find(item => item.id === modelId);
  const color = model?.colors[colorIndex];
  if (!model || !color) return null;

  const product = productForCatalogColor(productsForCatalogModel(publicProducts, model), color);
  return product ? { model, color, product, price: Number(product.sellPrice) || 0 } : null;
}

async function catalogInitialData(query = {}) {
  const { products } = await dbGetAll();
  const publicProducts = publicProductsFromData(products);
  return {
    products: publicProducts,
    initial: requestedCatalogProduct(publicProducts, query) || firstCatalogProduct(publicProducts),
  };
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function sendCatalogPage(req, res, next) {
  let data;
  try {
    data = await catalogInitialData(req.query);
  } catch (err) {
    console.error('Catalog page inventory error:', err.message);
    const fallbackProduct = { id: 'fallback-light2-blue', productType: 'Light 2', color: 'blue', label: 'Light 2 / blue', sellPrice: 90, inStock: true };
    data = {
      products: [fallbackProduct],
      initial: requestedCatalogProduct([fallbackProduct], req.query) || firstCatalogProduct([fallbackProduct]),
    };
  }

  try {
    const initial = data.initial;
    const template = readTextFile('catalog.html');
    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    res.set('Surrogate-Control', 'no-store');
    res.type('html').send(template
      .replace(/__CATALOG_PRELOAD_HREF__/g, initial?.color?.image || '')
      .replace(/__CATALOG_INITIAL_TITLE__/g, initial?.model?.title || 'Умные колонки с Алисой')
      .replace(/__CATALOG_INITIAL_LINE__/g, initial?.model?.line || 'Умные колонки с Алисой в наличии в Риге.')
      .replace(/__CATALOG_INITIAL_PRICE__/g, initial?.price ? `${initial.price.toLocaleString('ru')} €` : '')
      .replace(/__CATALOG_INITIAL_IMAGE__/g, initial?.color?.image || '')
      .replace(/__CATALOG_INITIAL_ALT__/g, initial ? `${initial.model.title}, ${initial.color.label}` : 'Умная колонка с Алисой')
      .replace('__CATALOG_INITIAL_DATA__', escapeJsonForHtml(data)));
  } catch (err) {
    console.error('Catalog page render error:', err.message);
    next(err);
  }
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
  ['/reports', 'reports.html'],
  ['/analytics', 'reports.html'],
  ['/reports.html', 'reports.html'],
  ['/reports.css', 'reports.css'],
  ['/reports.js', 'reports.js'],
  ['/app.js', 'app.js'],
  ['/style.css', 'style.css'],
  ['/favicon.ico', 'favicon.ico'],
]);
const assistantQuestionRate = new Map();

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
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://www.google-analytics.com",
      "font-src 'self' data:",
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
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

function parseReportYears(value, sales) {
  const explicit = String(value || '')
    .split(',')
    .map(year => Number(year.trim()))
    .filter(year => Number.isInteger(year) && year >= 2000 && year <= 2100);
  if (explicit.length) return [...new Set(explicit)].sort((a, b) => a - b);
  const years = sales
    .map(tx => new Date(tx.date).getFullYear())
    .filter(year => Number.isInteger(year) && year >= 2000 && year <= 2100);
  const current = new Date().getFullYear();
  return [...new Set(years.length ? years : [current])].sort((a, b) => a - b);
}

function reportPeriods(groupBy) {
  if (groupBy === 'quarter') {
    return Array.from({ length: 4 }, (_, index) => ({
      index,
      key: `Q${index + 1}`,
      label: `Q${index + 1}`,
    }));
  }
  if (groupBy === 'year') {
    return [{ index: 0, key: 'year', label: 'Year' }];
  }
  return Array.from({ length: 12 }, (_, index) => ({
    index,
    key: String(index + 1).padStart(2, '0'),
    label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index],
  }));
}

function salePeriodIndex(date, groupBy) {
  if (groupBy === 'year') return 0;
  const month = date.getMonth();
  return groupBy === 'quarter' ? Math.floor(month / 3) : month;
}

function emptySalesBucket(year, period) {
  return {
    year,
    period: period.key,
    label: period.label,
    qty: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    marginPct: 0,
  };
}

function buildSalesReport(transactions, options = {}) {
  const groupBy = ['month', 'quarter', 'year'].includes(options.groupBy) ? options.groupBy : 'month';
  const sales = (transactions || []).filter(tx => tx.type === 'sale');
  const years = parseReportYears(options.years, sales);
  const periods = reportPeriods(groupBy);
  const buckets = new Map();

  years.forEach(year => {
    periods.forEach(period => {
      buckets.set(`${year}:${period.index}`, emptySalesBucket(year, period));
    });
  });

  sales.forEach(tx => {
    const date = new Date(tx.date);
    if (Number.isNaN(date.getTime())) return;
    const year = date.getFullYear();
    if (!years.includes(year)) return;
    const periodIndex = salePeriodIndex(date, groupBy);
    const bucket = buckets.get(`${year}:${periodIndex}`);
    if (!bucket) return;
    bucket.qty += Number(tx.qty) || 0;
    bucket.revenue += Number(tx.total) || 0;
    bucket.cost += Number(tx.costTotal) || 0;
    bucket.profit += Number(tx.profit) || 0;
  });

  const rows = [...buckets.values()].map(bucket => ({
    ...bucket,
    marginPct: bucket.revenue ? bucket.profit / bucket.revenue * 100 : 0,
  }));
  const totals = rows.reduce((sum, row) => {
    sum.qty += row.qty;
    sum.revenue += row.revenue;
    sum.cost += row.cost;
    sum.profit += row.profit;
    return sum;
  }, { qty: 0, revenue: 0, cost: 0, profit: 0, marginPct: 0 });
  totals.marginPct = totals.revenue ? totals.profit / totals.revenue * 100 : 0;

  return {
    groupBy,
    years,
    periods,
    rows,
    totals,
    availableYears: [...new Set(sales
      .map(tx => new Date(tx.date).getFullYear())
      .filter(year => Number.isInteger(year) && year >= 2000 && year <= 2100))]
      .sort((a, b) => b - a),
  };
}

app.use(setSecurityHeaders);
app.use(setCorsHeaders);
app.use(express.json({ limit: '30mb' }));

function requestHost(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const rawHost = forwardedHost || req.headers.host || req.hostname || '';
  return String(rawHost).toLowerCase().replace(/:\d+$/, '');
}

function isCatalogHost(req) {
  return CATALOG_HOSTS.includes(requestHost(req));
}

function redirectWwwCatalogHost(req, res, next) {
  if (requestHost(req) === 'www.heysmart.lv') {
    return res.redirect(301, `https://heysmart.lv${req.originalUrl || '/'}`);
  }
  return next();
}

function isInventoryHost(req) {
  const host = requestHost(req);
  return host === INVENTORY_HOST || host === 'localhost' || host === '127.0.0.1';
}

function isLocalHost(req) {
  const host = requestHost(req);
  return host === 'localhost' || host === '127.0.0.1';
}

function requireInventoryHost(req, res, next) {
  if (isInventoryHost(req)) return next();
  return res.status(404).send('Not found');
}

// Domain split for one Railway service:
// - inv-app.up.railway.app keeps the existing Inventory App behavior.
// - heysmart.up.railway.app and heysmart.lv expose only the public catalog site and its safe assets.
// - mysmart.up.railway.app is kept as a catalog alias.
app.use(redirectWwwCatalogHost);

app.get('/', (req, res, next) => {
  if (isCatalogHost(req)) {
    return sendCatalogPage(req, res, next);
  }
  return next();
});

app.get('/catalog.html', (req, res, next) => {
  if (isCatalogHost(req)) {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(302, `/${query}`);
  }
  if (isLocalHost(req)) {
    return sendCatalogPage(req, res, next);
  }
  return next();
});

app.get(['/catalog.css', '/catalog.js', '/assistant-engine.js', '/i18n.js', '/faq.json', '/site.webmanifest', '/robots.txt', '/sitemap.xml', '/404.html', '/favicon.ico'], (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    return res.sendFile(path.join(__dirname, req.path.slice(1)));
  }
  return next();
});

app.get('/mail', (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    return res.sendFile(path.join(__dirname, 'mail.html'));
  }
  return next();
});

app.get(['/mail.html', '/mail.css', '/mail.js'], (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    return res.sendFile(path.join(__dirname, req.path.slice(1)));
  }
  return next();
});

app.use('/icons', (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    return express.static(path.join(__dirname, 'icons'), {
      maxAge: '30d',
      immutable: true,
    })(req, res, next);
  }
  return next();
});

app.use('/images/catalog', (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    return express.static(path.join(__dirname, 'images', 'catalog'), {
      maxAge: '30d',
      immutable: true,
    })(req, res, next);
  }
  return next();
});

app.get('/images/og-image.jpg', (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    return res.sendFile(path.join(__dirname, 'images', 'og-image.jpg'));
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
  const publicCatalogApi = req.path === '/api/public/products'
    || req.path === '/api/public/assistant-question'
    || req.path.startsWith('/api/public/assistant-question/')
    || req.path.startsWith('/api/mail/');
  if (isCatalogHost(req) && req.path.startsWith('/api/') && !publicCatalogApi) {
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

mail = createMailService({
  express,
  dbProvider: () => db,
  jwtSecret: JWT_SECRET,
  requireAuth,
  requireAdmin,
});

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

app.use(mail.router);

// ── DATA ROUTES ──────────────────────────────────────────────
app.get('/api/public/products', async (req, res) => {
  try {
    const { products } = await dbGetAll();
    res.json({ products: publicProductsFromData(products) });
  } catch (e) {
    console.error('Public products error:', e.message);
    sendGenericError(res);
  }
});

function sanitizeAssistantQuestion(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function sanitizeAssistantText(value, limit = 1000) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function sanitizeAssistantUrl(value) {
  try {
    const url = new URL(String(value || ''), 'https://heysmart.lv');
    const allowed = new Set(['model', 'color', 'select', 'lang']);
    [...url.searchParams.keys()].forEach(key => {
      if (!allowed.has(key)) url.searchParams.delete(key);
    });
    return `${url.pathname}${url.search}${url.hash}`.slice(0, 300);
  } catch {
    return '';
  }
}

function normalizeQuestionText(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim().slice(0, 180);
}

function assistantRateAllowed(req, bucket = 'create', limit = 12) {
  const key = `${bucket}:${assistantRateKey(req)}`;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const current = assistantQuestionRate.get(key) || [];
  const recent = current.filter(time => now - time < windowMs);
  if (recent.length >= limit) {
    assistantQuestionRate.set(key, recent);
    return false;
  }
  recent.push(now);
  assistantQuestionRate.set(key, recent);
  return true;
}

function assistantRateKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function readAssistantQuestionsFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILES.assistantQuestions, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAssistantQuestionsFile(records) {
  fs.writeFileSync(FILES.assistantQuestions, JSON.stringify(records.slice(-1000), null, 2), 'utf8');
}

async function ensureAssistantQuestionIndexes(database) {
  if (!database) return;
  const coll = database.collection(COLL.assistantQuestions);
  await Promise.all([
    coll.createIndex({ createdAt: -1 }),
    coll.createIndex({ matched: 1 }),
    coll.createIndex({ matchedFaqId: 1 }),
    coll.createIndex({ confidence: 1 }),
    coll.createIndex({ feedback: 1 }),
    coll.createIndex({ reviewed: 1 }),
    coll.createIndex({ sessionId: 1 }),
  ]);
}

function isMongoId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || ''));
}

function assistantRecordId(record) {
  return String(record._id || record.id || '');
}

function toPublicAssistantRecord(record) {
  const normalizedQuestion = record.normalizedQuestion || normalizeQuestionText(record.question);
  const item = {
    id: assistantRecordId(record),
    question: record.question || '',
    answer: record.answer || '',
    locale: record.locale || 'ru',
    matched: Boolean(record.matched),
    matchedFaqId: record.matchedFaqId || null,
    confidence: Number(record.confidence) || 0,
    responseType: record.responseType || record.intent || '',
    intent: record.intent || record.responseType || '',
    modelId: record.modelId || '',
    colorKey: record.colorKey || '',
    pageUrl: record.pageUrl || '',
    sessionId: record.sessionId || '',
    feedback: record.feedback || '',
    reviewed: Boolean(record.reviewed),
    adminNote: record.adminNote || '',
    normalizedQuestion,
    createdAt: record.createdAt || '',
  };
  item.improvementReasons = assistantImprovementReasons(item);
  return item;
}

function assistantImprovementReasons(record) {
  const item = record.normalizedQuestion !== undefined ? record : toPublicAssistantRecord(record);
  const reasons = [];
  if (item.feedback === 'not_helpful') reasons.push('Negative feedback');
  if (item.matched === false) reasons.push('No FAQ match');
  if ((Number(item.confidence) || 0) < ASSISTANT_LOW_CONFIDENCE_THRESHOLD) reasons.push('Low confidence');
  return reasons;
}

function isAssistantImprovementCandidate(record, reviewedMode = false) {
  const item = toPublicAssistantRecord(record);
  if (!item.normalizedQuestion) return false;
  if (reviewedMode ? !item.reviewed : item.reviewed) return false;
  return item.improvementReasons.length > 0;
}

function assistantImprovementPriority(record) {
  const item = toPublicAssistantRecord(record);
  return [
    item.feedback === 'not_helpful' ? 0 : 1,
    item.matched === false ? 0 : 1,
    Number(item.confidence) || 0,
    -new Date(item.createdAt || 0).getTime(),
  ];
}

function compareAssistantImprovement(a, b) {
  const ap = assistantImprovementPriority(a);
  const bp = assistantImprovementPriority(b);
  for (let i = 0; i < ap.length; i++) {
    if (ap[i] !== bp[i]) return ap[i] < bp[i] ? -1 : 1;
  }
  return 0;
}

function removeAssistantSessionDuplicates(records) {
  const seen = new Map();
  return records.filter(record => {
    const item = toPublicAssistantRecord(record);
    if (!item.sessionId || !item.normalizedQuestion) return true;
    const time = new Date(item.createdAt || 0).getTime();
    const key = `${item.sessionId}:${item.normalizedQuestion}`;
    const previous = seen.get(key);
    if (previous != null && Math.abs(time - previous) <= ASSISTANT_DUPLICATE_WINDOW_MS) return false;
    seen.set(key, Number.isFinite(time) ? time : 0);
    return true;
  });
}

async function createAssistantQuestion(entry) {
  const id = crypto.randomUUID();
  const record = { id, ...entry };
  if (USE_MONGO) {
    const result = await db.collection(COLL.assistantQuestions).insertOne(record);
    return String(result.insertedId);
  }
  const existing = readAssistantQuestionsFile();
  existing.push(record);
  writeAssistantQuestionsFile(existing);
  return id;
}

async function updateAssistantFeedback(id, feedback) {
  if (USE_MONGO) {
    if (!isMongoId(id)) return false;
    const result = await db.collection(COLL.assistantQuestions).updateOne({ _id: new ObjectId(id) }, { $set: { feedback } });
    return result.matchedCount > 0;
  }
  const existing = readAssistantQuestionsFile();
  const idx = existing.findIndex(record => assistantRecordId(record) === id);
  if (idx < 0) return false;
  existing[idx].feedback = feedback;
  writeAssistantQuestionsFile(existing);
  return true;
}

function assistantFilterFromQuery(query) {
  const filter = {};
  if (query.preset === 'needs_improvement') filter.preset = 'needs_improvement';
  if (['ru', 'en', 'lv'].includes(query.locale)) filter.locale = query.locale;
  if (query.matched === 'true') filter.matched = true;
  if (query.matched === 'false') filter.matched = false;
  if (query.faqId) filter.matchedFaqId = sanitizeAssistantText(query.faqId, 80);
  if (['helpful', 'not_helpful', 'none'].includes(query.feedback)) filter.feedback = query.feedback;
  if (query.reviewed === 'true') filter.reviewed = true;
  if (query.reviewed === 'false') filter.reviewed = false;
  const minConfidence = Number(query.minConfidence);
  const maxConfidence = Number(query.maxConfidence);
  if (!Number.isNaN(minConfidence)) filter.minConfidence = Math.max(0, Math.min(1, minConfidence));
  if (!Number.isNaN(maxConfidence)) filter.maxConfidence = Math.max(0, Math.min(1, maxConfidence));
  if (query.from) filter.from = String(query.from).slice(0, 40);
  if (query.to) filter.to = String(query.to).slice(0, 40);
  if (query.search) filter.search = sanitizeAssistantText(query.search, 120).toLowerCase();
  filter.sort = ['oldest', 'lowest_confidence'].includes(query.sort) ? query.sort : 'newest';
  filter.page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  filter.limit = Math.max(1, Math.min(100, Number(query.limit) || 25));
  return filter;
}

function assistantRecordMatches(record, filter) {
  const item = toPublicAssistantRecord(record);
  if (filter.preset === 'needs_improvement' && !isAssistantImprovementCandidate(item, filter.reviewed === true)) return false;
  if (filter.locale && item.locale !== filter.locale) return false;
  if (typeof filter.matched === 'boolean' && item.matched !== filter.matched) return false;
  if (filter.matchedFaqId && item.matchedFaqId !== filter.matchedFaqId) return false;
  if (filter.feedback === 'none' && item.feedback) return false;
  if (filter.feedback && filter.feedback !== 'none' && item.feedback !== filter.feedback) return false;
  if (typeof filter.reviewed === 'boolean' && item.reviewed !== filter.reviewed) return false;
  if (filter.minConfidence != null && item.confidence < filter.minConfidence) return false;
  if (filter.maxConfidence != null && item.confidence > filter.maxConfidence) return false;
  if (filter.from && String(item.createdAt) < filter.from) return false;
  if (filter.to && String(item.createdAt) > filter.to) return false;
  if (filter.search && !String(item.question).toLowerCase().includes(filter.search)) return false;
  return true;
}

function summarizeAssistantRecords(records) {
  const normalized = new Map();
  const faq = new Map();
  const summary = { total: records.length, unmatched: 0, lowConfidence: 0, negativeFeedback: 0, improvement: { total: 0, negativeFeedback: 0, unmatched: 0, lowConfidence: 0 }, repeatedQuestions: [], matchedFaqs: [] };
  records.forEach(record => {
    const item = toPublicAssistantRecord(record);
    if (!item.matched) summary.unmatched++;
    if (item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD) summary.lowConfidence++;
    if (item.feedback === 'not_helpful') summary.negativeFeedback++;
    const nq = item.normalizedQuestion;
    if (nq) normalized.set(nq, (normalized.get(nq) || 0) + 1);
    if (item.matchedFaqId) faq.set(item.matchedFaqId, (faq.get(item.matchedFaqId) || 0) + 1);
  });
  summary.repeatedQuestions = [...normalized.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([text, count]) => ({ text, count }));
  summary.matchedFaqs = [...faq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ id, count }));
  const improvementItems = removeAssistantSessionDuplicates(records.filter(record => isAssistantImprovementCandidate(record, false)));
  summary.improvement.total = improvementItems.length;
  improvementItems.forEach(record => {
    const item = toPublicAssistantRecord(record);
    if (item.feedback === 'not_helpful') summary.improvement.negativeFeedback++;
    if (item.matched === false) summary.improvement.unmatched++;
    if (item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD) summary.improvement.lowConfidence++;
  });
  return summary;
}

async function listAssistantQuestions(query) {
  const filter = assistantFilterFromQuery(query);
  if (USE_MONGO) {
    const mongoFilter = {};
    if (filter.locale) mongoFilter.locale = filter.locale;
    if (typeof filter.matched === 'boolean') mongoFilter.matched = filter.matched;
    if (filter.matchedFaqId) mongoFilter.matchedFaqId = filter.matchedFaqId;
    if (filter.feedback === 'none') mongoFilter.feedback = { $in: [null, ''] };
    else if (filter.feedback) mongoFilter.feedback = filter.feedback;
    if (typeof filter.reviewed === 'boolean') mongoFilter.reviewed = filter.reviewed;
    if (filter.minConfidence != null || filter.maxConfidence != null) mongoFilter.confidence = {};
    if (filter.minConfidence != null) mongoFilter.confidence.$gte = filter.minConfidence;
    if (filter.maxConfidence != null) mongoFilter.confidence.$lte = filter.maxConfidence;
    if (filter.from || filter.to) mongoFilter.createdAt = {};
    if (filter.from) mongoFilter.createdAt.$gte = filter.from;
    if (filter.to) mongoFilter.createdAt.$lte = filter.to;
    if (filter.search) mongoFilter.question = { $regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const sort = filter.sort === 'oldest' ? { createdAt: 1 } : filter.sort === 'lowest_confidence' ? { confidence: 1, createdAt: -1 } : { createdAt: -1 };
    const coll = db.collection(COLL.assistantQuestions);
    if (filter.preset === 'needs_improvement') {
      const candidates = await coll.find(mongoFilter, { projection: { userAgent: 0 } }).sort({ createdAt: -1 }).limit(5000).toArray();
      const filtered = removeAssistantSessionDuplicates(candidates.filter(record => assistantRecordMatches(record, filter))).sort(compareAssistantImprovement);
      const start = (filter.page - 1) * filter.limit;
      return {
        items: filtered.slice(start, start + filter.limit).map(toPublicAssistantRecord),
        total: filtered.length,
        page: filter.page,
        limit: filter.limit,
        summary: summarizeAssistantRecords(candidates),
        meta: { lowConfidenceThreshold: ASSISTANT_LOW_CONFIDENCE_THRESHOLD, preset: filter.preset || '' },
      };
    }
    const [total, records, summaryRecords] = await Promise.all([
      coll.countDocuments(mongoFilter),
      coll.find(mongoFilter, { projection: { userAgent: 0 } }).sort(sort).skip((filter.page - 1) * filter.limit).limit(filter.limit).toArray(),
      coll.find(mongoFilter, { projection: { question: 1, matched: 1, matchedFaqId: 1, confidence: 1, feedback: 1, normalizedQuestion: 1 } }).limit(5000).toArray(),
    ]);
    return { items: records.map(toPublicAssistantRecord), total, page: filter.page, limit: filter.limit, summary: summarizeAssistantRecords(summaryRecords), meta: { lowConfidenceThreshold: ASSISTANT_LOW_CONFIDENCE_THRESHOLD, preset: filter.preset || '' } };
  }
  const all = readAssistantQuestionsFile().filter(record => assistantRecordMatches(record, filter));
  const deduped = filter.preset === 'needs_improvement' ? removeAssistantSessionDuplicates(all) : all;
  const sorted = deduped.sort((a, b) => {
    if (filter.preset === 'needs_improvement') return compareAssistantImprovement(a, b);
    if (filter.sort === 'oldest') return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    if (filter.sort === 'lowest_confidence') return (Number(a.confidence) || 0) - (Number(b.confidence) || 0);
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  const start = (filter.page - 1) * filter.limit;
  return { items: sorted.slice(start, start + filter.limit).map(toPublicAssistantRecord), total: sorted.length, page: filter.page, limit: filter.limit, summary: summarizeAssistantRecords(readAssistantQuestionsFile().filter(record => assistantRecordMatches(record, { ...filter, preset: '' }))), meta: { lowConfidenceThreshold: ASSISTANT_LOW_CONFIDENCE_THRESHOLD, preset: filter.preset || '' } };
}

async function updateAssistantAdminRecord(id, body) {
  const patch = {};
  if (typeof body.reviewed === 'boolean') patch.reviewed = body.reviewed;
  if (body.adminNote !== undefined) patch.adminNote = sanitizeAssistantText(body.adminNote, 500);
  if (!Object.keys(patch).length) return false;
  if (USE_MONGO) {
    if (!isMongoId(id)) return false;
    const result = await db.collection(COLL.assistantQuestions).updateOne({ _id: new ObjectId(id) }, { $set: patch });
    return result.matchedCount > 0;
  }
  const existing = readAssistantQuestionsFile();
  const idx = existing.findIndex(record => assistantRecordId(record) === id);
  if (idx < 0) return false;
  existing[idx] = { ...existing[idx], ...patch };
  writeAssistantQuestionsFile(existing);
  return true;
}

app.post('/api/public/assistant-question', async (req, res) => {
  try {
    if (!assistantRateAllowed(req, 'create', 12)) return res.status(429).json({ ok: false });
    const question = sanitizeAssistantQuestion(req.body?.question);
    if (!question) return res.status(400).json({ ok: false });
    const locale = ['ru', 'en', 'lv'].includes(req.body?.locale) ? req.body.locale : 'ru';
    const answer = sanitizeAssistantText(req.body?.answer, 1200);
    const matched = Boolean(req.body?.matched);
    const matchedFaqId = sanitizeAssistantText(req.body?.matchedFaqId, 80) || null;
    const confidence = Math.max(0, Math.min(1, Number(req.body?.confidence) || 0));
    const sessionId = sanitizeAssistantText(req.body?.sessionId, 80).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    const entry = {
      question,
      answer,
      locale,
      matched,
      matchedFaqId,
      confidence,
      responseType: sanitizeAssistantText(req.body?.responseType, 60),
      intent: sanitizeAssistantText(req.body?.intent, 60),
      modelId: sanitizeAssistantText(req.body?.modelId, 80),
      colorKey: sanitizeAssistantText(req.body?.colorKey, 60),
      pageUrl: sanitizeAssistantUrl(req.body?.pageUrl),
      sessionId,
      normalizedQuestion: normalizeQuestionText(question),
      reviewed: false,
      adminNote: '',
      createdAt: new Date().toISOString(),
    };
    const id = await createAssistantQuestion(entry);
    res.json({ ok: true, id });
  } catch (e) {
    console.error('Assistant question route error:', e.message);
    res.json({ ok: true });
  }
});

app.patch('/api/public/assistant-question/:id/feedback', async (req, res) => {
  try {
    if (!assistantRateAllowed(req, 'feedback', 30)) return res.status(429).json({ ok: false });
    const feedback = req.body?.feedback;
    if (!['helpful', 'not_helpful'].includes(feedback)) return res.status(400).json({ error: 'Invalid feedback' });
    const ok = await updateAssistantFeedback(req.params.id, feedback);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Assistant feedback route error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/assistant-questions', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await listAssistantQuestions(req.query));
  } catch (e) {
    console.error('Assistant questions admin list error:', e.message);
    sendGenericError(res);
  }
});

app.patch('/api/admin/assistant-questions/:id', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await updateAssistantAdminRecord(req.params.id, req.body || {});
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Assistant questions admin update error:', e.message);
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

app.get('/api/reports/sales', requireInventoryHost, requireAuth, async (req, res) => {
  try {
    const data = await dbGetAll();
    res.json(buildSalesReport(data.transactions || [], {
      groupBy: req.query.groupBy,
      years: req.query.years,
    }));
  } catch (e) {
    console.error('Sales report route error:', e.message);
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

app.post('/api/backups/export', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const zip = await buildBackup(req.body?.sections);
    const fileDate = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-backup-${fileDate}.zip"`);
    res.send(zip);
  } catch (e) {
    console.error('Backup export error:', e.message);
    sendGenericError(res);
  }
});

app.post('/api/backups/import/inspect', requireInventoryHost, requireAuth, requireAdmin, express.raw({ type: 'application/zip', limit: '20mb' }), (req, res) => {
  try {
    const inspected = inspectBackupBuffer(Buffer.from(req.body || []));
    res.json({
      manifest: inspected.manifest,
      collections: inspected.collections,
      restorableCollections: inspected.restorableCollections,
      exportOnlyCollections: inspected.exportOnlyCollections,
    });
  } catch (e) {
    console.error('Backup inspect error:', e.message);
    res.status(400).json({ error: 'Invalid backup ZIP' });
  }
});

app.post('/api/backups/import', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const backupBase64 = String(req.body?.backupBase64 || '');
    if (!req.body?.confirm) return res.status(400).json({ error: 'Import confirmation required' });
    if (!backupBase64) return res.status(400).json({ error: 'backupBase64 required' });
    const result = await restoreBackup(Buffer.from(backupBase64, 'base64'), req.body?.sections);
    res.json({ ok: true, restored: result.restored, manifest: result.manifest });
  } catch (e) {
    console.error('Backup import error:', e.message);
    res.status(400).json({ error: 'Invalid backup import' });
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
  if (USE_MONGO) {
    await connectMongo();
    await mail.ensureMailIndexes(db);
  } else {
    console.log('📁  Using local JSON files (no MONGODB_URI set)');
  }
  app.listen(PORT, () => {
    console.log(`Inventory app running at http://localhost:${PORT}`);
  });
  if (USE_MONGO) mail.startMailPoller(db);
}

start().catch(err => {
  console.error('❌  Failed to start:', err.message);
  process.exit(1);
});
