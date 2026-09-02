require('dotenv').config();
const express   = require('express');
const fs        = require('fs');
const path      = require('path');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const { createMailService } = require('./mail-service');
const knowledgeBase = require('./knowledge-base');

const app      = express();
app.set('trust proxy', 1);
const PORT     = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USE_MONGO = !!process.env.MONGODB_URI;
const INVENTORY_HOST = 'inv-app.up.railway.app';
const CATALOG_HOSTS = ['mysmart.up.railway.app', 'heysmart.up.railway.app', 'heysmart.lv', 'www.heysmart.lv'];
const BACKUP_VERSION = 1;
const BACKUP_SECTIONS = ['products', 'sales', 'settings', 'faq', 'categories', 'translations', 'users'];
const RESTORABLE_BACKUP_SECTIONS = ['products', 'sales', 'settings', 'faq', 'translations'];
const ANALYTICS_RETENTION_DAYS = Math.max(1, Number(process.env.ANALYTICS_RETENTION_DAYS) || 90);
const ANALYTICS_EVENT_TYPES = new Set([
  'page_view',
  'model_view',
  'color_change',
  'assistant_open',
  'assistant_question',
  'assistant_recommendation',
  'contact_click',
  'whatsapp_click',
  'telegram_click',
  'language_change',
  'details_open',
]);
const ANALYTICS_MAX_METADATA_BYTES = 2048;

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
  assistantImprovementReports: path.join(DATA_DIR, 'assistant-improvement-reports.json'),
  visitorAnalyticsEvents: path.join(DATA_DIR, 'visitor-analytics-events.json'),
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
  assistantImprovementReports: 'assistantImprovementReports',
  visitorAnalyticsEvents: 'visitorAnalyticsEvents',
};
const ADMIN_ONLY_KEYS = ['subAccounts', 'hostSubscriptions'];
const ASSISTANT_LOW_CONFIDENCE_THRESHOLD = 0.5;
const ASSISTANT_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const ASSISTANT_WEAK_FAQ_NEGATIVE_RATE = 0.25;
const ASSISTANT_REPORT_PROMPT_VERSION = 1;

async function connectMongo() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('inventory');
  await ensureAssistantQuestionIndexes(db);
  await ensureVisitorAnalyticsIndexes(db);
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

const CATALOG_SSR_TEXT = {
  ru: {
    meta: {
      title: 'Умные колонки с Алисой в Риге и Латвии | HeySmart',
      description: 'Умные колонки с Алисой в наличии в Риге. Самовывоз по предварительной договорённости, помощь с выбором и настройкой. Курьерская доставка по Латвии.',
    },
    nav: { lang: 'Язык', help: 'База знаний' },
  },
  en: {
    meta: {
      title: 'Smart speakers with Alice in Riga and Latvia | HeySmart',
      description: 'Smart speakers with Alice available in Riga. Pickup by prior arrangement, help with choosing and setup. Courier delivery across Latvia.',
    },
    nav: { brand: 'Smart speaker', consultation: 'Consultation', lang: 'Language' },
    common: { selectedModel: 'Selected model', aboutModel: 'About the model', contact: 'Contact' },
    contact: { kicker: 'Contact', title: 'How would you like to contact us?' },
    assistant: { fab: 'Alice will help you choose', kicker: 'Assistant', title: 'I can help you choose a Station.', intro: 'Choose a scenario and I’ll suggest a suitable model from the current selection.' },
    faq: { kicker: 'Questions', inputLabel: 'Your question', placeholder: 'Your question...', send: 'Ask' },
    sections: {
      quickChoose: {
        kicker: 'Quick choice', title: 'Which smart speaker should you choose?',
        lite: { recommend: 'For a first speaker', lead: 'Best as a first smart speaker for a bedroom, children\'s room, or small desk where simple setup and compact size matter most.', point1: 'Easy way to start with Alice.', point2: 'Fits comfortably in small spaces.', point3: 'Good gift for everyday tasks.', final: 'Choose it for the simplest start.' },
        mini: { recommend: 'Best balance', lead: 'The safest choice for most buyers: a compact speaker with stronger sound for music, the kitchen, or a living room.', point1: 'Better sound for daily listening.', point2: 'Still compact and minimal.', point3: 'Works well in most rooms.', final: 'Choose it if you want one universal pick.' },
        pro: { recommend: 'For smart home', lead: 'Best when the speaker should become a smart-home hub and control compatible devices through Zigbee automation.', point1: 'Stronger smart-home role.', point2: 'Zigbee for compatible devices.', point3: 'More capable for future setup.', final: 'Choose it when automation matters.' },
        street: { recommend: 'For outdoors and trips', lead: 'A portable speaker for people who want to take Alice outside, on trips, to the balcony, or anywhere away from home.', point1: 'Portable format for movement.', point2: 'Useful away from the desk.', point3: 'Good for trips and relaxed use.', final: 'Choose it if the speaker should move with you.' },
      },
      localInfo: {
        kicker: 'Riga and Latvia', title: 'Buying in Riga', intro: 'We will help you choose a suitable smart speaker, explain availability, and answer questions before purchase.',
        pickup: { title: 'Pickup in Riga', text: 'The meeting and handover are arranged in advance at a convenient time. Current models and colors are best confirmed before arranging pickup.' },
        help: { title: 'Help choosing', text: 'We will suggest which model fits a room, music, a gift, or a basic smart home setup without overpromising or pressure.' },
        shipping: { title: 'Shipping across Europe', text: 'If needed, shipping across Europe by courier is possible. Cost and delivery time are calculated individually.' },
      },
    },
    colors: { blue: 'Blue', violet: 'Violet', green: 'Green', pink: 'Pink', coral: 'Coral', black: 'Black', gray: 'Gray', graphite: 'Graphite' },
    models: {
      light2: { title: 'Station Lite 2', line: 'A compact smart speaker with Alice, an LED display and voice control.' },
      mini3: { title: 'Station Mini 3', line: 'A compact Station with Alice, an LED display and a more balanced sound.' },
      miniPro: { title: 'Station Mini 3 Pro', line: 'A compact Station with stronger sound, Zigbee and smart home hub features.' },
      midi: { title: 'Station Midi', line: 'A Station for a larger room, movies, music and family scenarios.' },
      street: { title: 'Station Street', line: 'A portable Station with a battery, moisture protection and Bluetooth.' },
    },
  },
};

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
    { key: 'graphite', aliases: ['черн', 'чёрн', 'графит'], image: 'images/catalog/mini-pro/graphite/01.png', label: 'графит' },
  ] },
  { id: 'midi', aliases: ['миди', 'midi'], title: 'Станция Миди', line: 'Станция для большой комнаты, фильмов, музыки и семейных сценариев.', colors: [
    { key: 'black', aliases: ['черн', 'чёрн', 'графит', 'black', 'graphite'], image: 'images/catalog/midi/black/01.png', label: 'чёрный' },
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

function catalogTranslation(locale, path) {
  return path.split('.').reduce((value, key) => value?.[key], CATALOG_SSR_TEXT[locale]) || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function localizedCatalogStructuredData(locale, canonicalUrl) {
  const isEnglish = locale === 'en';
  const copy = isEnglish
    ? {
      city: 'Riga', country: 'Latvia', catalog: 'Catalog',
      organization: 'HeySmart offers smart speakers with Alice in Riga and Latvia, with help choosing, pickup by arrangement and delivery.',
    }
    : {
      city: 'Рига', country: 'Латвия', catalog: 'Каталог',
      organization: 'HeySmart — Яндекс Станции с Алисой в Риге и Латвии: помощь с выбором, самовывоз по договорённости и доставка.',
    };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Organization', 'LocalBusiness'],
        '@id': `${canonicalUrl}#organization`,
        name: 'HeySmart',
        url: canonicalUrl,
        logo: 'https://heysmart.lv/icons/icon-512.png',
        description: copy.organization,
        areaServed: [
          { '@type': 'City', name: copy.city },
          { '@type': 'Country', name: copy.country },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${canonicalUrl}#website`,
        name: 'HeySmart',
        url: canonicalUrl,
        inLanguage: locale,
        publisher: { '@id': `${canonicalUrl}#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: catalogTranslation(locale, 'meta.title'),
        description: catalogTranslation(locale, 'meta.description'),
        inLanguage: locale,
        isPartOf: { '@id': `${canonicalUrl}#website` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [{
          '@type': 'ListItem',
          position: 1,
          name: copy.catalog,
          item: canonicalUrl,
        }],
      },
    ],
  };
}

function catalogPageOptions(req) {
  const forcedLocale = req.path === '/ru' ? 'ru' : req.path === '/en' ? 'en' : '';
  const locale = forcedLocale || 'ru';
  const canonicalUrl = forcedLocale ? `https://heysmart.lv/${forcedLocale}` : 'https://heysmart.lv/';
  const hreflang = forcedLocale
    ? [
      '<link rel="alternate" hreflang="ru" href="https://heysmart.lv/ru">',
      '<link rel="alternate" hreflang="en" href="https://heysmart.lv/en">',
      '<link rel="alternate" hreflang="x-default" href="https://heysmart.lv/">',
    ].join('\n  ')
    : '';
  return {
    canonicalUrl,
    forcedLocale,
    locale,
    hreflang,
    structuredData: forcedLocale ? localizedCatalogStructuredData(locale, canonicalUrl) : null,
  };
}

function catalogLanguageSwitcher(locale) {
  if (!locale) {
    return '<button class="lang-btn active" type="button" data-lang="ru" aria-pressed="true">RU</button>\n            <button class="lang-btn" type="button" data-lang="lv" aria-pressed="false">LV</button>\n            <button class="lang-btn" type="button" data-lang="en" aria-pressed="false">EN</button>';
  }
  return ['ru', 'en'].map(lang => lang === locale
    ? `<span class="lang-btn active" aria-current="true">${lang.toUpperCase()}</span>`
    : `<a class="lang-btn" href="/${lang}" hreflang="${lang}" lang="${lang}">${lang.toUpperCase()}</a>`
  ).join('');
}

