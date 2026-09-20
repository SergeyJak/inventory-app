const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const finance = fs.readFileSync(path.join(root, 'finance.js'), 'utf8');

assert.match(server, /financeIncome:\s*'financeIncome'/, 'Finance income must have its own Mongo collection');
assert.match(server, /financeExpenses:\s*'financeExpenses'/, 'Finance expenses must have its own Mongo collection');
assert.match(server, /financeAudit:\s*'financeAudit'/, 'Finance audit must have its own Mongo collection');
assert.match(server, /financeMigrations:\s*'financeMigrations'/, 'Finance migration must have a marker collection');
assert.match(server, /GENERIC_SAVE_BLOCKED_KEYS = new Set\(\['financeIncome', 'financeExpenses', 'financeAudit', 'financeMigrations'\]\)/, 'generic save must be blocked for Finance collections');
assert.match(server, /Protected collection: use dedicated API/, 'generic API save must reject protected Finance collections');
assert.match(server, /migrationBackup_20260920_subAccounts/, 'migration must back up subAccounts before copying finance data');
assert.match(server, /migrationBackup_20260920_hostSubscriptions/, 'migration must back up hostSubscriptions before copying finance data');
assert.match(server, /financeIncome__inventory-app-pr-24/, 'production migration must include the restored PR Finance income recovery source');
assert.match(server, /financeExpenses__inventory-app-pr-24/, 'production migration must include the restored PR Finance expense recovery source');
assert.match(server, /mergeFinanceMigrationRows\('income', embedded\.income, recoveryIncome\)/, 'migration must merge embedded and restored income rows');
assert.match(server, /mergeFinanceMigrationRows\('expense', embedded\.expenses, recoveryExpenses\)/, 'migration must merge embedded and restored expense rows');
assert.match(server, /if \(!USE_MONGO \|\| !isProductionRailwayEnvironment\(\)\) return;/, 'migration must run only in production Mongo');
assert.match(server, /accountCountAfter !== accountCountBefore \|\| hostCountAfter !== hostCountBefore/, 'migration must verify account counts are unchanged');
assert.match(server, /migratedIncome !== income\.length \|\| migratedExpenses !== expenses\.length/, 'migration must verify all finance rows were copied');
assert.match(server, /app\.get\('\/api\/finance\/ledger'/, 'Finance must expose an independent ledger endpoint');
assert.match(server, /createIndex\(\{ id: 1 \}, \{ unique: true, name: 'uniq_finance_income_id' \}\)/, 'income ids must be unique at Mongo level');
assert.match(server, /createIndex\(\{ invoiceNo: 1 \}, \{ unique: true, sparse: true, name: 'uniq_finance_invoice_no' \}\)/, 'invoice numbers must be unique at Mongo level');
assert.match(server, /createIndex\(\{ id: 1 \}, \{ unique: true, name: 'uniq_finance_expense_id' \}\)/, 'expense ids must be unique at Mongo level');
assert.match(server, /writeFinanceAudit\('created'/, 'Finance creates must be audited');
assert.match(server, /writeFinanceAudit\('voided'/, 'Finance voids must be audited');
assert.match(server, /voidedAt/, 'Finance delete must be implemented as a soft void');
assert.doesNotMatch(server, /db\.collection\(financeCollectionName\(collectionKey\)\)\.deleteOne/, 'Finance entries must never be hard-deleted');
assert.match(server, /insertStandaloneFinance\('income'/, 'income writes must go to standalone Finance storage');
assert.match(server, /insertStandaloneFinance\('expense'/, 'expense writes must go to standalone Finance storage');
assert.doesNotMatch(server, /appendFinanceEntry\('subAccounts'/, 'income writes must not mutate subAccounts');
assert.doesNotMatch(server, /appendFinanceEntry\('hostSubscriptions'/, 'expense writes must not mutate hostSubscriptions');

assert.match(finance, /financeIncome:\s*\[\]/, 'Finance UI must keep income in independent state');
assert.match(finance, /financeExpenses:\s*\[\]/, 'Finance UI must keep expenses in independent state');
assert.match(finance, /api\('\/api\/finance\/ledger'\)/, 'Finance UI must load the independent ledger');
assert.match(finance, /state\.financeIncome\.map/, 'income rows must come from standalone Finance state');
assert.match(finance, /state\.financeExpenses\.map/, 'expense rows must come from standalone Finance state');
assert.match(finance, /function invoiceClientLabel\(sub\) \{\s*return sub\.email \|\| sub\.name \|\| sub\.tel \|\| sub\.id \|\| 'Client';\s*\}/, 'invoice recipient selector must prefer email over client name');
assert.match(finance, /data-email="\$\{esc\(sub\.email \|\| ''\)\}"/, 'invoice recipient option must carry an explicit email value');
assert.match(finance, /esc\(invoiceClientLabel\(sub\)\)/, 'invoice recipient dropdown must display the email-first label');

console.log('finance-standalone-storage.test.cjs: OK');
