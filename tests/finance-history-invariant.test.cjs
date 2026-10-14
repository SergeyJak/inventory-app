const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'finance.js'), 'utf8');
const start = source.indexOf('  function invoiceRows(year = null) {');
const end = source.indexOf('\n  function renderInvoices()', start);
assert.ok(start >= 0 && end > start, 'invoiceRows implementation must exist');

const legacy = Array.from({ length: 5 }, (_, i) => ({
  id: 'legacy-' + i, invoiceNo: 'HS-2026-00' + (i + 1),
  date: '2026-09-' + String(14 + i).padStart(2, '0'),
  amount: 10, ownerEmailSnapshot: 'legacy@example.com'
}));
const modern = [
  { id: 'modern-6', invoiceNo: 'HS-2026-006', date: '2026-09-25', status: 'CONFIRMED' },
  { id: 'modern-7', invoiceNo: 'HS-2026-007', date: '2026-10-09', status: 'CONFIRMED' },
];
const state = { financeIncome: [...legacy, { invoiceNo: 'HS-2026-006', date: '2026-09-25' }], financeInvoices: modern };
const controls = {};
const sandbox = {
  state,
  byId: id => controls[id] || null,
  dateYear: date => Number(String(date).slice(0, 4)),
  invoiceStatusLabel: status => status === 'CONFIRMED' ? 'CONFIRMED' : status || 'DRAFT',
  Set, String, Number
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);
const rows = sandbox.invoiceRows();
assert.equal(rows.length, 7, 'must show all five legacy and two new invoices');
assert.equal(new Set(rows.map(row => row.invoiceNo)).size, 7, 'must never duplicate invoices');
assert.equal(rows.filter(row => row.legacyInvoice).length, 5, 'legacy records stay visible');
assert.equal(rows.find(row => row.invoiceNo === 'HS-2026-006').id, 'modern-6', 'dedicated invoice takes precedence');
assert.equal(sandbox.invoiceRows(2026).length, 7, 'year selection must retain every invoice');
controls['invoice-number-filter'] = { value: 'HS-2026-001' };
assert.equal(sandbox.invoiceRows().length, 1, 'historical invoice number must be searchable');
controls['invoice-number-filter'] = { value: '' };
controls['invoice-status-filter'] = { value: 'CONFIRMED' };
assert.equal(sandbox.invoiceRows().length, 7, 'confirmed status must include historical records');
console.log('finance-history-invariant.test.cjs: OK');