function renderCatalogSsrLocale(template, page, initial) {
  const locale = page.locale;
  const text = path => catalogTranslation(locale, path);
  const initialTitle = initial ? text(`models.${initial.model.id}.title`) || initial.model.title : text('meta.title');
  const initialLine = initial ? text(`models.${initial.model.id}.line`) || initial.model.line : '';
  const initialColor = initial ? text(`colors.${initial.color.key}`) || initial.color.label : '';
  const heading = locale === 'en' ? 'Smart speakers with Alice in Riga and Latvia' : 'Яндекс Станции с Алисой в Латвии';
  const helpLink = locale === 'ru'
    ? `<a class="help-link" id="help-link" href="/ru/help">${escapeHtml(text('nav.help'))}</a>`
    : '';
  return template
    .replace('<html lang="ru">', `<html lang="${locale}">`)
    .replace(/__CATALOG_TITLE__/g, escapeHtml(text('meta.title')))
    .replace(/__CATALOG_DESCRIPTION__/g, escapeHtml(text('meta.description')))
    .replace(/__CATALOG_OG_LOCALE__/g, locale === 'en' ? 'en_LV' : 'ru_LV')
    .replace(/__CATALOG_H1__/g, escapeHtml(heading))
    .replace('__CATALOG_LANGUAGE_LABEL__', escapeHtml(text('nav.lang')))
    .replace('__CATALOG_LANGUAGE_SWITCHER__', catalogLanguageSwitcher(page.forcedLocale))
    .replace('__CATALOG_HELP_LINK__', helpLink)
    .replace(/__CATALOG_INITIAL_TITLE__/g, escapeHtml(initialTitle))
    .replace(/__CATALOG_INITIAL_LINE__/g, escapeHtml(initialLine))
    .replace(/__CATALOG_INITIAL_PRICE__/g, initial?.price ? `${initial.price.toLocaleString(locale === 'en' ? 'en-US' : 'ru')} €` : '')
    .replace(/__CATALOG_INITIAL_ALT__/g, escapeHtml(initial ? `${initialTitle}, ${initialColor}` : heading))
    .replace(/<([a-z][\w-]*)([^>]*\bdata-i18n="([^"]+)"[^>]*)>[^<]*<\/\1>/gi, (_, tag, attributes, path) => {
      const value = text(path);
      return value ? `<${tag}${attributes}>${escapeHtml(value)}</${tag}>` : _;
    })
    .replace(/(<[^>]*\bdata-i18n-placeholder="([^"]+)"[^>]*\bplaceholder=")[^"]*(")/gi, (_, start, path, end) => {
      const value = text(path);
      return value ? `${start}${escapeHtml(value)}${end}` : _;
    });
}

async function sendCatalogPage(req, res, next) {
  const page = catalogPageOptions(req);
  let data;
  try {
    data = await catalogInitialData(req.query);
  } catch (err) {
    console.error('Catalog page inventory error:', err.message);
    const fallbackProduct = { id: 'fallback-light2-blue', productType: 'Light 2', color: 'голубой', label: 'Light 2 / голубой', sellPrice: 90, inStock: true };
    data = {
      products: [fallbackProduct],
      initial: requestedCatalogProduct([fallbackProduct], req.query) || firstCatalogProduct([fallbackProduct]),
    };
  }

  try {
    const initial = data.initial;
    let template = renderCatalogSsrLocale(readTextFile('catalog.html'), page, initial);
    if (page.structuredData) {
      template = template.replace(
        /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<script type="application/ld+json">${escapeJsonForHtml(page.structuredData)}</script>`
      );
    }
    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    res.set('Surrogate-Control', 'no-store');
    res.type('html').send(template
      .replace(/__CATALOG_CANONICAL_URL__/g, page.canonicalUrl)
      .replace('__CATALOG_HREFLANG__', page.hreflang)
      .replace('__CATALOG_PAGE_LOCALE__', JSON.stringify(page.forcedLocale))
      .replace(/__CATALOG_PRELOAD_HREF__/g, initial?.color?.image || '')
      .replace(/__CATALOG_INITIAL_IMAGE__/g, initial?.color?.image || '')
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

app.get('/ru', (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    return sendCatalogPage(req, res, next);
  }
  return next();
});

app.get('/en', (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
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

app.get('/sitemap.xml', (req, res, next) => {
  if (isCatalogHost(req) || isLocalHost(req)) {
    res.type('application/xml').send(knowledgeBase.renderSitemapXml('https://heysmart.lv'));
    return;
  }
  return next();
});

app.get('/:locale/help', (req, res, next) => {
  if (!(isCatalogHost(req) || isLocalHost(req))) return next();
  const { locale } = req.params;
  if (!knowledgeBase.isSupportedLocale(locale)) return next();
  res.type('html').send(knowledgeBase.renderHelpIndex(req, locale));
});

app.get('/:locale/help/category/:categorySlug', (req, res, next) => {
  if (!(isCatalogHost(req) || isLocalHost(req))) return next();
  const { locale, categorySlug } = req.params;
  if (!knowledgeBase.isSupportedLocale(locale)) return next();
  const category = knowledgeBase.categoryBySlug(locale, categorySlug);
  if (!category) return res.status(404).send('Not found');
  res.type('html').send(knowledgeBase.renderCategoryPage(req, locale, category));
});

app.get('/:locale/help/:articleSlug', (req, res, next) => {
  if (!(isCatalogHost(req) || isLocalHost(req))) return next();
  const { locale, articleSlug } = req.params;
  if (!knowledgeBase.isSupportedLocale(locale)) return next();
  const redirectPath = knowledgeBase.findPreviousSlugRedirect(locale, articleSlug);
  if (redirectPath) return res.redirect(301, redirectPath);
  const article = knowledgeBase.findArticle(locale, articleSlug);
  if (!article) return res.status(404).send('Not found');
  res.type('html').send(knowledgeBase.renderArticlePage(req, article));
});

app.get(['/catalog.css', '/catalog.js', '/assistant-engine.js', '/i18n.js', '/faq.json', '/site.webmanifest', '/robots.txt', '/404.html', '/favicon.ico'], (req, res, next) => {
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
    || req.path === '/api/public/analytics/event'
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

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing HeySmart Mail IMAP connection`);
  await mail.shutdownMailPoller();
  process.exit(0);
}

process.once('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)); });
process.once('SIGINT', () => { shutdown('SIGINT').catch(() => process.exit(1)); });

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
  const reportColl = database.collection(COLL.assistantImprovementReports);
  await Promise.all([
    reportColl.createIndex({ generatedAt: -1 }),
    reportColl.createIndex({ dateFrom: 1, dateTo: 1, locale: 1 }),
    reportColl.createIndex({ status: 1 }),
  ]);
}

async function ensureVisitorAnalyticsIndexes(database) {
  if (!database) return;
  const coll = database.collection(COLL.visitorAnalyticsEvents);
  await Promise.all([
    coll.createIndex({ visitorId: 1 }),
    coll.createIndex({ sessionId: 1 }),
    coll.createIndex({ timestamp: -1 }),
    coll.createIndex({ eventType: 1 }),
    coll.createIndex({ ip: 1 }),
  ]);
}

function readVisitorAnalyticsFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILES.visitorAnalyticsEvents, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVisitorAnalyticsFile(records) {
  fs.writeFileSync(FILES.visitorAnalyticsEvents, JSON.stringify(records, null, 2), 'utf8');
}

function sanitizeAnalyticsString(value, limit = 160) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function sanitizeAnalyticsId(value) {
  return sanitizeAnalyticsString(value, 120).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}

function sanitizeAnalyticsMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  const sensitiveKeyPattern = /(auth|authorization|cookie|email|mail|form|message|password|phone|question|tel|text|token)/i;
  for (const [key, raw] of Object.entries(value).slice(0, 24)) {
    const cleanKey = sanitizeAnalyticsString(key, 60).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanKey) continue;
    if (sensitiveKeyPattern.test(cleanKey)) continue;
    if (typeof raw === 'boolean') result[cleanKey] = raw;
    else if (typeof raw === 'number' && Number.isFinite(raw)) result[cleanKey] = raw;
    else result[cleanKey] = sanitizeAnalyticsString(raw, 240);
  }
  return Buffer.byteLength(JSON.stringify(result), 'utf8') <= ANALYTICS_MAX_METADATA_BYTES ? result : {};
}

function normalizeIp(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw.replace(/^\[|\]$/g, '');
}

function isValidIpv4(ip) {
  const parts = String(ip || '').split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    if (value < 0 || value > 255) return false;
  }
  return true;
}

function isValidIpv6(ip) {
  const clean = normalizeIp(ip).toLowerCase();
  if (!clean || clean.includes(':::')) return false;
  const zoneFree = clean.split('%')[0];
  const [leftRaw, rightRaw, extra] = zoneFree.split('::');
  if (extra !== undefined) return false;
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const expandIpv4 = parts => {
    const last = parts[parts.length - 1];
    if (!last || !last.includes('.')) return parts;
    if (!isValidIpv4(last)) return null;
    const octets = last.split('.').map(Number);
    return [...parts.slice(0, -1), ((octets[0] << 8) + octets[1]).toString(16), ((octets[2] << 8) + octets[3]).toString(16)];
  };
  const expandedLeft = expandIpv4(left);
  const expandedRight = expandIpv4(right);
  if (!expandedLeft || !expandedRight) return false;
  const missing = zoneFree.includes('::') ? 8 - expandedLeft.length - expandedRight.length : 0;
  if (missing < 0) return false;
  const groups = zoneFree.includes('::') ? [...expandedLeft, ...Array(missing).fill('0'), ...expandedRight] : expandedLeft;
  return groups.length === 8 && groups.every(group => /^[0-9a-f]{1,4}$/i.test(group));
}

function headerIpList(value) {
  return String(value || '').split(',').map(part => validAnalyticsIp(part)).filter(Boolean);
}

