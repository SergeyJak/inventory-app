const assert = require('node:assert/strict');
const fixes = require('../assistant-audit-fixes.js');

for (const [question, locale] of [
  ['У неё Wi-Fi есть?', 'ru'],
  ['Мне нужна колонка с Wi-Fi', 'ru'],
  ['Does Alice have Wi-Fi?', 'en'],
  ['Vai ir Wi-Fi?', 'lv'],
]) {
  const result = fixes.wifiCapabilitiesResponse(question);
  assert.equal(result?.type, 'wifi_capabilities', question);
  assert.equal(result.locale, locale, question);
  assert.equal(result.faq.matched, true, question);
}
assert.equal(fixes.wifiCapabilitiesResponse('Для дома'), null);
assert.equal(fixes.wifiCapabilitiesResponse('Хочу Mini 3'), null);
console.log('Assistant Wi-Fi capability checks passed');
