const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const finance = fs.readFileSync(path.join(root, 'finance.js'), 'utf8');

assert.match(server, /financeIncome:\s*'financeIncome'/, 'Finance income must have its own Mongo collection');
assert.match(server, /financeExpenses:\s*'financeExpenses'/, 'Finance expenses must have its own Mongo collection');
assert.match(server, /financeMigrations:\s*'financeMigrations'/, 'Finance migration must have a marker collection');
assert.match(server, /migrationBackup_20260920_subAccounts/, 'migration must back up subAccounts before copying finance data');
assert.match(server, /migrationBackup_20260920_hostSubscriptions/, 'migration must back up hostSubscriptions before copying finance data');
assert.match(server, /if \(!USE_MONGO \|\| !isProductionRailwayEnvironment\(\)\) return;/, 'migration must run only in production Mongo');
assert.match(server, /accountCountAfter !== accountCountBefore \|\| hostCountAfter !== hostCountBefore/, 'migration must verify account counts are unchanged');
assert.match(server, /migratedIncome !== income\.length \|\| migratedExpenses !== expenses\.length/, 'migration must verify all finance rows were copied');
assert.match(server, /app\.get\('\/api\/finance\/ledger'/, 'Finance must expose an independent ledger endpoint');
assert.match(server, /insertStandaloneFinance\('income'/, 'income writes must go to standalone Finance storage');
assert.match(server, /insertStandaloneFinance\('expense'/, 'expense writes must go to standalone Finance storage');
assert.doesNotMatch(server, /appendFinanceEntry\('subAccounts'/, 'income writes must not mutate subAccounts');
assert.doesNotMatch(server, /appendFinanceEntry\('hostSubscriptions'/, 'expense writes must not mutate hostSubscriptions');

assert.match(finance, /financeIncome:\s*\[\]/, 'Finance UI must keep income in independent state');
assert.match(finance, /financeExpenses:\s*\[\]/, 'Finance UI must keep expenses in independent state');
assert.match(finance, /api\('\/api\/finance\/ledger'\)/, 'Finance UI must load the independent ledger');
assert.match(finance, /state\.financeIncome\.map/, 'income rows must come from standalone Finance state');
assert.match(finance, /state\.financeExpenses\.map/, 'expense rows must come from standalone Finance state');

console.log('finance-standalone-storage.test.cjs: OK');
