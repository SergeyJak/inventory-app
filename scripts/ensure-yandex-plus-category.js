const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const source = fs.readFileSync(indexPath, 'utf8');

if (source.includes('<option value="Yandex Plus">Yandex Plus</option>')) {
  process.exit(0);
}

const marker = '        <option value="Street">Street</option>\n        <option value="Прочее">Прочее</option>';
const replacement = '        <option value="Street">Street</option>\n        <option value="Yandex Plus">Yandex Plus</option>\n        <option value="Прочее">Прочее</option>';

if (!source.includes(marker)) {
  console.warn('[admin] Yandex Plus category marker not found; index.html left unchanged');
  process.exit(0);
}

fs.writeFileSync(indexPath, source.replace(marker, replacement), 'utf8');
console.log('[admin] Yandex Plus category enabled');