function validAnalyticsIp(value) {
  const normalized = normalizeIp(value);
  if (!normalized) return '';
  if (normalized.includes(':')) return isValidIpv6(normalized) ? normalized : '';
  return isValidIpv4(normalized) ? normalized : '';
}

function analyticsClientIp(req) {
  const hasIpHeaders = Boolean(req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for']);
  const cloudflareIp = validAnalyticsIp(req.headers['cf-connecting-ip']);
  if (cloudflareIp && req.headers['cf-ray']) return cloudflareIp;
  const realIp = validAnalyticsIp(req.headers['x-real-ip']);
  if (realIp) return realIp;
  const forwardedFor = headerIpList(req.headers['x-forwarded-for']).find(Boolean);
  if (forwardedFor) return forwardedFor;
  if (hasIpHeaders) return 'unknown';
  return validAnalyticsIp(req.ip) || validAnalyticsIp(req.socket?.remoteAddress) || 'unknown';
}

function analyticsDevice(userAgent) {
  const ua = sanitizeAnalyticsString(userAgent, 240);
  const lower = ua.toLowerCase();
  const bot = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|lighthouse|headless)/i.test(ua);
  const device = bot ? 'bot' : /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  let browser = '';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('safari/')) browser = 'Safari';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  return { userAgent: ua, device, browser, bot };
}

const analyticsRateBuckets = new Map();
const visitorGeoCache = new Map();
let maxMindReadersPromise = null;
let visitorGeoUnavailableLogged = false;
let visitorGeoErrorLogged = false;

function ipVersion(ip) {
  if (isValidIpv4(ip)) return 'IPv4';
  if (isValidIpv6(ip)) return 'IPv6';
  return '';
}

function ipv4Number(ip) {
  if (!isValidIpv4(ip)) return null;
  return ip.split('.').reduce((sum, part) => (sum * 256) + Number(part), 0);
}

function isPrivateAnalyticsIp(ip) {
  const clean = normalizeIp(ip).toLowerCase();
  if (!clean || clean === 'unknown') return true;
  const v4 = ipv4Number(clean);
  if (v4 !== null) {
    const first = Number(clean.split('.')[0]);
    const second = Number(clean.split('.')[1]);
    return first === 10
      || first === 127
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 169 && second === 254)
      || (first === 100 && second >= 64 && second <= 127)
      || v4 === 0
      || v4 >= ipv4Number('224.0.0.0');
  }
  return clean === '::1'
    || clean === '::'
    || clean.startsWith('fc')
    || clean.startsWith('fd')
    || clean.startsWith('fe80:')
    || clean.startsWith('ff')
    || clean.startsWith('2001:db8:');
}

function unknownGeo(ip) {
  return { country: 'Unknown', countryCode: '', city: '', isp: '', asn: '', ipType: ipVersion(ip), source: 'fallback' };
}

function sanitizeGeoRecord(raw, ip) {
  if (!raw || typeof raw !== 'object') return unknownGeo(ip);
  const asn = raw.asn ? sanitizeAnalyticsString(raw.asn, 80) : '';
  const countryName = typeof raw.country === 'string' ? raw.country : raw.country?.names?.en;
  const cityName = typeof raw.city === 'string' ? raw.city : raw.city?.names?.en;
  const isp = sanitizeAnalyticsString(raw.isp || raw.organization || raw.org || raw.autonomous_system_organization || asn, 120);
  return {
    country: sanitizeAnalyticsString(countryName || raw.countryName || raw.registered_country?.names?.en || 'Unknown', 80) || 'Unknown',
    countryCode: sanitizeAnalyticsString(raw.countryCode || raw.isoCode || raw.country?.iso_code || raw.registered_country?.iso_code || '', 2).toUpperCase(),
    city: sanitizeAnalyticsString(cityName || '', 80),
    isp,
    asn: sanitizeAnalyticsString(asn || raw.autonomous_system_number || '', 80),
    ipType: ipVersion(ip),
    source: raw.source === 'fallback' || raw.country === 'Unknown' ? 'fallback' : 'maxmind',
  };
}

function isResolvedGeo(geo, ip) {
  if (!geo || typeof geo !== 'object') return false;
  const clean = validAnalyticsIp(ip);
  if (!clean || isPrivateAnalyticsIp(clean)) return true;
  return geo.source !== 'fallback' && geo.country && geo.country !== 'Unknown';
}

function lookupMockGeo(ip) {
  if (!process.env.ANALYTICS_GEO_MOCK_FILE) return null;
  try {
    const records = JSON.parse(fs.readFileSync(process.env.ANALYTICS_GEO_MOCK_FILE, 'utf8'));
    if (!records || typeof records !== 'object') return null;
    return Object.prototype.hasOwnProperty.call(records, ip) ? sanitizeGeoRecord(records[ip], ip) : unknownGeo(ip);
  } catch {
    return unknownGeo(ip);
  }
}

function logVisitorGeoUnavailable(message) {
  if (visitorGeoUnavailableLogged) return;
  visitorGeoUnavailableLogged = true;
  console.warn(`Visitor geo unavailable: ${message}`);
}

async function lookupMaxMindGeo(ip) {
  const cityDbPath = process.env.GEOLITE2_CITY_DB || path.join(DATA_DIR, 'GeoLite2-City.mmdb');
  const asnDbPath = process.env.GEOLITE2_ASN_DB || path.join(DATA_DIR, 'GeoLite2-ASN.mmdb');
  if (!fs.existsSync(cityDbPath) && !fs.existsSync(asnDbPath)) {
    logVisitorGeoUnavailable('GeoLite2 database files are missing; showing Unknown locations.');
    return null;
  }
  try {
    const maxmind = require('maxmind');
    if (!maxMindReadersPromise) {
      maxMindReadersPromise = Promise.all([
        fs.existsSync(cityDbPath) ? maxmind.open(cityDbPath) : null,
        fs.existsSync(asnDbPath) ? maxmind.open(asnDbPath) : null,
      ]);
    }
    const [cityReader, asnReader] = await maxMindReadersPromise;
    const city = cityReader ? cityReader.get(ip) : {};
    const asn = asnReader ? asnReader.get(ip) : {};
    return sanitizeGeoRecord({ ...city, ...asn }, ip);
  } catch (err) {
    if (!visitorGeoErrorLogged) {
      visitorGeoErrorLogged = true;
      console.warn(`Visitor geo lookup failed: ${err.message}`);
    }
    return unknownGeo(ip);
  }
}

async function resolveVisitorGeo(ip) {
  const clean = validAnalyticsIp(ip);
  if (!clean || isPrivateAnalyticsIp(clean)) return unknownGeo(clean);
  if (visitorGeoCache.has(clean)) return visitorGeoCache.get(clean);
  let geo = lookupMockGeo(clean);
  if (!geo) geo = await lookupMaxMindGeo(clean);
  if (!geo) geo = unknownGeo(clean);
  if (isResolvedGeo(geo, clean)) visitorGeoCache.set(clean, geo);
  return geo;
}

async function geoForAnalyticsEvent(event) {
  const ip = normalizeIp(event?.ip);
  const storedGeo = sanitizeGeoRecord(event?.geo, ip);
  if (isResolvedGeo(storedGeo, ip)) {
    return storedGeo;
  }
  return resolveVisitorGeo(ip);
}

function analyticsRateAllowed(req, limit = 90) {
  const key = analyticsClientIp(req) || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const bucket = analyticsRateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  analyticsRateBuckets.set(key, bucket);
  return bucket.count <= limit;
}

async function cleanupVisitorAnalytics(now = new Date()) {
  const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  if (USE_MONGO) {
    await db.collection(COLL.visitorAnalyticsEvents).deleteMany({ timestamp: { $lt: cutoff } });
    return;
  }
  writeVisitorAnalyticsFile(readVisitorAnalyticsFile().filter(event => String(event.timestamp || '') >= cutoff));
}

async function saveVisitorAnalyticsEvent(req, body) {
  if (!analyticsRateAllowed(req)) return { status: 429, body: { ok: false } };
  const visitorId = sanitizeAnalyticsId(body?.visitorId);
  const sessionId = sanitizeAnalyticsId(body?.sessionId);
  const eventType = sanitizeAnalyticsString(body?.eventType, 80);
  if (!visitorId || !sessionId || !ANALYTICS_EVENT_TYPES.has(eventType)) return { status: 400, body: { ok: false } };
  const timestamp = new Date().toISOString();
  const device = analyticsDevice(req.headers['user-agent'] || '');
  const event = {
    id: crypto.randomUUID(),
    visitorId,
    sessionId,
    eventType,
    timestamp,
    page: sanitizeAssistantUrl(body?.page || req.headers.referer || ''),
    locale: ['ru', 'lv', 'en'].includes(body?.locale) ? body.locale : '',
    modelId: sanitizeAnalyticsString(body?.modelId, 80),
    color: sanitizeAnalyticsString(body?.color, 80),
    metadata: sanitizeAnalyticsMetadata(body?.metadata),
    ip: analyticsClientIp(req),
    userAgent: device.userAgent,
    device: device.device,
    browser: device.browser,
    bot: device.bot,
  };
  event.geo = await resolveVisitorGeo(event.ip);
  await cleanupVisitorAnalytics();
  if (USE_MONGO) await db.collection(COLL.visitorAnalyticsEvents).insertOne(event);
  else {
    const events = readVisitorAnalyticsFile();
    events.push(event);
    writeVisitorAnalyticsFile(events);
  }
  return { status: 204, body: null };
}

function analyticsDateRange(query = {}) {
  const now = new Date();
  const to = query.dateTo ? new Date(`${String(query.dateTo).slice(0, 10)}T23:59:59.999Z`) : now;
  const from = query.dateFrom ? new Date(`${String(query.dateFrom).slice(0, 10)}T00:00:00.000Z`) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const safeTo = Number.isFinite(to.getTime()) ? to : now;
  const safeFrom = Number.isFinite(from.getTime()) && from <= safeTo ? from : new Date(safeTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: safeFrom.toISOString(), to: safeTo.toISOString() };
}

