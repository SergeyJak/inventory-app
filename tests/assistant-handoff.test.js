const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isHandoffRequest, handoffText } = require('../assistant-handoff');

test('recognizes observed Russian contact failures', () => {
  for (const input of ['Можно поговорить с реальным человеком?', 'Какой номер телефона?', 'Дайте WhatsApp контакт', 'Позвонить менеджеру']) {
    assert.equal(isHandoffRequest(input), true, input);
  }
});

test('recognizes English and Latvian contact requests', () => {
  for (const input of ['Can I speak to a human?', 'What is your phone number?', 'Vai varu sazināties ar operatoru?', 'Kāds ir tālrunis?']) {
    assert.equal(isHandoffRequest(input), true, input);
  }
});

test('does not misclassify product questions as contact requests', () => {
  for (const input of ['Для музыки', 'Есть ли голубая?', 'For a child', 'Alisa knows uzbek language?']) {
    assert.equal(isHandoffRequest(input), false, input);
  }
});

test('renders handoff in selected locale', () => {
  assert.match(handoffText('ru', ['WhatsApp']), /Свяжитесь/);
  assert.match(handoffText('en', ['WhatsApp']), /Contact us/);
  assert.match(handoffText('lv', ['WhatsApp']), /Sazinieties/);
  assert.match(handoffText('ru', ['WhatsApp']), /WhatsApp/);
});
