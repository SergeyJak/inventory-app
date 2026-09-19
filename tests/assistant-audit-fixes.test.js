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

// Mirrors production: only in-stock models are exposed by models(); aliases and unavailable models live in knownModels().
const liveModels = [
  { id: 'mini3', price: 140, title: 'Станция Мини 3', short: 'Мини 3', line: 'Компактная модель с LED-дисплеем.' },
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

test('compares Latin model names and labels an unavailable model instead of inventing a price', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  for (const input of ['Чем Mini 3 отличается от Midi?', 'Mini 3 vs Midi']) {
    const response = engine.handle(input);
    assert.equal(response.type, 'compare', input);
    assert.equal(response.intent, 'model_comparison', input);
    assert.deepEqual(response.modelIds, ['mini3', 'midi'], input);
    assert.match(response.text, /Станция Мини 3 \(140 €\)/);
    assert.match(response.text, /Станция Миди \(сейчас нет в наличии\)/);
    assert.doesNotMatch(response.text, /Станция Миди \(\d+ €\)/);
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
  assert.match(response.text, /сейчас нет в наличии/);
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

test('answers English support questions explicitly and in English on the English storefront', () => {
  global.catalogPageLocale = 'en';
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Does Alice understand English?');
  assert.equal(response.type, 'language_unsupported');
  assert.equal(response.intent, 'faq_question');
  assert.match(response.text, /does not support English/i);
  assert.match(response.text, /works in Russian/i);
  assert.equal(response.faq.faq, null);
  global.catalogPageLocale = 'ru';
});

test('handles the audited Greece purchase question as international shipping, not conversation end', () => {
  global.catalogPageLocale = 'en';
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const input = 'Hello! I would like to buy the Yandex Station Mini 3 Pro. Do you ship to Greece (Korinthos)? How much does shipping cost, approximately how long does delivery take, and when/how do I pay for the order? Thank you!';
  const response = engine.handle(input);
  assert.equal(response.type, 'international_shipping');
  assert.equal(response.intent, 'international_shipping');
  assert.equal(response.modelId, 'miniPro');
  assert.match(response.text, /€170/);
  assert.match(response.text, /Greece/i);
  assert.match(response.text, /Korinthos/i);
  assert.match(response.text, /€20/);
  assert.match(response.text, /Revolut/i);
  assert.match(response.text, /confirm the delivery time/i);
  assert.match(response.text, /does not support English/i);
  assert.doesNotMatch(response.text, /^Thanks\.?$/i);
  assert.deepEqual(response.actions.map(action => action.channel), ['whatsapp', 'telegram']);
  global.catalogPageLocale = 'ru';
});

test('fallback remains unmatched for analytics', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('совсем неизвестный вопрос');
  assert.equal(response.type, 'fallback');
  assert.equal(response.faq.matched, false);
  assert.equal(response.faq.faq, null);
});