async function loadVisitorAnalyticsEvents(query = {}) {
  const range = analyticsDateRange(query);
  const includeBots = query.includeBots === 'true';
  const visitorId = sanitizeAnalyticsId(query.visitorId);
  if (USE_MONGO) {
    const filter = { timestamp: { $gte: range.from, $lte: range.to } };
    if (visitorId) filter.visitorId = visitorId;
    if (!includeBots) filter.bot = { $ne: true };
    return db.collection(COLL.visitorAnalyticsEvents).find(filter, { projection: { userAgent: 0 } }).sort({ timestamp: -1 }).limit(20000).toArray();
  }
  return readVisitorAnalyticsFile().filter(event => (
    String(event.timestamp || '') >= range.from
    && String(event.timestamp || '') <= range.to
    && (!visitorId || event.visitorId === visitorId)
    && (includeBots || !event.bot)
  ));
}

function visitorSummaryFromEvents(events) {
  const visitors = new Map();
  const sessions = new Set();
  let pageViews = 0;
  let contactClicks = 0;
  let assistantUsers = 0;
  const assistantVisitorIds = new Set();
  for (const event of events) {
    sessions.add(event.sessionId);
    if (event.eventType === 'page_view') pageViews += 1;
    if (['contact_click', 'whatsapp_click', 'telegram_click'].includes(event.eventType)) contactClicks += 1;
    if (event.eventType === 'assistant_question') assistantVisitorIds.add(event.visitorId);
    const row = visitors.get(event.visitorId) || { sessions: new Set(), days: new Set() };
    row.sessions.add(event.sessionId);
    row.days.add(String(event.timestamp || '').slice(0, 10));
    visitors.set(event.visitorId, row);
  }
  assistantUsers = assistantVisitorIds.size;
  const returningVisitors = [...visitors.values()].filter(row => row.sessions.size > 1 || row.days.size > 1).length;
  return { uniqueVisitors: visitors.size, sessions: sessions.size, pageViews, returningVisitors, assistantUsers, contactClicks };
}

async function aggregateVisitorRows(events, query = {}) {
  const search = sanitizeAnalyticsString(query.search, 120).toLowerCase();
  const map = new Map();
  for (const event of events) {
    const row = map.get(event.visitorId) || {
      visitorId: event.visitorId,
      latestIp: '',
      ips: new Set(),
      sessions: new Set(),
      days: new Set(),
      eventCount: 0,
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
      locale: event.locale || '',
      device: event.device || '',
      assistantQuestionCount: 0,
      contactClickCount: 0,
      modelsViewed: new Set(),
      geo: unknownGeo(event.ip),
    };
    row.eventCount += 1;
    row.sessions.add(event.sessionId);
    row.days.add(String(event.timestamp || '').slice(0, 10));
    if (event.ip) row.ips.add(event.ip);
    if (String(event.timestamp || '') < String(row.firstSeen || '')) row.firstSeen = event.timestamp;
    if (String(event.timestamp || '') >= String(row.lastSeen || '')) {
      row.lastSeen = event.timestamp;
      row.latestIp = event.ip || row.latestIp;
      row.locale = event.locale || row.locale;
      row.device = event.device || row.device;
      row.geo = await geoForAnalyticsEvent(event);
    }
    if (event.eventType === 'assistant_question') row.assistantQuestionCount += 1;
    if (['contact_click', 'whatsapp_click', 'telegram_click'].includes(event.eventType)) row.contactClickCount += 1;
    if (event.modelId) row.modelsViewed.add(event.modelId);
    map.set(event.visitorId, row);
  }
  let rows = [...map.values()].map(row => ({
    ...row,
    ips: [...row.ips].sort(),
    geo: sanitizeGeoRecord(row.geo, row.latestIp),
    visitCount: row.days.size,
    sessionCount: row.sessions.size,
    modelsViewed: [...row.modelsViewed].sort(),
  }));
  rows = rows.filter(row => !search
    || row.visitorId.toLowerCase().includes(search)
    || row.ips.some(ip => ip.toLowerCase().includes(search))
    || String(row.geo.country || '').toLowerCase().includes(search)
    || String(row.geo.city || '').toLowerCase().includes(search)
    || String(row.geo.isp || '').toLowerCase().includes(search));
  const sort = ['firstSeen', 'eventCount', 'visitCount'].includes(query.sort) ? query.sort : 'lastSeen';
  rows.sort((a, b) => sort === 'firstSeen' ? String(a.firstSeen).localeCompare(String(b.firstSeen)) : sort === 'eventCount' ? b.eventCount - a.eventCount : sort === 'visitCount' ? b.visitCount - a.visitCount : String(b.lastSeen).localeCompare(String(a.lastSeen)));
  return rows;
}

async function visitorAnalyticsList(query = {}) {
  const events = await loadVisitorAnalyticsEvents(query);
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 25));
  const rows = await aggregateVisitorRows(events, query);
  const start = (page - 1) * limit;
  return { summary: visitorSummaryFromEvents(events), items: rows.slice(start, start + limit), total: rows.length, page, limit, meta: { retentionDays: ANALYTICS_RETENTION_DAYS, includeBots: query.includeBots === 'true' } };
}

function humanAnalyticsEvent(event) {
  const model = event.modelId ? ` ${event.modelId}` : '';
  const color = event.color ? ` ${event.color}` : '';
  const map = {
    page_view: 'Page opened',
    model_view: `Viewed${model}`.trim(),
    color_change: `Selected${color}`.trim(),
    assistant_open: 'Opened assistant',
    assistant_question: 'Asked assistant',
    assistant_recommendation: `Assistant recommended${model}`.trim(),
    contact_click: 'Clicked contact',
    whatsapp_click: 'Clicked WhatsApp',
    telegram_click: 'Clicked Telegram',
    language_change: `Changed language ${event.locale || ''}`.trim(),
    details_open: 'Opened details',
  };
  return map[event.eventType] || event.eventType;
}

async function visitorAnalyticsDetail(visitorId, query = {}) {
  const cleanVisitorId = sanitizeAnalyticsId(visitorId);
  if (!cleanVisitorId) return { status: 400, body: { error: 'Invalid visitorId' } };
  if (cleanVisitorId !== String(visitorId || '')) return { status: 400, body: { error: 'Invalid visitorId' } };
  const events = (await loadVisitorAnalyticsEvents({ ...query, visitorId: cleanVisitorId, includeBots: query.includeBots }))
    .filter(event => event && event.visitorId === cleanVisitorId)
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  if (!events.length) return { status: 404, body: { error: 'Visitor not found' } };
  const limit = Math.max(1, Math.min(500, Number(query.limit) || 200));
  const limited = events.slice(Math.max(0, events.length - limit));
  const sessions = new Map();
  for (const event of limited) {
    const sessionId = sanitizeAnalyticsId(event.sessionId) || 'unknown-session';
    if (!sessions.has(sessionId)) sessions.set(sessionId, []);
    sessions.get(sessionId).push({
      timestamp: String(event.timestamp || ''),
      eventType: sanitizeAnalyticsString(event.eventType, 80),
      label: humanAnalyticsEvent(event),
      page: sanitizeAssistantUrl(event.page || ''),
      locale: ['ru', 'lv', 'en'].includes(event.locale) ? event.locale : '',
      modelId: sanitizeAnalyticsString(event.modelId, 80),
      color: sanitizeAnalyticsString(event.color, 80),
    });
  }
  return {
    status: 200,
    body: {
      visitorId: cleanVisitorId,
      ips: [...new Set(events.map(e => normalizeIp(e.ip)).filter(Boolean))].sort(),
      geo: await geoForAnalyticsEvent(events[events.length - 1]),
      firstSeen: String(events[0]?.timestamp || ''),
      lastSeen: String(events[events.length - 1]?.timestamp || ''),
      sessionCount: new Set(events.map(e => sanitizeAnalyticsId(e.sessionId) || 'unknown-session')).size,
      eventCount: events.length,
      sessions: [...sessions.entries()].map(([sessionId, items]) => ({ sessionId, events: items })),
    },
  };
}

async function deleteVisitorAnalytics(visitorIds = []) {
  const ids = [...new Set((Array.isArray(visitorIds) ? visitorIds : [visitorIds])
    .map(id => sanitizeAnalyticsId(id))
    .filter(Boolean))];
  if (!ids.length) return { status: 400, body: { error: 'No visitorIds provided' } };
  if (USE_MONGO) {
    const result = await db.collection(COLL.visitorAnalyticsEvents).deleteMany({ visitorId: { $in: ids } });
    return { status: 200, body: { ok: true, deleted: result.deletedCount || 0, visitorIds: ids } };
  }
  const events = readVisitorAnalyticsFile();
  const remaining = events.filter(event => !ids.includes(event.visitorId));
  writeVisitorAnalyticsFile(remaining);
  return { status: 200, body: { ok: true, deleted: events.length - remaining.length, visitorIds: ids } };
}

function isMongoId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || ''));
}

function assistantRecordId(record) {
  return String(record._id || record.id || '');
}

function assistantMatchedFaqId(record) {
  return sanitizeAssistantText(record.matchedFaqId, 80) || null;
}

function assistantMatched(record) {
  return record.matched === true || Boolean(assistantMatchedFaqId(record));
}

