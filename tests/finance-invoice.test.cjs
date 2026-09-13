const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'finance-invoice.js'), 'utf8');

assert.doesNotThrow(() => new vm.Script(source, { filename: 'finance-invoice.js' }));
assert.equal(source.includes('addImage('), false, 'mobile invoice must not use jsPDF addImage');
assert.match(source, /const\s+LOGO\s*=\s*\{/, 'approved logo vector data must be embedded');

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
let rectCalls = 0;
const fillColors = [];

class FakeJsPDF {
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  setFillColor(...args) { fillColors.push(args.join(',')); }
  setDrawColor() {}
  text() {}
  rect() { rectCalls += 1; }
  line() {}
  save(name) { savedPdf = name; }
}

const localStore = new Map([['inv_token', 'test-token']]);
const sandbox = {
  console,
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
                sellerAddress: 'Riga',
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

  const distinctColors = new Set(fillColors);
  assert.ok(distinctColors.size >= 3, 'logo must render with multiple distinct approved colors');
  assert.ok(rectCalls > 1000, 'logo must render from embedded vectorized raster data');
  assert.equal(savedPdf, 'HS-2026-001.pdf', 'invoice must be saved with its invoice number');
  console.log('finance-invoice.test.cjs: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
