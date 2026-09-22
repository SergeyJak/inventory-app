const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'finance.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'finance.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'scripts', 'enable-finance-routes.js'), 'utf8');

assert.doesNotThrow(() => new vm.Script(js, { filename: 'finance.js' }));

assert.match(html, /href="\/finance\/invoices"/, 'main Finance page must link to invoice history');
assert.match(html, /href="\/finance\/transactions"/, 'main Finance page must link to transaction history');
assert.match(html, /id="invoice-date-from"/, 'invoice history must filter from date');
assert.match(html, /id="invoice-date-to"/, 'invoice history must filter to date');
assert.match(html, /id="invoice-number-filter"/, 'invoice history must filter by invoice number');
assert.match(html, /id="invoice-status-filter"/, 'invoice history must filter by status');
assert.match(html, /id="ledger-date-from"/, 'transaction history must filter from date');
assert.match(html, /id="ledger-date-to"/, 'transaction history must filter to date');
assert.match(html, /id="ledger-number-filter"/, 'transaction history must filter by invoice/document number');
assert.match(html, /id="ledger-kind"/, 'transaction history must filter income vs expense');
assert.match(html, /id="invoice-prev"/, 'invoice history must have previous-page control');
assert.match(html, /id="invoice-next"/, 'invoice history must have next-page control');
assert.match(html, /id="ledger-prev"/, 'transaction history must have previous-page control');
assert.match(html, /id="ledger-next"/, 'transaction history must have next-page control');

assert.match(js, /const PAGE_SIZE = 25;/, 'history pagination must use a fixed page size');
assert.match(js, /location\.pathname === '\/finance\/invoices'/, 'invoice subpage mode must be detected');
assert.match(js, /location\.pathname === '\/finance\/transactions'/, 'transaction subpage mode must be detected');
assert.match(js, /rows\.slice\(start, start \+ PAGE_SIZE\)/, 'pagination must slice visible rows');
assert.match(js, /invoice-number-filter/, 'invoice number filter must be applied');
assert.match(js, /ledger-number-filter/, 'ledger number filter must be applied');
assert.match(js, /invoice\.date \|\| ''\) >= from/, 'invoice date-from filter must be applied');
assert.match(js, /invoice\.date \|\| ''\) <= to/, 'invoice date-to filter must be applied');
assert.match(js, /row\.date \|\| ''\) >= from/, 'transaction date-from filter must be applied');
assert.match(js, /row\.date \|\| ''\) <= to/, 'transaction date-to filter must be applied');
assert.match(js, /serviceRows\(pageMode === 'transactions' \? null : state\.servicesYear\)/, 'transaction subpage filters must span all years');

assert.match(routes, /\['\/finance\/invoices', 'finance\.html'\]/, 'invoice history route must be served');
assert.match(routes, /\['\/finance\/transactions', 'finance\.html'\]/, 'transaction history route must be served');

console.log('finance-history-pages.test.cjs: OK');
