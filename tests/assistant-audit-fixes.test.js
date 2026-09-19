// PR preview smoke trigger
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

test('compares Latin model names and localizes the answer from the message language', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);

  const ru = engine.handle('Чем Mini 3 отличается от Midi?');
  assert.equal(ru.type, 'compare');
  assert.equal(ru.locale, 'ru');
  assert.equal(ru.intent, 'model_comparison');
  assert.deepEqual(ru.modelIds, ['mini3', 'midi']);
  assert.match(ru.text, /Станция Мини 3 \(140 €\)/);
  assert.match(ru.text, /Станция Миди \(сейчас нет в наличии\)/);
  assert.doesNotMatch(ru.text, /Станция Миди \(\d+ €\)/);
  assert.match(ru.text, /компакт/i);
  assert.match(ru.text, /крупнее/i);
  assert.match(ru.text, /мощнее/i);
  assert.match(ru.text, /бас/i);

  const en = engine.handle('Mini 3 vs Midi');
  assert.equal(en.type, 'compare');
  assert.equal(en.locale, 'en');
  assert.equal(en.intent, 'model_comparison');
  assert.deepEqual(en.modelIds, ['mini3', 'midi']);
  assert.match(en.text, /140 €/);
  assert.match(en.text, /currently out of stock/i);
  assert.doesNotMatch(en.text, /Midi \(\d+ €\)/i);
  assert.match(en.text, /compact/i);
  assert.match(en.text, /larger/i);
  assert.match(en.text, /powerful/i);
  assert.match(en.text, /bass/i);
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
  assert.equal(response.locale, 'en');
  assert.match(response.text, /do not have confirmed information/i);
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

test('detects English message language on the Russian storefront', () => {
  global.catalogPageLocale = 'ru';
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Does Alice understand English?');
  assert.equal(response.locale, 'en');
  assert.equal(response.type, 'language_unsupported');
  assert.match(response.text, /^No\./);
});

test('detects Russian message language on the English storefront', () => {
  global.catalogPageLocale = 'en';
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Дайте номер');
  assert.equal(response.locale, 'ru');
  assert.equal(response.type, 'human_handoff');
  assert.match(response.text, /Свяжитесь с нами напрямую/);
  global.catalogPageLocale = 'ru';
});

test('detects Latvian message language independently from page language', () => {
  global.catalogPageLocale = 'ru';
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Vai Alise atbalsta angļu valodu?');
  assert.equal(response.locale, 'lv');
  assert.equal(response.type, 'language_unsupported');
  assert.match(response.text, /^Nē\./);
});

test('generic European shipping question follows English message language', () => {
  global.catalogPageLocale = 'ru';
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Do you ship to Germany?');
  assert.equal(response.locale, 'en');
  assert.equal(response.type, 'international_shipping');
  assert.match(response.text, /Courier delivery across Europe is available/i);
  assert.doesNotMatch(response.text, /€20/);
});

test('long Greece order keeps Mini 3 Pro instead of matching shorter Mini 3 alias', () => {
  global.catalogPageLocale = 'ru';
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Hello! I would like to buy the Yandex Station Mini 3 Pro. Do you ship to Greece (Korinthos)? How much does shipping cost, approximately how long does delivery take, and when/how do I pay for the order? Thank you!');
  assert.equal(response.locale, 'en');
  assert.equal(response.type, 'international_shipping');
  assert.equal(response.modelId, 'miniPro');
  assert.equal(response.modelId, 'miniPro');
  assert.match(response.text, /€170/);
  assert.doesNotMatch(response.text, /Mini 3 is currently in stock for €140/i);
});

test('fallback remains unmatched for analytics', () => {
  const engine = global.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('совсем неизвестный вопрос');
  assert.equal(response.type, 'fallback');
  assert.equal(response.faq.matched, false);
  assert.equal(response.faq.faq, null);
});
