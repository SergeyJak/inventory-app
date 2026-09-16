'use strict';

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'catalog.html');
const previousSrc = '/assistant-engine.js?v=20260624-v21';
const currentSrc = '/assistant-engine.js?v=20260916-runtime3';

const catalog = fs.readFileSync(catalogPath, 'utf8');

if (catalog.includes(currentSrc)) {
  console.log('[assistant-cache] loader URL already current');
  process.exit(0);
}

if (!catalog.includes(previousSrc)) {
  throw new Error(`[assistant-cache] expected loader URL not found: ${previousSrc}`);
}

const updated = catalog.replace(previousSrc, currentSrc);
fs.writeFileSync(catalogPath, updated, 'utf8');
console.log(`[assistant-cache] loader URL updated to ${currentSrc}`);
