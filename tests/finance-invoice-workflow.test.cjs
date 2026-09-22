const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const finance = fs.readFileSync(path.join(root, 'finance.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'finance.html'), 'utf8');

assert.doesNotThrow(() => new vm.Script(finance, { filename: 'finance.js' }));

assert.match(server, /financeInvoices:\s*'financeInvoices'/, 'invoices must have a dedicated Mongo collection');
assert.match(server, /financeInvoiceCounters:\s*'financeInvoiceCounters'/, 'invoice sequence must have a dedicated server-side counter');
assert.match(server, /uniq_finance_draft_invoice_no/, 'invoice numbers must be unique in Mongo');
assert.match(server, /async function allocateInvoiceNumber\(year\)/, 'server must allocate invoice numbers');
assert.match(server, /\$inc:\s*\{ seq: 1 \}/, 'Mongo counter increment must be atomic');
assert.match(server, /currentInvoiceSequence\(numericYear\)/, 'counter must start above historical invoice numbers');
assert.match(server, /db\.collection\(COLL\.financeIncome\)/, 'preview numbering must also read production income numbers');
assert.match(server, /db\.collection\(COLL\.financeInvoices\)/, 'preview numbering must also read production invoice numbers');
assert.match(server, /status:\s*'DRAFT'/, 'new invoices must start as DRAFT');
assert.match(server, /status:\s*'CONFIRMED'/, 'confirm must transition the invoice');
assert.match(server, /status:\s*'VOID'/, 'decline must void rather than delete the invoice');
assert.match(server, /app\.post\('\/api\/finance\/invoices\/draft'/, 'draft endpoint must exist');
assert.match(server, /app\.post\('\/api\/finance\/invoices\/:invoiceId\/confirm'/, 'confirm endpoint must exist');
assert.match(server, /app\.post\('\/api\/finance\/invoices\/:invoiceId\/decline'/, 'decline endpoint must exist');
assert.match(server, /invoiceId:\s*invoice\.id/, 'confirmed ledger entry must reference the source invoice');
assert.match(server, /sellerSnapshot:\s*seller/, 'draft must freeze seller details');
assert.match(server, /customerEmailSnapshot:\s*owner\.email/, 'draft must freeze customer email');
assert.doesNotMatch(server, /deleteOne\([^\n]*financeInvoices/, 'invoices must never be hard deleted');

assert.match(finance, /financeInvoices:\s*\[\]/, 'UI must keep invoice records separate from ledger income');
assert.match(finance, /\/api\/finance\/invoices\/draft/, 'issuing must create a draft on the server');
assert.match(finance, /data-invoice-action="confirm"/, 'draft row must expose Confirm');
assert.match(finance, /data-invoice-action="decline"/, 'draft row must expose Decline');
assert.match(finance, /data-invoice-action="pdf"/, 'every invoice row must expose PDF');
assert.match(finance, /window\.generateFinanceInvoicePdf\(invoice\)/, 'reprint must render the saved invoice record');
assert.doesNotMatch(finance, /function nextInvoiceNumber\(/, 'browser must not calculate invoice numbers anymore');
assert.doesNotMatch(finance, /\/api\/finance\/income[\s\S]{0,250}addIncome/, 'invoice form must not directly write income');

assert.match(html, />Выписать счёт</, 'invoice form must have one issue action');
assert.match(html, /id="invoice-tbody"/, 'invoice list must be shown separately from ledger');

console.log('finance-invoice-workflow.test.cjs: OK');
