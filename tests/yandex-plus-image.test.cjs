const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'scripts', 'yandex-plus-hq');
const parts = fs.readdirSync(sourceDir)
  .filter(name => /^part-\d+\.b64$/.test(name))
  .sort();

assert.strictEqual(parts.length, 7, `Expected 7 Yandex Plus image parts, found ${parts.length}`);

const encoded = parts
  .map(name => fs.readFileSync(path.join(sourceDir, name), 'utf8'))
  .join('')
  .replace(/\s+/g, '');
const image = Buffer.from(encoded, 'base64');

assert.strictEqual(image.length, 39624, `Unexpected Yandex Plus promo JPEG size: ${image.length} bytes`);
assert.strictEqual(image[0], 0xff, 'JPEG SOI byte 1 is invalid');
assert.strictEqual(image[1], 0xd8, 'JPEG SOI byte 2 is invalid');
assert.strictEqual(image.at(-2), 0xff, 'JPEG EOI byte 1 is invalid');
assert.strictEqual(image.at(-1), 0xd9, 'JPEG EOI byte 2 is invalid');

console.log(`Yandex Plus promo image integrity OK: ${image.length} bytes`);
