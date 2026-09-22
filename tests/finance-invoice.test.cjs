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
assert.match(source, /const LATVIAN_GLYPHS =/, 'invoice must define local Latvian glyph rendering');
assert.match(source, /Dokuments sagatavots elektroniski un ir derīgs bez paraksta\./, 'invoice must keep electronic-document footer');
assert.match(source, /Apmaksājot rēķinu, maksājuma mērķī norādiet rēķina numuru:/, 'invoice must keep payment-purpose footer');
assert.match(source, /invoice\.sellerSnapshot/, 'PDF must use the immutable seller snapshot');
assert.match(source, /customerEmailSnapshot/, 'PDF must use the immutable customer snapshot');
assert.match(source, /invoice\.status === 'VOID'/, 'void invoices must be visibly marked');
assert.match(source, /window\.generateFinanceInvoicePdf = generatePdf/, 'PDF renderer must be callable from invoice list actions');

assert.match(html, /finance-invoice\.js\?v=20260921-1&lv=8/, 'invoice renderer must be cache busted');
assert.equal(html.includes('invoice-number-btn'), false, 'manual invoice number reservation button must be removed');
assert.equal(html.includes('invoice-pdf-btn'), false, 'form PDF button must be replaced by invoice-record PDF action');
assert.match(html, /id="invoice-tbody"/, 'invoice list must exist');

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

element('invoice-customer-first-name');
element('invoice-customer-last-name');
element('invoice-customer-personal-code');
element('finance-toast');
element('invoice-settings-form');
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

const sandbox = {
  console,
  setTimeout: fn => { fn(); return 1; },
  clearTimeout() {},
  localStorage: {
    getItem() { return null; },
    setItem() {},
  },
  document: { getElementById(id) { return elements.get(id) || null; } },
  window: {
    jspdf: { jsPDF: FakeJsPDF },
    addEventListener(type, fn) { if (type === 'DOMContentLoaded') domReady = fn; },
  },
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'finance-invoice.js' });
assert.equal(typeof domReady, 'function', 'invoice script must register DOMContentLoaded');
domReady();
assert.equal(typeof sandbox.window.generateFinanceInvoicePdf, 'function', 'invoice PDF renderer must be exposed');

(async () => {
  await sandbox.window.generateFinanceInvoicePdf({
    id: 'invoice-1',
    invoiceNo: 'HS-2026-005',
    status: 'VOID',
    type: 'subscription',
    date: '2026-09-21',
    amount: 35,
    customerFirstName: 'Rēnars',
    customerLastName: 'Ķikuģ',
    customerPersonalCode: '010190-12345',
    customerEmailSnapshot: 'customer@example.com',
    sellerSnapshot: {
      sellerName: 'SERGEJS JAKIMUŠKINS',
      sellerRegNo: '010190-12345',
      sellerAddress: 'Rīga',
      sellerIban: 'LV00TEST0000000000000',
      sellerBic: 'TESTLV22',
      sellerEmail: 'seller@example.com',
    },
  });

  const renderedText = textCalls.map(call => call.value).join('');
  assert.ok(renderedText.includes('customer@example.com'), 'PDF must contain snapshotted customer email');
  assert.ok(renderedText.includes('LV00TEST0000000000000'), 'PDF must contain snapshotted seller IBAN');
  assert.ok(renderedText.includes('ANULETS'), 'VOID PDF must contain ANULĒTS mark through local glyph renderer');
  assert.ok(textCalls.some(call => call.value === 'D'), 'electronic document footer must render');
  assert.ok(lineCalls.length >= 12, 'Latvian diacritics must still render as vector marks');
  assert.equal(savedPdf, 'HS-2026-005.pdf', 'PDF filename must use reserved invoice number');
  console.log('finance-invoice.test.cjs: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
