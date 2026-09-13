const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'finance-invoice.js'), 'utf8');

// 1) Basic parse guard. A broken browser script must fail CI immediately.
assert.doesNotThrow(() => new vm.Script(source, { filename: 'finance-invoice.js' }));

// 2) Validate the embedded logo payload before the browser/jsPDF sees it.
const logoMatch = source.match(/const\s+LOGO_JPEG\s*=\s*['"]data:image\/jpeg;base64,([^'"]+)['"]/);
assert.ok(logoMatch, 'finance-invoice.js must embed the approved JPEG logo');
const logoBytes = Buffer.from(logoMatch[1], 'base64');
assert.ok(logoBytes.length > 100, 'embedded logo must not be empty');
assert.equal(logoBytes[0], 0xff, 'JPEG must start with FF D8');
assert.equal(logoBytes[1], 0xd8, 'JPEG must start with FF D8');
assert.equal(logoBytes.at(-2), 0xff, 'JPEG must end with FF D9');
assert.equal(logoBytes.at(-1), 0xd9, 'JPEG must end with FF D9');

const elements = new Map();
function element(id, extra = {}) {
  const value = {
    id,
    value: '',
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

// Pre-create optional customer fields so ensureCustomerFields does not mutate DOM in the test.
element('invoice-customer-first-name', { value: 'Test' });
element('invoice-customer-last-name', { value: 'Customer' });
element('invoice-customer-personal-code', { value: '010190-12345' });
element('finance-toast');
element('invoice-settings-panel');
element('invoice-settings-form');
element('invoice-number-btn');
element('invoice-pdf-btn');
element('income-form');
element('income-client', {
  selectedIndex: 0,
  options: [{ text: 'customer@example.com' }],
});
element('income-type', { value: 'subscription' });
element('income-date', { value: '2026-09-13' });
element('income-amount', { value: '35' });
element('income-invoice', { value: 'HS-2026-001', placeholder: 'HS-2026-001' });
for (const id of [
  'invoice-seller-name',
  'invoice-seller-regno',
  'invoice-seller-address',
  'invoice-seller-iban',
  'invoice-seller-bic',
  'invoice-seller-email',
]) element(id);

let domReady;
let savedPdf = '';
let imageCalls = 0;
let imageValidated = false;

class FakeJsPDF {
  addImage(data, format) {
    imageCalls += 1;
    assert.equal(format, 'JPEG');
    assert.match(data, /^data:image\/jpeg;base64,/);
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    imageValidated = true;
  }
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  setFillColor() {}
  setDrawColor() {}
  text() {}
  rect() {}
  line() {}
  save(name) { savedPdf = name; }
}

const localStore = new Map();
const sandbox = {
  console,
  Buffer,
  setTimeout: fn => { fn(); return 1; },
  clearTimeout() {},
  localStorage: {
    getItem(key) { return localStore.get(key) || null; },
    setItem(key, value) { localStore.set(key, String(value)); },
  },
  document: {
    getElementById(id) { return elements.get(id) || null; },
  },
  window: {
    jspdf: { jsPDF: FakeJsPDF },
    addEventListener(type, fn) {
      if (type === 'DOMContentLoaded') domReady = fn;
    },
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
  // Allow async settings load triggered on DOMContentLoaded to settle.
  await new Promise(resolve => setImmediate(resolve));
  const button = elements.get('invoice-pdf-btn');
  assert.equal(typeof button.listeners.click, 'function', 'PDF button must have a click handler');
  await button.listeners.click();

  assert.equal(imageCalls, 1, 'invoice must render exactly one logo image');
  assert.equal(imageValidated, true, 'embedded logo image must be a valid JPEG payload');
  assert.equal(savedPdf, 'HS-2026-001.pdf', 'invoice must be saved with its invoice number');
  console.log('finance-invoice.test.cjs: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
