const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes('<option value="Yandex Plus">Yandex Plus</option>')) {
  const typeMarker = '        <option value="Street">Street</option>\n        <option value="Прочее">Прочее</option>';
  const typeReplacement = '        <option value="Street">Street</option>\n        <option value="Yandex Plus">Yandex Plus</option>\n        <option value="Прочее">Прочее</option>';

  if (source.includes(typeMarker)) {
    source = source.replace(typeMarker, typeReplacement);
    changed = true;
  } else {
    console.warn('[admin] Yandex Plus category marker not found');
  }
}

if (!source.includes('<option value="12 месяцев">📅 12 месяцев</option>')) {
  const colorMarker = '        <option value="Золотой">✨ Золотой</option>';
  const colorReplacement = '        <option value="Золотой">✨ Золотой</option>\n        <option value="12 месяцев">📅 12 месяцев</option>';

  if (source.includes(colorMarker)) {
    source = source.replace(colorMarker, colorReplacement);
    changed = true;
  } else {
    console.warn('[admin] 12-month option marker not found');
  }
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[admin] Yandex Plus admin options enabled');
}
