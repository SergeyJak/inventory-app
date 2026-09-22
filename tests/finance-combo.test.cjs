const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'finance-combo.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'scripts', 'enable-finance-routes.js'), 'utf8');
const invoice = fs.readFileSync(path.join(root, 'finance-invoice.js'), 'utf8');

assert.doesNotThrow(() => new vm.Script(source, { filename: 'finance-combo.js' }));
assert.match(source, /setup_subscription/, 'combined finance type must have a stable stored value');
assert.match(source, /Setup \+ Subscription/, 'combined finance type must have a readable UI label');
assert.match(invoice, /setup_subscription/, 'main invoice renderer must handle combined service');
assert.match(invoice, /Abonēšana \+ viedierīces uzstādīšana un konfigurēšana/, 'combined PDF must use the combined Latvian description');
assert.match(invoice, /Kopā/, 'combined PDF must keep one total');
assert.match(routes, /finance-combo\.js/, 'combined helper must be served and injected into finance page');
assert.equal(source.includes('amount / 2'), false, 'combined invoice must not invent a 50/50 price split');

console.log('finance-combo.test.cjs: OK');
