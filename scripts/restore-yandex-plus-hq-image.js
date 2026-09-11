const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourcePath = path.join(__dirname, 'yandex-plus-hq', 'part-01.b64');
const targetPath = path.join(root, 'images', 'catalog', 'yandex-plus', '12-months.jpg');

const encoded = fs.readFileSync(sourcePath, 'utf8').replace(/\s+/g, '');
const image = Buffer.from(encoded, 'base64');

if (image.length < 30000) {
  throw new Error(`[yandex-plus-image] HQ image is unexpectedly small: ${image.length} bytes`);
}
if (image[0] !== 0xff || image[1] !== 0xd8 || image.at(-2) !== 0xff || image.at(-1) !== 0xd9) {
  throw new Error('[yandex-plus-image] invalid JPEG markers');
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, image);
console.log(`[yandex-plus-image] restored HQ JPEG (${image.length} bytes)`);
