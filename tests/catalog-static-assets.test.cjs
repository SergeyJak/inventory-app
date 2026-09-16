const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('catalog static file allowlist includes all assistant engine dependencies', () => {
  const serverCode = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const assistantEngineCode = fs.readFileSync(path.join(root, 'assistant-engine.js'), 'utf8');

  // Extract the allowlist from app.get route
  const allowlistMatch = serverCode.match(/app\.get\(\[(.*?)\]\s*,\s*\(req,\s*res,\s*next\)\s*=>\s*\{[^}]*if\s*\(\s*isCatalogHost\(req\)\s*\|\|/);
  assert.ok(allowlistMatch, 'Could not find catalog static files route');

  const allowlistString = allowlistMatch[1];
  const allowedPaths = allowlistString.match(/'/g).length / 2;
  assert.ok(allowedPaths > 0, 'No paths found in allowlist');

  // Extract all script loads from assistant-engine.js using document.write
  const scriptLoads = assistantEngineCode.match(/document\.write\('<script src="([^"]+)"/g) || [];
  const dependencies = scriptLoads.map(load => {
    const match = load.match(/src="([^?]+)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  assert.ok(dependencies.length > 0, 'No script dependencies found in assistant-engine.js');

  // Verify each dependency is in the allowlist
  for (const dep of dependencies) {
    const depName = `'${dep}'`;
    assert.match(allowlistString, new RegExp(depName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 
      `Missing in allowlist: ${dep}`);
  }

  // Specifically verify the three critical dependencies
  const criticalDeps = [
    '/assistant-handoff.js',
    '/assistant-engine-core.js',
    '/assistant-audit-fixes.js'
  ];
  
  for (const dep of criticalDeps) {
    assert.match(allowlistString, new RegExp(`'${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`),
      `Critical dependency missing: ${dep}`);
  }
});

test('assistant-engine.js document.write loads match deployed files', () => {
  const assistantEngineCode = fs.readFileSync(path.join(root, 'assistant-engine.js'), 'utf8');
  
  // Extract dependency paths
  const scriptLoads = assistantEngineCode.match(/document\.write\('<script src="([^"]+)"/g) || [];
  const dependencies = scriptLoads.map(load => {
    const match = load.match(/src="([^?]+)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  // Verify files exist
  for (const dep of dependencies) {
    const filePath = path.join(root, dep.slice(1)); // Remove leading /
    assert.ok(fs.existsSync(filePath), `Dependency file not found: ${filePath}`);
  }
});

