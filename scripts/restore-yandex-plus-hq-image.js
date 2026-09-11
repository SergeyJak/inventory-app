const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = path.join(__dirname, 'yandex-plus-hq');
const targetPath = path.join(root, 'images', 'catalog', 'yandex-plus', '12-months.jpg');

const parts = fs.readdirSync(sourceDir)
  .filter(name => /^part-\d+\.b64$/.test(name))
  .sort();

if (parts.length !== 7) {
  throw new Error(`[yandex-plus-image] expected 7 image parts, found ${parts.length}`);
}

const encoded = parts
  .map(name => fs.readFileSync(path.join(sourceDir, name), 'utf8'))
  .join('')
  .replace(/\s+/g, '');
const image = Buffer.from(encoded, 'base64');

if (image.length !== 39624) {
  throw new Error(`[yandex-plus-image] unexpected HQ image size: ${image.length} bytes`);
}
if (image[0] !== 0xff || image[1] !== 0xd8 || image.at(-2) !== 0xff || image.at(-1) !== 0xd9) {
  throw new Error('[yandex-plus-image] invalid JPEG markers');
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, image);
console.log(`[yandex-plus-image] restored HQ JPEG (${image.length} bytes)`);
