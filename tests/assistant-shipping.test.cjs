const assert = require('node:assert/strict');
const fixes = require('../assistant-audit-fixes.js');
const options = { models: () => [], knownModels: () => [], contactMethods: () => [] };
for (const [question, locale] of [
  ['Do you ship to Germany?', 'en'],
  ['Do you deliver to Sweden?', 'en'],
  ['Есть доставка в Германию?', 'ru'],
  ['Отправляете в Англию?', 'ru'],
  ['Vai ir piegāde uz Vāciju?', 'lv'],
  ['Can you deliver to Korinthos, Greece?', 'en'],
]) {
  const response = fixes.internationalShippingResponse(question, options);
  assert.equal(response?.type, 'international_shipping', question);
  assert.equal(response.locale, locale, question);
  assert.equal(response.faq.matched, true, question);
  assert.ok(response.text.length > 20, question);
}
assert.equal(fixes.internationalShippingResponse('Do you have a Mini 3?', options), null);
console.log('Assistant international shipping checks passed');
