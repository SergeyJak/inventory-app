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
assert.equal(source.includes('PDF_FONT_'), false, 'invoice must not depend on external PDF fonts');
assert.equal(/https?:\/\/[^'"\s]+\.ttf/.test(source), false, 'invoice must not fetch TTF fonts from the network');
assert.match(source, /const LATVIAN_GLYPHS =/, 'invoice must define local Latvian glyph rendering');
assert.match(source, /'Ē': \['E', 'macron'\]/, 'Latvian macron capitals must be supported');
assert.match(source, /'Ķ': \['K', 'comma'\]/, 'Latvian comma consonants must be supported');
assert.match(source, /'š': \['s', 'caron'\]/, 'Latvian caron letters must be supported');
assert.match(source, /doc\.text\('Hey'/, 'invoice logo must render Hey as vector text');
assert.match(source, /\['S', \[13, 153, 255\]\]/, 'invoice logo must start Smart with approved blue');
assert.match(source, /\['t', \[151, 0, 255\]\]/, 'invoice logo must end Smart with approved violet');
assert.match(source, /RĒĶINS/, 'invoice must contain Latvian title');
assert.match(source, /Maksājuma mērķis/, 'invoice must preserve Latvian source text');
assert.match(source, /Dokuments sagatavots elektroniski un ir derīgs bez paraksta\./, 'invoice must state that the electronic document is valid without a signature');
assert.match(source, /Apmaksājot rēķinu, maksājuma mērķī norādiet rēķina numuru:/, 'invoice must instruct the payer to include the invoice number');
assert.match(source, /selectedClient\?\.dataset\?\.email/, 'invoice must read recipient email from the selected option data-email attribute');

assert.equal(html.includes('approvedLogo'), false, 'finance.html must not contain the stale inline image logo patch');
assert.equal(html.includes('addImage('), false, 'finance.html must not reintroduce jsPDF addImage');
assert.match(html, /finance-invoice\.js\?v=20260920-1&lv=5/, 'invoice script must use the latest cache-busted renderer');
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

element('invoice-customer-first-name', { value: 'Rēnars' });
element('invoice-customer-last-name', { value: 'Ķikuģ' });
element('invoice-customer-personal-code', { value: '010190-12345' });
element('finance-toast');
element('invoice-settings-panel');
element('invoice-settings-form');
element('invoice-number-btn');
element('invoice-pdf-btn');
element('income-form');
element('income-client', { selectedIndex: 0, options: [{ text: 'Customer Name', dataset: { email: 'customer@example.com' } }] });
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
const lineCalls = [];

class FakeJsPDF {
  constructor() {
    this.fontSize = 10;
    this.internal = { getFontSize: () => this.fontSize };
  }
  setFont() {}
  setFontSize(value) { this.fontSize = Number(value); }
  setLineWidth() {}
  setTextColor(...args) { textColors.push(args.join(',')); }
  setFillColor() {}
  setDrawColor() {}
  text(value, x, y) { textCalls.push({ value: String(value), x, y }); }
  getTextWidth(value) { return String(value).length * 2.1; }
  rect() {}
  line(...args) { lineCalls.push(args); }
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
                sellerName: 'SERGEJS JAKIMUŠKINS',
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
  assert.ok(lineCalls.length >= 12, 'Latvian diacritics must be drawn as vector marks');
  assert.ok(textCalls.some(call => call.value === 'E'), 'RĒĶINS macron base letter must render');
  assert.ok(textCalls.some(call => call.value === 'K'), 'RĒĶINS comma base letter must render');
  assert.ok(textCalls.some(call => call.value === 'D'), 'electronic document footer must render');
  assert.ok(textCalls.some(call => call.value === ':'), 'payment-purpose footer must render the invoice reference line');
  const renderedText = textCalls.map(call => call.value).join('');
  assert.ok(renderedText.includes('customer@example.com'), 'PDF recipient must contain the selected account email');
  assert.equal(renderedText.includes('Customer Name'), false, 'PDF recipient must not use the dropdown display name when data-email is available');
  assert.equal(savedPdf, 'HS-2026-001.pdf', 'invoice must be saved with its invoice number');
  console.log('finance-invoice.test.cjs: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
