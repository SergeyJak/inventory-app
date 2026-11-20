const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('catalog.html');
const script = read('catalog-motion.js');
const css = read('catalog-motion.css');
const server = read('server.js');

assert.doesNotThrow(() => new vm.Script(script), 'Motion script must parse');
for (const id of ['morning', 'music', 'home', 'travel']) {
  assert.match(html, new RegExp('data-living-scene="' + id + '"'));
  assert.match(script, new RegExp('id: \'' + id + '\''));
}
for (const pathToAsset of [
  'images/catalog/light-2/blue/01.webp',
  'images/catalog/mini-3/gray/01.webp',
  'images/catalog/mini-pro/green/01.webp',
  'images/catalog/street/black/01.webp',
]) assert.ok(fs.existsSync(path.join(root, pathToAsset)), pathToAsset + ' must exist');

assert.match(html, /id="living-scenes"/);
assert.match(html, /id="living-pause"/);
assert.match(html, /id="living-status" aria-live="polite"/);
assert.match(html, /catalog-motion\.js\?v=/);
assert.match(html, /catalog-motion\.css\?v=/);
assert.match(server, /'\/catalog-motion\.css', '\/catalog-motion\.js'/);
assert.match(script, /heysmartLiveProductsVerified !== true/, 'Unknown stock must not produce buy links');
assert.match(script, /heysmart:catalog-products/, 'Future stock updates are used');
assert.match(script, /prefers-reduced-motion: reduce/, 'Reduced-motion preference is respected');
assert.match(script, /document\.hidden/, 'Animation pauses when the tab is hidden');
assert.match(script, /IntersectionObserver/, 'Only animate the scene when visible');
assert.match(css, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(script, /fetch\(/, 'Motion uses catalog stock state instead of duplicating API requests');

console.log('Living catalogue assets, responsive progressive enhancements and inventory guards passed.');