function assistantConfidence(record) {
  if (record.hasConfidence === false) return null;
  const value = Number(record.confidence);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

function toPublicAssistantRecord(record) {
  const normalizedQuestion = record.normalizedQuestion || normalizeQuestionText(record.question);
  const matchedFaqId = assistantMatchedFaqId(record);
  const confidence = assistantConfidence(record);
  const answer = record.assistantAnswer || record.answer || '';
  const item = {
    id: assistantRecordId(record),
    messageId: sanitizeAssistantText(record.messageId, 100) || assistantRecordId(record),
    timestamp: record.timestamp || record.createdAt || '',
    role: ['user', 'assistant'].includes(record.role) ? record.role : 'assistant',
    question: record.question || '',
    answer,
    assistantAnswer: answer,
    locale: record.locale || 'ru',
    matched: assistantMatched(record),
    matchedFaqId,
    confidence: confidence == null ? 0 : confidence,
    hasConfidence: confidence != null,
    responseType: record.responseType || record.intent || '',
    intent: record.intent || record.responseType || '',
    modelId: record.modelId || '',
    colorKey: record.colorKey || '',
    pageUrl: record.pageUrl || '',
    sessionId: record.sessionId || '',
    feedback: record.feedback || '',
    reviewed: Boolean(record.reviewed),
    adminNote: record.adminNote || '',
    sessionContext: record.sessionContext && typeof record.sessionContext === 'object' ? record.sessionContext : null,
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
  if (item.hasConfidence && item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD) reasons.push('Low confidence');
  return reasons;
}

function isAssistantImprovementCandidate(record, reviewedMode = false) {
  const item = toPublicAssistantRecord(record);
  if (!item.normalizedQuestion) return false;
  if (['conversation_end', 'noise_or_test'].includes(item.intent)) return false;
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
    if (item.hasConfidence && item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD) summary.lowConfidence++;
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
    if (item.hasConfidence && item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD) summary.improvement.lowConfidence++;
  });
  return summary;
}

function readJsonArrayFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArrayFile(file, records, limit = 1000) {
  fs.writeFileSync(file, JSON.stringify(records.slice(-limit), null, 2), 'utf8');
}

function assistantReportRange(query = {}) {
  const now = new Date();
  const to = query.dateTo ? new Date(`${String(query.dateTo).slice(0, 10)}T23:59:59.999Z`) : now;
  const from = query.dateFrom ? new Date(`${String(query.dateFrom).slice(0, 10)}T00:00:00.000Z`) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const safeTo = Number.isFinite(to.getTime()) ? to : now;
  const safeFrom = Number.isFinite(from.getTime()) && from <= safeTo ? from : new Date(safeTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { dateFrom: safeFrom.toISOString(), dateTo: safeTo.toISOString() };
}

function assistantReportLocale(query = {}) {
  return ['ru', 'en', 'lv'].includes(query.locale) ? query.locale : '';
}

function assistantRecordInRange(record, dateFrom, dateTo, locale = '') {
  const item = toPublicAssistantRecord(record);
  const createdAt = new Date(item.createdAt || 0).getTime();
  return createdAt >= new Date(dateFrom).getTime()
    && createdAt <= new Date(dateTo).getTime()
    && (!locale || item.locale === locale);
}

async function allAssistantRecords() {
  if (USE_MONGO) {
    return db.collection(COLL.assistantQuestions).find({}, { projection: { userAgent: 0 } }).limit(10000).toArray();
  }
  return readAssistantQuestionsFile();
}

function redactPii(value, limit = 220) {
  return sanitizeAssistantText(value, limit)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\s().-]*){7,}/g, '[phone]')
    .slice(0, limit);
}

function sanitizeAiText(value, limit = 1000) {
  return redactPii(value, limit);
}

function average(values) {
  const nums = values.filter(value => Number.isFinite(value));
  return nums.length ? Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(3)) : null;
}

