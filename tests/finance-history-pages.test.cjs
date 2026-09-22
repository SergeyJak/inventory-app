const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'finance.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'finance.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'scripts', 'enable-finance-routes.js'), 'utf8');

assert.doesNotThrow(() => new vm.Script(js, { filename: 'finance.js' }));

assert.match(html, /data-history="invoices"/, 'Finance history must have an invoice tab');
assert.match(html, /data-history="ledger"/, 'Finance history must have an accounting tab');
assert.match(html, /id="history-invoices"/, 'invoice table must live inside the shared history block');
assert.match(html, /id="history-ledger"/, 'ledger table must live inside the shared history block');
assert.doesNotMatch(html, /href="\/finance\/invoices"/, 'invoice history must not use a separate page');
assert.doesNotMatch(html, /href="\/finance\/transactions"/, 'ledger history must not use a separate page');

assert.match(html, /id="invoice-date-from"/, 'invoice history must filter from date');
assert.match(html, /id="invoice-date-to"/, 'invoice history must filter to date');
assert.match(html, /id="invoice-number-filter"/, 'invoice history must filter by invoice number');
assert.match(html, /id="invoice-status-filter"/, 'invoice history must filter by status');
assert.match(html, /id="ledger-date-from"/, 'ledger must filter from date');
assert.match(html, /id="ledger-date-to"/, 'ledger must filter to date');
assert.match(html, /id="ledger-number-filter"/, 'ledger must filter by invoice/document number');
assert.match(html, /id="ledger-kind"/, 'ledger must filter income vs expense');
assert.match(html, /id="invoice-prev"/, 'invoice history must have previous-page control');
assert.match(html, /id="invoice-next"/, 'invoice history must have next-page control');
assert.match(html, /id="ledger-prev"/, 'ledger must have previous-page control');
assert.match(html, /id="ledger-next"/, 'ledger must have next-page control');

assert.match(js, /const PAGE_SIZE = 25;/, 'history pagination must use a fixed page size');
assert.match(js, /initialParams\.get\('history'\) === 'ledger'/, 'history tab must be restored from the URL');
assert.match(js, /function setHistoryView\(view, updateUrl = false\)/, 'history switcher must be centralized');
assert.match(js, /params\.set\('history', next\)/, 'selected history tab must persist in the URL');
assert.match(js, /rows\.slice\(start, start \+ PAGE_SIZE\)/, 'pagination must slice visible rows');
assert.match(js, /invoice-number-filter/, 'invoice number filter must be applied');
assert.match(js, /ledger-number-filter/, 'ledger number filter must be applied');
assert.match(js, /invoice\.date \|\| ''\) >= from/, 'invoice date-from filter must be applied');
assert.match(js, /invoice\.date \|\| ''\) <= to/, 'invoice date-to filter must be applied');
assert.match(js, /row\.date \|\| ''\) >= from/, 'ledger date-from filter must be applied');
assert.match(js, /row\.date \|\| ''\) <= to/, 'ledger date-to filter must be applied');
assert.match(js, /return serviceRows\(null\)/, 'history filters must span all years');

assert.doesNotMatch(routes, /\['\/finance\/invoices', 'finance\.html'\]/, 'invoice subpage route must be removed');
assert.doesNotMatch(routes, /\['\/finance\/transactions', 'finance\.html'\]/, 'ledger subpage route must be removed');

console.log('finance-history-pages.test.cjs: OK');
