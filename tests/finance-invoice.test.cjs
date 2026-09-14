const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'finance-invoice.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'finance.html'), 'utf8');

assert.doesNotThrow(() => new vm.Script(source, { filename: 'finance-invoice.js' }));
assert.equal(source.includes('addImage('), false, 'mobile invoice must not use jsPDF addImage');
assert.equal(source.includes('const LOGO ='), false, 'invoice must not use pixel-rasterized logo data');
assert.match(source, /doc\.text\('Hey'/, 'invoice logo must render Hey as vector text');
assert.match(source, /\['S', \[13, 153, 255\]\]/, 'invoice logo must start Smart with approved blue');
assert.match(source, /\['t', \[151, 0, 255\]\]/, 'invoice logo must end Smart with approved violet');
assert.match(source, /RĒĶINS/, 'invoice must contain Latvian title');
assert.match(source, /Maksājuma mērķis/, 'invoice must preserve Latvian diacritics');

assert.equal(html.includes('approvedLogo'), false, 'finance.html must not contain the stale inline image logo patch');
assert.equal(html.includes('addImage('), false, 'finance.html must not reintroduce jsPDF addImage');
assert.match(html, /finance-invoice\.js\?v=20260914-3/, 'invoice script must be cache-busted');
assert.match(html, /this\.output\('blob'\)/, 'mobile save patch must use jsPDF blob output');
assert.match(html, /URL\.createObjectURL\(blob\)/, 'mobile save patch must create a browser blob URL');

const elements = new Map();
function element(id, extra = {}) {
  const value = {
    id,
    value: '',
    placeholder: '',
    hidden: false,
    className: '',
    textContent: '',
    open: false,
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    closest() { return { insertAdjacentHTML() {} }; },
    ...extra,
  };
  elements.set(id, value);
  return value;
}

element('invoice-customer-first-name', { value: 'Test' });
element('invoice-customer-last-name', { value: 'Customer' });
element('invoice-customer-personal-code', { value: '010190-12345' });
element('finance-toast');
element('invoice-settings-panel');
element('invoice-settings-form');
element('invoice-number-btn');
element('invoice-pdf-btn');
element('income-form');
element('income-client', { selectedIndex: 0, options: [{ text: 'customer@example.com' }] });
element('income-type', { value: 'subscription' });
element('income-date', { value: '2026-09-13' });
element('income-amount', { value: '35' });
element('income-invoice', { value: 'HS-2026-001', placeholder: 'HS-2026-001' });
for (const id of [
  'invoice-seller-name', 'invoice-seller-regno', 'invoice-seller-address',
  'invoice-seller-iban', 'invoice-seller-bic', 'invoice-seller-email',
]) element(id);

let domReady;
let savedPdf = '';
const textCalls = [];
const textColors = [];
const embeddedFonts = [];

class FakeJsPDF {
  addFileToVFS(name, data) { embeddedFonts.push({ type: 'vfs', name, data }); }
  addFont(file, family, style) { embeddedFonts.push({ type: 'font', file, family, style }); }
  setFont() {}
  setFontSize() {}
  setTextColor(...args) { textColors.push(args.join(',')); }
  setFillColor() {}
  setDrawColor() {}
  text(value, x, y) { textCalls.push({ value: String(value), x, y }); }
  getTextWidth(value) { return String(value).length * 4.5; }
  rect() {}
  line() {}
  save(name) { savedPdf = name; }
}

const localStore = new Map([['inv_token', 'test-token']]);
const fakeFontBuffer = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]).buffer;
const sandbox = {
  console,
  Uint8Array,
  btoa(value) { return Buffer.from(value, 'binary').toString('base64'); },
  setTimeout: fn => { fn(); return 1; },
  clearTimeout() {},
  localStorage: {
    getItem(key) { return localStore.get(key) || null; },
    setItem(key, value) { localStore.set(key, String(value)); },
  },
  document: { getElementById(id) { return elements.get(id) || null; } },
  window: {
    jspdf: { jsPDF: FakeJsPDF },
    addEventListener(type, fn) { if (type === 'DOMContentLoaded') domReady = fn; },
  },
  fetch: async url => {
    if (url === '/api/data') {
      return {
        ok: true,
        async json() {
          return {
            hostSubscriptions: [{
              financeInvoiceSettings: {
                sellerName: 'SERGEJS TESTS',
                sellerRegNo: '010190-12345',
                sellerAddress: 'Rīga',
                sellerIban: 'LV00TEST0000000000000',
                sellerBic: 'TESTLV22',
                sellerEmail: 'test@example.com',
              },
            }],
          };
        },
      };
    }
    if (url === '/api/save') return { ok: true, async json() { return {}; } };
    if (/\.ttf(?:$|\?)/.test(String(url))) {
      return { ok: true, status: 200, async arrayBuffer() { return fakeFontBuffer; } };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  },
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'finance-invoice.js' });
assert.equal(typeof domReady, 'function', 'invoice script must register DOMContentLoaded');
domReady();

(async () => {
  await new Promise(resolve => setImmediate(resolve));
  const button = elements.get('invoice-pdf-btn');
  assert.equal(typeof button.listeners.click, 'function', 'PDF button must have a click handler');
  await button.listeners.click();

  const logoText = textCalls.slice(0, 6).map(call => call.value).join('');
  assert.equal(logoText, 'HeySmart', 'invoice logo must render exact HeySmart wordmark');
  assert.ok(new Set(textColors.slice(0, 7)).size >= 5, 'invoice logo must use multiple blue-to-violet colors');
  assert.ok(embeddedFonts.some(item => item.type === 'font' && item.style === 'normal'), 'regular Unicode font must be embedded');
  assert.ok(embeddedFonts.some(item => item.type === 'font' && item.style === 'bold'), 'bold Unicode font must be embedded');
  assert.ok(textCalls.some(call => call.value === 'RĒĶINS'), 'Latvian title must render with diacritics');
  assert.ok(textCalls.some(call => call.value.includes('Maksājuma mērķis')), 'Latvian payment reference must render with diacritics');
  assert.equal(savedPdf, 'HS-2026-001.pdf', 'invoice must be saved with its invoice number');
  console.log('finance-invoice.test.cjs: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