function groupRepeatedQuestions(records) {
  const groups = new Map();
  records.map(toPublicAssistantRecord).forEach(item => {
    if (!item.normalizedQuestion) return;
    const group = groups.get(item.normalizedQuestion) || {
      normalizedQuestion: item.normalizedQuestion,
      count: 0,
      exampleQuestions: [],
      locales: new Set(),
      confidences: [],
      matchedFaqIds: new Set(),
      negativeFeedbackCount: 0,
      latestCreatedAt: '',
      unmatchedCount: 0,
      intents: new Map(),
    };
    group.count++;
    if (group.exampleQuestions.length < 5) group.exampleQuestions.push(redactPii(item.question, 180));
    if (item.locale) group.locales.add(item.locale);
    if (item.hasConfidence) group.confidences.push(item.confidence);
    if (item.matchedFaqId) group.matchedFaqIds.add(item.matchedFaqId);
    if (item.feedback === 'not_helpful') group.negativeFeedbackCount++;
    if (!item.matched) group.unmatchedCount++;
    if (!group.latestCreatedAt || String(item.createdAt) > group.latestCreatedAt) group.latestCreatedAt = item.createdAt;
    if (item.intent) group.intents.set(item.intent, (group.intents.get(item.intent) || 0) + 1);
    groups.set(item.normalizedQuestion, group);
  });
  return [...groups.values()].map(group => ({
    normalizedQuestion: group.normalizedQuestion,
    count: group.count,
    exampleQuestions: group.exampleQuestions,
    locales: [...group.locales],
    averageConfidence: average(group.confidences),
    matchedFaqIds: [...group.matchedFaqIds],
    negativeFeedbackCount: group.negativeFeedbackCount,
    unmatchedCount: group.unmatchedCount,
    intent: [...group.intents.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '',
    latestCreatedAt: group.latestCreatedAt,
  })).sort((a, b) => b.count - a.count || String(b.latestCreatedAt).localeCompare(String(a.latestCreatedAt)));
}

function buildMatchedFaqStats(records, repeatedQuestions) {
  const stats = new Map();
  records.map(toPublicAssistantRecord).forEach(item => {
    if (!item.matchedFaqId) return;
    const stat = stats.get(item.matchedFaqId) || { faqId: item.matchedFaqId, usageCount: 0, confidences: [], positiveFeedbackCount: 0, negativeFeedbackCount: 0, exampleQuestions: [] };
    stat.usageCount++;
    if (item.hasConfidence) stat.confidences.push(item.confidence);
    if (item.feedback === 'helpful') stat.positiveFeedbackCount++;
    if (item.feedback === 'not_helpful') stat.negativeFeedbackCount++;
    if (stat.exampleQuestions.length < 5) stat.exampleQuestions.push(redactPii(item.question, 180));
    stats.set(item.matchedFaqId, stat);
  });
  return [...stats.values()].map(stat => {
    const averageConfidence = average(stat.confidences);
    const negativeRate = stat.usageCount ? stat.negativeFeedbackCount / stat.usageCount : 0;
    const sameTopicUnmatched = repeatedQuestions.filter(group => !group.matchedFaqIds.length && group.unmatchedCount > 0 && stat.exampleQuestions.some(q => normalizeQuestionText(q).split(' ').some(token => token.length > 4 && group.normalizedQuestion.includes(token)))).length;
    const weakReasons = [];
    if (averageConfidence != null && averageConfidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD) weakReasons.push('Low average confidence');
    if (negativeRate >= ASSISTANT_WEAK_FAQ_NEGATIVE_RATE) weakReasons.push('Significant negative feedback');
    if (sameTopicUnmatched > 0) weakReasons.push('Related unmatched follow-up questions');
    return {
      faqId: stat.faqId,
      usageCount: stat.usageCount,
      averageConfidence,
      positiveFeedbackCount: stat.positiveFeedbackCount,
      negativeFeedbackCount: stat.negativeFeedbackCount,
      negativeFeedbackRate: Number(negativeRate.toFixed(3)),
      unmatchedFollowUpCount: sameTopicUnmatched,
      exampleQuestions: stat.exampleQuestions,
      weak: weakReasons.length > 0,
      weakReasons,
    };
  }).sort((a, b) => b.usageCount - a.usageCount);
}

function buildMissingFaqCandidates(repeatedQuestions) {
  return repeatedQuestions
    .filter(group => !['conversation_end', 'noise_or_test'].includes(group.intent))
    .filter(group => !group.matchedFaqIds.length || group.unmatchedCount > 0 || group.negativeFeedbackCount > 0 || (group.averageConfidence != null && group.averageConfidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD))
    .map(group => {
      const recencyDays = Math.max(0, (Date.now() - new Date(group.latestCreatedAt || 0).getTime()) / (24 * 60 * 60 * 1000));
      const recencyScore = Math.max(0, 5 - Math.min(5, recencyDays));
      const priorityScore = Number((group.count * 2 + group.unmatchedCount * 3 + group.negativeFeedbackCount * 4 + recencyScore).toFixed(2));
      const reason = group.unmatchedCount ? 'Repeated unmatched question' : group.negativeFeedbackCount ? 'Negative feedback pattern' : 'Low confidence or repeated unclear topic';
      return {
        title: group.exampleQuestions[0] || group.normalizedQuestion,
        questionCount: group.count,
        exampleQuestions: group.exampleQuestions,
        languages: group.locales,
        reason,
        priorityScore,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 15);
}

function dailyCounts(records) {
  const counts = new Map();
  records.map(toPublicAssistantRecord).forEach(item => {
    const day = String(item.createdAt || '').slice(0, 10);
    if (day) counts.set(day, (counts.get(day) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
}

function comparePeriods(currentRecords, previousRecords) {
  const currentRepeated = groupRepeatedQuestions(currentRecords);
  const previousRepeated = groupRepeatedQuestions(previousRecords);
  const prevMap = new Map(previousRepeated.map(group => [group.normalizedQuestion, group.count]));
  const curMap = new Map(currentRepeated.map(group => [group.normalizedQuestion, group.count]));
  const change = (current, previous) => previous === 0 ? (current === 0 ? 0 : current) : Number(((current - previous) / previous).toFixed(3));
  const currentSummary = summarizeAssistantRecords(currentRecords);
  const previousSummary = summarizeAssistantRecords(previousRecords);
  const rising = currentRepeated.map(group => ({ normalizedQuestion: group.normalizedQuestion, currentCount: group.count, previousCount: prevMap.get(group.normalizedQuestion) || 0, change: group.count - (prevMap.get(group.normalizedQuestion) || 0) })).filter(item => item.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);
  const declining = previousRepeated.map(group => ({ normalizedQuestion: group.normalizedQuestion, currentCount: curMap.get(group.normalizedQuestion) || 0, previousCount: group.count, change: (curMap.get(group.normalizedQuestion) || 0) - group.count })).filter(item => item.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);
  return {
    totalQuestionChange: change(currentSummary.total, previousSummary.total),
    unmatchedChange: change(currentSummary.unmatched, previousSummary.unmatched),
    negativeFeedbackChange: change(currentSummary.negativeFeedback, previousSummary.negativeFeedback),
    topRisingNormalizedQuestions: rising,
    topDecliningNormalizedQuestions: declining,
    newlyAppearingQuestionTopics: rising.filter(item => item.previousCount === 0).map(item => item.normalizedQuestion).slice(0, 5),
  };
}

function assistantConversationGroups(records) {
  const groups = new Map();
  records.map(toPublicAssistantRecord).forEach(item => {
    const key = item.sessionId || `legacy:${item.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return [...groups.entries()].map(([sessionId, items]) => ({
    sessionId,
    sessionRef: sessionId.startsWith('legacy:') ? '' : crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 16),
    messages: items.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id)),
  })).sort((a, b) => String(a.messages[0]?.createdAt || '').localeCompare(String(b.messages[0]?.createdAt || '')));
}

function assistantIntentDistribution(records) {
  const counts = new Map();
  records.map(toPublicAssistantRecord).forEach(item => {
    const key = item.intent || 'legacy_unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([intent, count]) => ({ intent, count }));
}

function assistantConversationFunnels(records) {
  const sessions = assistantConversationGroups(records);
  const summary = {
    startedSelection: 0,
    answeredFollowup: 0,
    recommendationShown: 0,
    contactClicked: 0,
    failedConversations: 0,
  };
  const failed = [];
  sessions.forEach(session => {
    const relevant = session.messages.filter(item => !['conversation_end', 'noise_or_test'].includes(item.intent));
    const intents = relevant.map(item => item.intent).filter(Boolean);
    if (intents.includes('product_selection')) summary.startedSelection++;
    if (intents.some(intent => ['music_use_case', 'budget_request', 'product_size', 'smart_home'].includes(intent))) summary.answeredFollowup++;
    if (relevant.some(item => ['recommendation', 'model', 'availability'].includes(item.responseType) || item.sessionContext?.recommendationShown)) summary.recommendationShown++;
    if (relevant.some(item => item.responseType === 'contact_clicked')) summary.contactClicked++;
    const consecutiveUnmatched = relevant.some((item, index, arr) => index > 0 && !item.matched && !arr[index - 1].matched);
    const repeatedLow = relevant.filter(item => item.hasConfidence && item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD).length >= 2;
    const handoff = intents.includes('human_handoff');
    if (consecutiveUnmatched || repeatedLow || handoff) {
      summary.failedConversations++;
      failed.push({
        sessionRef: session.sessionRef,
        reasons: [
          consecutiveUnmatched ? 'multiple_consecutive_unmatched' : '',
          repeatedLow ? 'repeated_low_confidence' : '',
          handoff ? 'human_handoff_requested' : '',
        ].filter(Boolean),
        intentSequence: intents,
      });
    }
  });
  return { summary, failed: failed.slice(0, 50) };
}

async function buildAssistantImprovementReportData(query = {}) {
  const { dateFrom, dateTo } = assistantReportRange(query);
  const locale = assistantReportLocale(query);
  const records = await allAssistantRecords();
  const current = records.filter(record => assistantRecordInRange(record, dateFrom, dateTo, locale));
  const duration = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
  const prevTo = new Date(new Date(dateFrom).getTime() - 1).toISOString();
  const prevFrom = new Date(new Date(dateFrom).getTime() - duration - 1).toISOString();
  const previous = records.filter(record => assistantRecordInRange(record, prevFrom, prevTo, locale));
  const publicCurrent = current.map(toPublicAssistantRecord);
  const repeatedQuestions = groupRepeatedQuestions(current);
  const matchedFaqStats = buildMatchedFaqStats(current, repeatedQuestions);
  const weakFaqStats = matchedFaqStats.filter(stat => stat.weak);
  const summary = summarizeAssistantRecords(current);
  const funnels = assistantConversationFunnels(current);
  const confidenceValues = publicCurrent.filter(item => item.hasConfidence).map(item => item.confidence);
  return {
    dateFrom,
    dateTo,
    locale,
    totalQuestions: publicCurrent.length,
    uniqueSessions: new Set(publicCurrent.map(item => item.sessionId).filter(Boolean)).size,
    matchedCount: publicCurrent.filter(item => item.matched).length,
    unmatchedCount: publicCurrent.filter(item => !item.matched).length,
    lowConfidenceCount: publicCurrent.filter(item => item.hasConfidence && item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD).length,
    negativeFeedbackCount: publicCurrent.filter(item => item.feedback === 'not_helpful').length,
    averageConfidence: average(confidenceValues),
    needsImprovementCount: summary.improvement.total,
    intentDistribution: assistantIntentDistribution(current),
    conversationFunnels: funnels.summary,
    failedConversations: funnels.failed,
    repeatedQuestions: repeatedQuestions.slice(0, 20),
    matchedFaqStats: matchedFaqStats.slice(0, 20),
    weakFaqStats: weakFaqStats.slice(0, 15),
    missingFaqCandidates: buildMissingFaqCandidates(repeatedQuestions),
    dailyQuestionCounts: dailyCounts(current),
    comparisonWithPreviousPeriod: comparePeriods(current, previous),
    thresholds: { lowConfidence: ASSISTANT_LOW_CONFIDENCE_THRESHOLD, weakFaqNegativeRate: ASSISTANT_WEAK_FAQ_NEGATIVE_RATE },
  };
}

function readAllFaqEntries() {
  return readJsonArrayFile(path.join(__dirname, 'faq.json'))
    .map(item => ({
      id: sanitizeAiText(item.id, 80),
      category: sanitizeAiText(item.category, 160),
      questions: Array.isArray(item.questions) ? item.questions.map(question => sanitizeAiText(question, 220)).filter(Boolean).sort((a, b) => a.localeCompare(b)) : [],
      answers: Object.keys(item.answer || {}).sort().reduce((answers, lang) => {
        const safeLang = sanitizeAiText(lang, 12);
        const text = sanitizeAiText(item.answer?.[lang], 1200);
        if (safeLang && text) answers[safeLang] = text;
        return answers;
      }, {}),
    }))
    .filter(item => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function productCatalogMetadata(products) {
  return publicProductsFromData(products)
    .map(product => ({
      id: sanitizeAiText(product.id, 80),
      productType: sanitizeAiText(product.productType, 160),
      color: sanitizeAiText(product.color, 120),
      label: sanitizeAiText(product.label, 180),
      sellPrice: Number(product.sellPrice) || 0,
      inStock: Boolean(product.inStock),
      accent: sanitizeAiText(product.accent, 80),
    }))
    .sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color) || a.id.localeCompare(b.id));
}

function assistantAnswerExamples(records) {
  return records
    .map(toPublicAssistantRecord)
    .filter(item => item.normalizedQuestion || item.answer)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.id.localeCompare(b.id))
    .slice(0, 100)
    .map(item => ({
      id: item.id,
      createdAt: item.createdAt,
      locale: item.locale,
      normalizedQuestion: sanitizeAiText(item.normalizedQuestion, 180),
      question: sanitizeAiText(item.question, 300),
      assistantAnswer: sanitizeAiText(item.answer, 1200),
      matched: item.matched,
      matchedFaqId: item.matchedFaqId || null,
      confidence: item.hasConfidence ? item.confidence : null,
      feedback: item.feedback || '',
      improvementReasons: item.improvementReasons,
    }));
}

function representativeConversations(records, repeatedQuestions, includeConversations) {
  if (!includeConversations) return [];
  const publicRecords = records
    .map(toPublicAssistantRecord)
    .filter(item => item.sessionId && item.normalizedQuestion)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
  const bySession = new Map();
  publicRecords.forEach(item => {
    if (!bySession.has(item.sessionId)) bySession.set(item.sessionId, []);
    bySession.get(item.sessionId).push(item);
  });
  return repeatedQuestions.slice(0, 20).map(topic => {
    const conversations = [];
    for (const [sessionId, items] of bySession.entries()) {
      if (!items.some(item => item.normalizedQuestion === topic.normalizedQuestion)) continue;
      conversations.push({
        sessionRef: crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 16),
        messages: items.slice(0, 20).map(item => ({
          createdAt: item.createdAt,
          locale: item.locale,
          normalizedQuestion: sanitizeAiText(item.normalizedQuestion, 180),
          userQuestion: sanitizeAiText(item.question, 300),
          assistantAnswer: sanitizeAiText(item.answer, 1200),
          intent: item.intent || '',
          responseType: item.responseType || '',
          matched: item.matched,
          matchedFaqId: item.matchedFaqId || null,
          confidence: item.hasConfidence ? item.confidence : null,
          feedback: item.feedback || '',
          improvementReasons: item.improvementReasons,
        })),
      });
      if (conversations.length >= 10) break;
    }
    return {
      topic: sanitizeAiText(topic.normalizedQuestion, 180),
      count: topic.count,
      conversations,
    };
  }).filter(item => item.conversations.length);
}

function negativeFeedbackSummary(records) {
  const items = records
    .map(toPublicAssistantRecord)
    .filter(item => item.feedback === 'not_helpful')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.id.localeCompare(b.id));
  const byFaq = new Map();
  items.forEach(item => {
    const key = item.matchedFaqId || 'none';
    byFaq.set(key, (byFaq.get(key) || 0) + 1);
  });
  return {
    total: items.length,
    byFaqId: [...byFaq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([faqId, count]) => ({ faqId: faqId === 'none' ? null : faqId, count })),
    examples: items.slice(0, 50).map(item => ({
      createdAt: item.createdAt,
      locale: item.locale,
      question: sanitizeAiText(item.question, 300),
      assistantAnswer: sanitizeAiText(item.answer, 1200),
      matchedFaqId: item.matchedFaqId || null,
      confidence: item.hasConfidence ? item.confidence : null,
    })),
  };
}

function lowConfidenceQuestions(records) {
  return records
    .map(toPublicAssistantRecord)
    .filter(item => item.hasConfidence && item.confidence < ASSISTANT_LOW_CONFIDENCE_THRESHOLD)
    .sort((a, b) => a.confidence - b.confidence || String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.id.localeCompare(b.id))
    .slice(0, 100)
    .map(item => ({
      createdAt: item.createdAt,
      locale: item.locale,
      question: sanitizeAiText(item.question, 300),
      assistantAnswer: sanitizeAiText(item.answer, 1200),
      matched: item.matched,
      matchedFaqId: item.matchedFaqId || null,
      confidence: item.confidence,
      feedback: item.feedback || '',
    }));
}

function aiConversationHistory(records, includeConversations) {
  if (!includeConversations) return [];
  return assistantConversationGroups(records).slice(0, 200).map(session => {
    const messages = session.messages.map(item => ({
      messageId: sanitizeAiText(item.messageId, 100),
      timestamp: item.timestamp || item.createdAt,
      role: item.role || 'assistant',
      question: sanitizeAiText(item.question, 300),
      assistantAnswer: sanitizeAiText(item.assistantAnswer, 1200),
      matchedFaqId: item.matchedFaqId || null,
      matched: item.matched,
      confidence: item.hasConfidence ? item.confidence : null,
      intent: item.intent || '',
      responseType: item.responseType || '',
    }));
    const intentSequence = messages.map(item => item.intent).filter(Boolean);
    const recommendation = session.messages.find(item => ['recommendation', 'model', 'availability'].includes(item.responseType) || item.sessionContext?.recommendationShown);
    const handoff = intentSequence.includes('human_handoff');
    const ended = intentSequence.includes('conversation_end');
    return {
      sessionRef: session.sessionRef,
      startedAt: messages[0]?.timestamp || '',
      endedAt: messages.at(-1)?.timestamp || '',
      intentSequence,
      sessionOutcome: handoff ? 'human_handoff' : recommendation ? 'recommendation_shown' : ended ? 'ended' : 'open_or_unresolved',
      recommendationShown: recommendation ? { modelId: recommendation.modelId || '', colorKey: recommendation.colorKey || '', answer: sanitizeAiText(recommendation.assistantAnswer, 1200) } : null,
      followUpQuestions: messages.filter(item => ['product_selection', 'clarify'].includes(item.intent) || item.responseType === 'clarify').map(item => item.assistantAnswer).filter(Boolean),
      messages,
    };
  });
}

async function buildAssistantImprovementAiExport(query = {}) {
  const data = await buildAssistantImprovementReportData(query);
  const locale = assistantReportLocale(query);
  const includeConversations = String(query.includeConversations || '').toLowerCase() === 'true';
  const records = (await allAssistantRecords()).filter(record => assistantRecordInRange(record, data.dateFrom, data.dateTo, locale));
  const repeatedQuestions = groupRepeatedQuestions(records);
  const faqEntries = readAllFaqEntries();
  const faqUsage = new Map(data.matchedFaqStats.map(stat => [stat.faqId, stat]));
  const faqIds = [...new Set([...faqEntries.map(faq => faq.id), ...faqUsage.keys()].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const { products } = await dbGetAll();
  return {
    exportVersion: 1,
    purpose: 'assistant_improvement_llm_review',
    parameters: {
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      locale: data.locale || '',
      includeConversations,
    },
    thresholds: data.thresholds,
    overview: {
      totalQuestions: data.totalQuestions,
      uniqueSessions: data.uniqueSessions,
      matchedCount: data.matchedCount,
      unmatchedCount: data.unmatchedCount,
      lowConfidenceCount: data.lowConfidenceCount,
      negativeFeedbackCount: data.negativeFeedbackCount,
      averageConfidence: data.averageConfidence,
      needsImprovementCount: data.needsImprovementCount,
      intentDistribution: data.intentDistribution,
      conversationFunnels: data.conversationFunnels,
      failedConversations: data.failedConversations,
      dailyQuestionCounts: data.dailyQuestionCounts,
      comparisonWithPreviousPeriod: data.comparisonWithPreviousPeriod,
    },
    topRepeatedQuestions: repeatedQuestions.slice(0, 50),
    missingFaqCandidates: data.missingFaqCandidates,
    weakFaqStatistics: data.weakFaqStats,
    faqEntries,
    faqUsageStatistics: faqIds.map(faqId => {
      const stat = faqUsage.get(faqId);
      return stat || {
        faqId,
        usageCount: 0,
        averageConfidence: null,
        positiveFeedbackCount: 0,
        negativeFeedbackCount: 0,
        negativeFeedbackRate: 0,
        unmatchedFollowUpCount: 0,
        exampleQuestions: [],
        weak: false,
        weakReasons: [],
      };
    }),
    negativeFeedbackSummary: negativeFeedbackSummary(records),
    lowConfidenceQuestions: lowConfidenceQuestions(records),
    conversationHistory: aiConversationHistory(records, includeConversations),
    exampleConversations: representativeConversations(records, repeatedQuestions, includeConversations),
    assistantAnswers: assistantAnswerExamples(records),
    currentFaqTextsByLanguage: faqEntries.reduce((acc, faq) => {
      Object.entries(faq.answers).forEach(([lang, answer]) => {
        if (!acc[lang]) acc[lang] = [];
        acc[lang].push({ id: faq.id, category: faq.category, questions: faq.questions, answer });
      });
      return acc;
    }, {}),
    productCatalogMetadata: productCatalogMetadata(products),
  };
}

function readAssistantReportsFile() {
  return readJsonArrayFile(FILES.assistantImprovementReports);
}

function writeAssistantReportsFile(records) {
  writeJsonArrayFile(FILES.assistantImprovementReports, records, 300);
}

function publicAssistantReport(report) {
  return {
    id: assistantRecordId(report),
    dateFrom: report.dateFrom,
    dateTo: report.dateTo,
    locale: report.locale || '',
    generatedAt: report.generatedAt,
    generatedBy: report.generatedBy || '',
    dataSnapshot: report.dataSnapshot,
    aiSummary: report.aiSummary || '',
    recommendedActions: report.recommendedActions || [],
    model: report.model || '',
    promptVersion: report.promptVersion || ASSISTANT_REPORT_PROMPT_VERSION,
    status: report.status || 'generated',
    error: report.error || '',
  };
}

async function saveAssistantReport(report) {
  const record = { id: crypto.randomUUID(), ...report };
  if (USE_MONGO) {
    const result = await db.collection(COLL.assistantImprovementReports).insertOne(record);
    return { ...record, _id: result.insertedId };
  }
  const reports = readAssistantReportsFile();
  reports.push(record);
  writeAssistantReportsFile(reports);
  return record;
}

async function listAssistantReports() {
  const reports = USE_MONGO
    ? await db.collection(COLL.assistantImprovementReports).find({}, { projection: { dataSnapshot: 0 } }).sort({ generatedAt: -1 }).limit(50).toArray()
    : readAssistantReportsFile().sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || ''))).slice(0, 50);
  return reports.map(publicAssistantReport);
}

async function getAssistantReport(id) {
  if (USE_MONGO) {
    const query = isMongoId(id) ? { _id: new ObjectId(id) } : { id };
    const report = await db.collection(COLL.assistantImprovementReports).findOne(query);
    return report ? publicAssistantReport(report) : null;
  }
  const report = readAssistantReportsFile().find(item => assistantRecordId(item) === id);
  return report ? publicAssistantReport(report) : null;
}

async function updateAssistantReportAction(reportId, actionIndex, patch) {
  const status = ['open', 'accepted', 'rejected', 'completed'].includes(patch.status) ? patch.status : null;
  const adminNote = patch.adminNote === undefined ? undefined : sanitizeAssistantText(patch.adminNote, 500);
  if (status == null && adminNote === undefined) return false;
  const index = Number(actionIndex);
  if (!Number.isInteger(index) || index < 0) return false;
  const report = await getAssistantReport(reportId);
  if (!report || !report.recommendedActions[index]) return false;
  const actions = report.recommendedActions.map((action, i) => i === index ? { ...action, ...(status ? { status } : {}), ...(adminNote !== undefined ? { adminNote } : {}) } : action);
  if (USE_MONGO) {
    const query = isMongoId(reportId) ? { _id: new ObjectId(reportId) } : { id: reportId };
    const result = await db.collection(COLL.assistantImprovementReports).updateOne(query, { $set: { recommendedActions: actions } });
    return result.matchedCount > 0;
  }
  const reports = readAssistantReportsFile();
  const idx = reports.findIndex(item => assistantRecordId(item) === reportId);
  if (idx < 0) return false;
  reports[idx].recommendedActions = actions;
  writeAssistantReportsFile(reports);
  return true;
}

function relevantFaqForReport(data) {
  const ids = new Set([
    ...data.matchedFaqStats.map(item => item.faqId),
    ...data.weakFaqStats.map(item => item.faqId),
  ].filter(Boolean));
  const faqItems = readJsonArrayFile(path.join(__dirname, 'faq.json'));
  return faqItems
    .filter(item => ids.has(item.id))
    .slice(0, 20)
    .map(item => ({
      id: item.id,
      category: redactPii(item.category, 120),
      questions: (item.questions || []).slice(0, 5).map(q => redactPii(q, 160)),
      answer: redactPii(item.answer?.[data.locale || 'ru'] || item.answer?.ru || '', 500),
    }));
}

function validateAiReport(value) {
  if (!value || typeof value !== 'object') throw new Error('AI output is not an object');
  const summary = sanitizeAssistantText(value.summary, 1000);
  if (!summary) throw new Error('AI summary is missing');
  if (!Array.isArray(value.recommendedActions)) throw new Error('AI actions missing');
  const actions = value.recommendedActions.slice(0, 20).map(action => {
    const type = ['create_faq', 'update_faq', 'investigate'].includes(action.type) ? action.type : 'investigate';
    const priority = ['high', 'medium', 'low'].includes(action.priority) ? action.priority : 'medium';
    return {
      type,
      priority,
      title: sanitizeAssistantText(action.title, 160),
      reason: sanitizeAssistantText(action.reason, 500),
      evidence: {
        questionCount: Math.max(0, Number(action.evidence?.questionCount) || 0),
        negativeFeedbackCount: Math.max(0, Number(action.evidence?.negativeFeedbackCount) || 0),
        averageConfidence: action.evidence?.averageConfidence == null ? null : Math.max(0, Math.min(1, Number(action.evidence.averageConfidence) || 0)),
        exampleQuestions: Array.isArray(action.evidence?.exampleQuestions) ? action.evidence.exampleQuestions.slice(0, 5).map(q => redactPii(q, 180)) : [],
      },
      faqId: sanitizeAssistantText(action.faqId, 80) || null,
      suggestedQuestion: sanitizeAssistantText(action.suggestedQuestion, 220) || null,
      suggestedAnswer: sanitizeAssistantText(action.suggestedAnswer, 700) || null,
      status: 'open',
      adminNote: '',
    };
  }).filter(action => action.title && action.reason);
  return { summary, recommendedActions: actions };
}

async function callAssistantReportAi(data, faqEntries, locale, mock = '') {
  const aiMock = mock || process.env.ASSISTANT_REPORT_AI_MOCK;
  if (aiMock === 'malformed') throw new Error('Malformed AI response');
  if (aiMock === 'failure') throw new Error('AI provider failure');
  if (aiMock === 'valid') {
    return validateAiReport({ summary: 'Review high-priority assistant gaps.', recommendedActions: [{ type: 'investigate', priority: 'high', title: 'Review missing FAQ topics', reason: 'Aggregated data shows unanswered repeated questions.', evidence: { questionCount: data.unmatchedCount, negativeFeedbackCount: data.negativeFeedbackCount, averageConfidence: data.averageConfidence, exampleQuestions: data.repeatedQuestions[0]?.exampleQuestions || [] }, faqId: null, suggestedQuestion: null, suggestedAnswer: null }] });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { summary: 'AI recommendations were not generated because OPENAI_API_KEY is not configured.', recommendedActions: [] };
  const model = process.env.ASSISTANT_REPORT_MODEL || 'gpt-4o-mini';
  const payload = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You produce JSON assistant improvement recommendations using only supplied evidence. Never invent product features, availability, prices, guarantees, or compatibility. Prefer updating existing FAQ over duplicates. Mention uncertainty. Keep suggested FAQ answers concise.' },
      { role: 'user', content: JSON.stringify({ locale, data: { ...data, repeatedQuestions: data.repeatedQuestions.slice(0, 12), missingFaqCandidates: data.missingFaqCandidates.slice(0, 10), weakFaqStats: data.weakFaqStats.slice(0, 10), matchedFaqStats: data.matchedFaqStats.slice(0, 10) }, faqEntries }) },
    ],
    temperature: 0.2,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error?.message || `AI HTTP ${res.status}`);
    return validateAiReport(JSON.parse(body.choices?.[0]?.message?.content || '{}'));
  } finally {
    clearTimeout(timer);
  }
}

async function listAssistantQuestions(query) {
  const filter = assistantFilterFromQuery(query);
  if (USE_MONGO) {
    const mongoFilter = {};
    if (filter.locale) mongoFilter.locale = filter.locale;
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
    if (filter.preset === 'needs_improvement' || typeof filter.matched === 'boolean') {
      const candidates = await coll.find(mongoFilter, { projection: { userAgent: 0 } }).sort({ createdAt: -1 }).limit(5000).toArray();
      const filteredBase = candidates.filter(record => assistantRecordMatches(record, filter));
      const filtered = (filter.preset === 'needs_improvement' ? removeAssistantSessionDuplicates(filteredBase) : filteredBase).sort((a, b) => (
        filter.preset === 'needs_improvement' ? compareAssistantImprovement(a, b) : String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      ));
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
    const matchedFaqId = sanitizeAssistantText(req.body?.matchedFaqId, 80) || null;
    const matched = Boolean(req.body?.matched) || Boolean(matchedFaqId);
    const confidence = Math.max(0, Math.min(1, Number(req.body?.confidence) || 0));
    const sessionId = sanitizeAssistantText(req.body?.sessionId, 80).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    const messageId = sanitizeAssistantText(req.body?.messageId, 100).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const sessionContext = req.body?.sessionContext && typeof req.body.sessionContext === 'object' ? {
      intent: sanitizeAssistantText(req.body.sessionContext.intent, 60),
      recommendationShown: Boolean(req.body.sessionContext.recommendationShown),
      followupAsked: Boolean(req.body.sessionContext.followupAsked),
      selectedScenario: sanitizeAssistantText(req.body.sessionContext.selectedScenario, 60),
      preferences: {
        useCase: sanitizeAssistantText(req.body.sessionContext.preferences?.useCase, 80) || null,
        budget: sanitizeAssistantText(req.body.sessionContext.preferences?.budget, 80) || null,
        soundPriority: sanitizeAssistantText(req.body.sessionContext.preferences?.soundPriority, 80) || null,
        smartHome: req.body.sessionContext.preferences?.smartHome == null ? null : Boolean(req.body.sessionContext.preferences.smartHome),
        portable: req.body.sessionContext.preferences?.portable == null ? null : Boolean(req.body.sessionContext.preferences.portable),
      },
    } : null;
    const entry = {
      messageId,
      timestamp: createdAt,
      role: 'assistant',
      question,
      answer,
      assistantAnswer: sanitizeAssistantText(req.body?.assistantAnswer || answer, 1200),
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
      sessionContext,
      normalizedQuestion: normalizeQuestionText(question),
      reviewed: false,
      adminNote: '',
      createdAt,
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

app.post('/api/public/analytics/event', async (req, res) => {
  try {
    const result = await saveVisitorAnalyticsEvent(req, req.body || {});
    if (!result.body) return res.status(result.status).end();
    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error('Visitor analytics event error:', e.message);
    return res.status(204).end();
  }
});

app.get('/api/admin/analytics/visitors', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await visitorAnalyticsList(req.query));
  } catch (e) {
    console.error('Visitor analytics list error:', e.message);
    sendGenericError(res);
  }
});

app.get('/api/admin/analytics/visitors/:visitorId', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await visitorAnalyticsDetail(req.params.visitorId, req.query);
    res.status(result.status).json(result.body);
  } catch (e) {
    console.error('Visitor analytics detail error:', e.message);
    sendGenericError(res);
  }
});

app.delete('/api/admin/analytics/visitors/:visitorId', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await deleteVisitorAnalytics([req.params.visitorId]);
    res.status(result.status).json(result.body);
  } catch (e) {
    console.error('Visitor analytics delete error:', e.message);
    sendGenericError(res);
  }
});

app.delete('/api/admin/analytics/visitors', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await deleteVisitorAnalytics(req.body?.visitorIds || []);
    res.status(result.status).json(result.body);
  } catch (e) {
    console.error('Visitor analytics bulk delete error:', e.message);
    sendGenericError(res);
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

app.get('/api/admin/assistant-improvement-report/data', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await buildAssistantImprovementReportData(req.query));
  } catch (e) {
    console.error('Assistant improvement report data error:', e.message);
    sendGenericError(res);
  }
});

app.get('/api/admin/assistant-improvement-report/export', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = await buildAssistantImprovementAiExport(req.query);
    const from = String(data.parameters.dateFrom || '').slice(0, 10) || 'from';
    const to = String(data.parameters.dateTo || '').slice(0, 10) || 'to';
    const locale = data.parameters.locale || 'all';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="assistant-ai-report-${from}-${to}-${locale}.json"`);
    res.send(JSON.stringify(data));
  } catch (e) {
    console.error('Assistant improvement report export error:', e.message);
    sendGenericError(res);
  }
});

app.post('/api/admin/assistant-improvement-report/generate', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = await buildAssistantImprovementReportData(req.body || {});
    const faqEntries = relevantFaqForReport(data);
    let ai;
    let status = 'generated';
    let error = '';
    try {
      const testMock = process.env.NODE_ENV === 'test' ? sanitizeAssistantText(req.body?.aiMock, 20) : '';
      ai = await callAssistantReportAi(data, faqEntries, data.locale || 'ru', testMock);
      if (!process.env.OPENAI_API_KEY && !process.env.ASSISTANT_REPORT_AI_MOCK && !testMock) status = 'no_ai';
    } catch (err) {
      status = 'failed';
      error = sanitizeAssistantText(err.message, 300);
      ai = { summary: '', recommendedActions: [] };
    }
    const report = await saveAssistantReport({
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      locale: data.locale || '',
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.username,
      dataSnapshot: data,
      aiSummary: ai.summary,
      recommendedActions: ai.recommendedActions,
      model: process.env.ASSISTANT_REPORT_MODEL || (process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : ''),
      promptVersion: ASSISTANT_REPORT_PROMPT_VERSION,
      status,
      error,
    });
    res.json({ ok: status !== 'failed', report: publicAssistantReport(report) });
  } catch (e) {
    console.error('Assistant improvement report generate error:', e.message);
    sendGenericError(res);
  }
});

app.get('/api/admin/assistant-improvement-reports', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json({ reports: await listAssistantReports() });
  } catch (e) {
    console.error('Assistant improvement reports list error:', e.message);
    sendGenericError(res);
  }
});

app.get('/api/admin/assistant-improvement-reports/:id', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const report = await getAssistantReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Not found' });
    res.json({ report });
  } catch (e) {
    console.error('Assistant improvement report read error:', e.message);
    sendGenericError(res);
  }
});

app.patch('/api/admin/assistant-improvement-reports/:reportId/actions/:actionIndex', requireInventoryHost, requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await updateAssistantReportAction(req.params.reportId, req.params.actionIndex, req.body || {});
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Assistant improvement report action update error:', e.message);
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
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

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
