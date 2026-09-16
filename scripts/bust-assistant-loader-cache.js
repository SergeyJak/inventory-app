'use strict';

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'catalog.html');
const legacyLoaderTag = '<script src="/assistant-engine.js?v=20260624-v21"></script>';
const cachedLoaderTag = '<script src="/assistant-engine.js?v=20260916-runtime3"></script>';
const previousRuntimeTags = [
  '<script src="/assistant-handoff.js?v=20260916-runtime4"></script>',
  '<script src="/assistant-engine-core.js?v=20260916-runtime4"></script>',
  '<script src="/assistant-audit-fixes.js?v=20260916-runtime4"></script>',
].join('\n  ');
const directRuntimeTags = [
  '<script src="/assistant-handoff.js?v=20260916-runtime5"></script>',
  '<script src="/assistant-engine-core.js?v=20260916-runtime5"></script>',
  '<script src="/assistant-audit-fixes.js?v=20260916-runtime5"></script>',
  '<script src="/assistant-comparison-fixes.js?v=20260916-runtime5"></script>',
].join('\n  ');

const catalog = fs.readFileSync(catalogPath, 'utf8');

if (catalog.includes(directRuntimeTags)) {
  console.log('[assistant-runtime] runtime5 scripts already configured');
  process.exit(0);
}

const sourceTag = catalog.includes(previousRuntimeTags)
  ? previousRuntimeTags
  : catalog.includes(cachedLoaderTag)
    ? cachedLoaderTag
    : catalog.includes(legacyLoaderTag)
      ? legacyLoaderTag
      : '';

if (!sourceTag) {
  throw new Error('[assistant-runtime] expected assistant runtime tags not found');
}

const updated = catalog.replace(sourceTag, directRuntimeTags);
fs.writeFileSync(catalogPath, updated, 'utf8');
console.log('[assistant-runtime] upgraded direct runtime scripts to runtime5');
