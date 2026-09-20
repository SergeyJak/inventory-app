const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const navigationSource = fs.readFileSync(path.join(root, 'navigation.js'), 'utf8');
const sharedNavigation = fs.readFileSync(path.join(root, 'shared-navigation.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const financeHtml = fs.readFileSync(path.join(root, 'finance.html'), 'utf8');
const reportsHtml = fs.readFileSync(path.join(root, 'reports.html'), 'utf8');
const reportsSource = fs.readFileSync(path.join(root, 'reports.js'), 'utf8');

const sandbox = { window: {} };
vm.runInNewContext(navigationSource, sandbox, { filename: 'navigation.js' });

const navigation = sandbox.window.InventoryNavigation;
assert.ok(navigation, 'navigation config must be exposed for the app');

const viewerItems = navigation.forRole('viewer').flatMap(group => group.items);
const adminItems = navigation.forRole('admin').flatMap(group => group.items);
const viewerIds = viewerItems.map(item => item.id);
const adminIds = adminItems.map(item => item.id);

const viewerExpected = [
  'dashboard',
  'products',
  'sales',
  'restock',
  'history',
  'annual',
  'reports',
  'andrey',
];

const adminOnly = [
  'accounts',
  'mail-accounts',
  'visitor-activity',
  'assistant-questions',
  'backups',
];

for (const id of viewerExpected) {
  assert.ok(viewerIds.includes(id), id + ' must remain available to viewer');
  assert.ok(adminIds.includes(id), id + ' must remain available to admin');
}

for (const id of adminOnly) {
  assert.equal(viewerIds.includes(id), false, id + ' must not be available to viewer');
  assert.ok(adminIds.includes(id), id + ' must remain available to admin');
}

assert.equal(
  new Set(adminIds).size,
  adminIds.length,
  'navigation IDs must be unique',
);

assert.match(html, /id="desktop-navigation"/i, 'desktop navigation shell must exist');
assert.match(html, /id="mobile-menu-button"/i, 'mobile header menu button must exist');
assert.match(html, /id="mobile-navigation-drawer"/i, 'mobile drawer shell must exist');
assert.doesNotMatch(html, /id="mobile-primary-navigation"/i, 'mobile bottom navigation must be removed');
assert.match(html, /<script src="navigation\.js"><\/script>/i, 'navigation config must load before app.js');
assert.match(
  server,
  /\['\/navigation\.js',\s*'navigation\.js'\]/,
  'server must expose navigation.js to inventory clients',
);
assert.match(server, /shared-navigation\.js/, 'server must expose shared navigation JS');
assert.match(server, /shared-navigation\.css/, 'server must expose shared navigation CSS');
assert.match(financeHtml, /shared-navigation\.js/, 'finance must load shared navigation');
assert.match(reportsHtml, /shared-navigation\.js/, 'reports must load shared navigation');
assert.match(financeHtml, /data-nav-id="finance"/, 'finance must identify its active navigation item');
assert.match(reportsHtml, /data-nav-id="reports"/, 'reports must identify its active navigation item');
assert.match(navigationSource, /href:\s*'\/analytics'/, 'Visitors navigation must open the analytics dashboard');
assert.match(reportsSource, /dataset\.navId\s*=\s*'visitor-activity'/, 'Visitors dashboard must identify its active navigation item');
assert.match(reportsSource, /mountSharedNavigation\?\.\(\)/, 'Visitors dashboard must remount shared navigation after rebuilding the body');
assert.match(sharedNavigation, /window\.mountSharedNavigation\s*=\s*mountSharedNavigation/, 'shared navigation must support remounting');
assert.match(sharedNavigation, /\/#\//, 'standalone navigation must link directly to Inventory hash routes');
assert.match(appSource, /history\.pushState\(/, 'inventory routing must write browser history');
assert.match(appSource, /restoreNavigationFromUrl\(/, 'inventory routing must restore navigation from URL');
assert.match(appSource, /window\.addEventListener\('popstate'/, 'Back/Forward must restore navigation');
assert.match(appSource, /window\.addEventListener\('hashchange'/, 'hash changes must restore navigation');
assert.match(appSource, /history\.replaceState\(\{ nav: 'dashboard' \}/, 'default route must be persisted on first load');
assert.match(html, /<body class="app-routing-pending">/, 'app must start hidden until route restoration');
assert.match(css, /body\.app-routing-pending \.app-main[\s\S]*visibility:\s*hidden/, 'main content must stay hidden while routing is pending');
assert.match(appSource, /classList\.remove\('app-routing-pending'\)/, 'app must reveal content after route restoration');

assert.doesNotMatch(
  html,
  /<nav class="tabs admin-nav"/i,
  'legacy horizontal admin navigation must be removed',
);

assert.doesNotMatch(
  html,
  /<header[\s\S]*?<a[^>]+href="\/reports"[^>]*>Analytics<\/a>[\s\S]*?<\/header>/i,
  'Analytics must not be duplicated in the header',
);

assert.match(
  css,
  /\.app-shell\s*\{[^}]*grid-template-columns:\s*240px\s+minmax\(0,\s*1fr\)/i,
  'desktop layout must include the sidebar column',
);

assert.match(
  css,
  /\.mobile-menu-button\s*\{/i,
  'mobile header menu button styles must exist',
);

assert.match(
  css,
  /\.mobile-nav-panel\s*\{[\s\S]*?transform:\s*translateX\(-105%\)/i,
  'mobile navigation must use an off-canvas left drawer',
);

assert.doesNotMatch(html, /class="dash-sub-tabs"/i, 'legacy Dashboard sub-tabs must be removed');
assert.doesNotMatch(html, /id="tab-visitor-activity"/i, 'legacy embedded Visitors screen must be removed');
assert.match(html, /data-account-view="hosts"/i, 'Hosts must remain available inside Accounts');

console.log('navigation-role-access.test.cjs: OK');

assert.match(reportsSource, /Chart\.getChart\(canvas\)\?\.destroy\(\)/, 'visitor charts must destroy the active canvas chart before redraw');

assert.doesNotMatch(reportsSource, /<header class="visitor-header">/, 'Visitors analytics must not render its own legacy header');
assert.match(reportsSource, /<section class="visitor-page-title">/, 'Visitors analytics must keep its page title inside shared shell content');

assert.doesNotMatch(sharedNavigation, /\}\}\s*\n\s*window\.mountSharedNavigation/, 'shared navigation wrapper must have valid closing braces');
assert.doesNotMatch(reportsSource, /visitor-user/, 'Visitors analytics must not reference removed legacy user element');
assert.doesNotMatch(reportsSource, /visitor-logout/, 'Visitors analytics must not reference removed legacy logout element');
