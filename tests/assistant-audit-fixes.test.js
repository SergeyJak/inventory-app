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
        if (/Mini 3|Миди/i.test(input)) return { type: 'model', modelId: 'mini3', text: 'Станция Мини 3.' };
        return { type: 'fallback', text: 'fallback' };
      },
      snapshot() { return { selectedScenario: scenario }; },
      reset() {},
    };
  },
};

const fixes = require('../assistant-audit-fixes');
fixes.install();

// Mirrors production: live catalog models contain price/copy but aliases live in PHOTO_MODELS/knownModels.
const liveModels = [
  { id: 'mini3', price: 140, title: 'Станция Мини 3', short: 'Мини 3', line: 'Компактная модель с LED-дисплеем.' },
  { id: 'midi', price: 200, title: 'Станция Миди', short: 'Миди', line: 'Более мощная модель для музыки.' },
  { id: 'miniPro', price: 170, title: 'Мини 3 Про', short: 'Мини 3 Про', line: 'Модель Pro.' },
];
const knownModels = [
  { id: 'mini3', aliases: ['мини 3', 'mini 3'], title: 'Станция Мини 3', short: 'Мини 3' },
  { id: 'midi', aliases: ['миди', 'midi'], title: 'Станция Миди', short: 'Миди' },
  { id: 'miniPro', aliases: ['мини 3 про', 'mini 3 pro'], title: 'Мини 3 Про', short: 'Мини 3 Про' },
];

const options = {
  models: () => liveModels,
  knownModels: () => knownModels,
  modelText: (model, key) => model[key] || '',
  t: key => key === 'assistant.recommend' ? 'Рекомендую:' : key,
  contactMethods: () => [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'phone', label: '+37126198525' },
  ],
};

test('routes audited Russian handoff requests to WhatsApp and Telegram only', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  for (const input of ['Можно поговорить с реальным человеком?', 'Какой номер телефона?', 'Дайте WhatsApp контакт', 'Позвонить менеджеру']) {
    const response = engine.handle(input);
    assert.equal(response.type, 'human_handoff', input);
    assert.equal(response.intent, 'human_handoff', input);
    assert.match(response.text, /WhatsApp/);
    assert.match(response.text, /Telegram/);
    assert.doesNotMatch(response.text, /37126198525/);
    assert.deepEqual(response.actions.map(action => action.channel), ['whatsapp', 'telegram']);
    assert.equal(response.faq.faq, null);
  }
});

test('compares Latin model names when production live models do not contain aliases', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  for (const input of ['Чем Mini 3 отличается от Midi?', 'Mini 3 vs Midi']) {
    const response = engine.handle(input);
    assert.equal(response.type, 'compare', input);
    assert.equal(response.intent, 'model_comparison', input);
    assert.deepEqual(response.modelIds, ['mini3', 'midi'], input);
    assert.match(response.text, /Станция Мини 3/);
    assert.match(response.text, /Станция Миди/);
    assert.match(response.text, /140 €/);
    assert.match(response.text, /200 €/);
    assert.match(response.text, /компакт/i);
    assert.match(response.text, /крупнее/i);
    assert.match(response.text, /мощнее/i);
    assert.match(response.text, /бас/i);
  }
});

test('compares Cyrillic model names too', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Сравни Мини 3 и Миди');
  assert.equal(response.type, 'compare');
  assert.deepEqual(response.modelIds, ['mini3', 'midi']);
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
