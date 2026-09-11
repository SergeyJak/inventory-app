const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'scripts', 'yandex-plus-hq', 'part-01.b64');
const encoded = fs.readFileSync(sourcePath, 'utf8').replace(/\s+/g, '');
const image = Buffer.from(encoded, 'base64');

assert.ok(image.length > 30000, `Yandex Plus promo JPEG is too small: ${image.length} bytes`);
assert.strictEqual(image[0], 0xff, 'JPEG SOI byte 1 is invalid');
assert.strictEqual(image[1], 0xd8, 'JPEG SOI byte 2 is invalid');
assert.strictEqual(image.at(-2), 0xff, 'JPEG EOI byte 1 is invalid');
assert.strictEqual(image.at(-1), 0xd9, 'JPEG EOI byte 2 is invalid');

console.log(`Yandex Plus promo image integrity OK: ${image.length} bytes`);
