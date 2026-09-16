const assert = require('node:assert/strict');
const { test } = require('node:test');

const handoff = require('../assistant-handoff');
global.HeySmartAssistantHandoff = handoff;
global.catalogPageLocale = 'ru';

global.AssistantEngine = {
  createAssistantEngine(options) {
    let scenario = null;
    return {
      handle(input) {
        if (/music|музык/i.test(input)) {
          scenario = 'music';
          return { type: 'recommendation', modelId: 'miniPro', text: 'Рекомендую: Мини 3 Про. Если Миди доступна, она лучше.' };
        }
        if (/голуб/i.test(input)) return { type: 'color_unavailable', text: 'Голубого цвета нет.', colorKey: 'blue' };
        return { type: 'fallback', text: 'fallback' };
      },
      snapshot() { return { selectedScenario: scenario }; },
      reset() {},
    };
  },
};

const fixes = require('../assistant-audit-fixes');
fixes.install();

const options = {
  models: () => [{ id: 'miniPro', price: 170, title: 'Мини 3 Про' }],
  modelText: (model, key) => key === 'title' ? model.title : '',
  t: key => key === 'assistant.recommend' ? 'Рекомендую:' : key,
  contactMethods: () => [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'phone', label: '+37126198525' },
  ],
};

test('routes audited Russian handoff requests to real contact methods', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  for (const input of ['Можно поговорить с реальным человеком?', 'Какой номер телефона?', 'Дайте WhatsApp контакт', 'Позвонить менеджеру']) {
    const response = engine.handle(input);
    assert.equal(response.type, 'human_handoff', input);
    assert.equal(response.intent, 'human_handoff', input);
    assert.match(response.text, /WhatsApp/);
    assert.match(response.text, /\+37126198525/);
    assert.equal(response.faq.faq, null);
  }
});

test('does not attach an unrelated FAQ id to color answers', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Есть ли голубая?');
  assert.equal(response.type, 'color_unavailable');
  assert.equal(response.faq.matched, true);
  assert.equal(response.faq.faq, null);
});

test('keeps recommendation text consistent with the model actually selected', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Для музыки');
  assert.equal(response.modelId, 'miniPro');
  assert.match(response.text, /Мини 3 Про/);
  assert.doesNotMatch(response.text, /Миди/);
});

test('answers Uzbek support uncertainty without inventing support', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Alisa knows uzbek language?');
  assert.equal(response.type, 'language_uncertain');
  assert.match(response.text, /нет подтверждённой информации/i);
  assert.equal(response.faq.faq, null);
});

test('fallback remains unmatched for analytics', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('совсем неизвестный вопрос');
  assert.equal(response.type, 'fallback');
  assert.equal(response.faq.matched, false);
  assert.equal(response.faq.faq, null);
});
