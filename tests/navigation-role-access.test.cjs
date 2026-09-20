const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

function tabButton(tab) {
  const re = new RegExp(
    '<button[^>]*class="([^"]*)"[^>]*data-tab="' + tab + '"[^>]*>',
    'i',
  );
  const match = html.match(re);
  assert.ok(match, 'Expected navigation button for tab: ' + tab);
  return { classes: match[1].split(/\\s+/).filter(Boolean), source: match[0] };
}

const sharedTabs = [
  'dashboard',
  'products',
  'sales',
  'restock',
  'history',
  'annual',
];

const adminOnlyTabs = [
  'accounts',
  'mail-accounts',
  'visitor-activity',
  'assistant-questions',
  'backups',
];

for (const tab of sharedTabs) {
  const button = tabButton(tab);
  assert.equal(
    button.classes.includes('admin-only'),
    false,
    tab + ' must remain available to viewer',
  );
}

for (const tab of adminOnlyTabs) {
  const button = tabButton(tab);
  assert.equal(
    button.classes.includes('admin-only'),
    true,
    tab + ' must remain admin-only',
  );
}

assert.match(
  css,
  /\.viewer-mode\s+\.admin-only\s*\{[^}]*display:\s*none\s*!important/i,
  'viewer mode must hide admin-only navigation and controls',
);

assert.match(
  html,
  /data-dash="andrey"/i,
  'Return to Andrey must remain reachable during navigation refactor',
);

assert.match(
  html,
  /href="\/reports"[^>]*>Analytics<\/a>/i,
  'Analytics reports must remain reachable before navigation migration',
);

const allTabMatches = [...html.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]);
assert.equal(
  new Set(allTabMatches).size,
  allTabMatches.length,
  'data-tab navigation IDs must be unique',
);

console.log('navigation-role-access.test.cjs: OK');
