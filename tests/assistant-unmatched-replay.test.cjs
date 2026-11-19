'use strict';

// Real unmatched HeySmart questions from inventory.assistantQuestions, anonymized.
// This replay is intentionally read-only: no production DB access or history mutations.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = {
  console: { info() {} },
  catalogPageLocale: 'ru',
  document: { documentElement: { lang: 'ru' } },
};
context.window = context;
vm.createContext(context);
for (const file of ['assistant-engine-core.js', 'assistant-handoff.js', 'assistant-audit-fixes.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const models = [
  { id: 'light2', title: 'Станция Лайт 2', price: 100, aliases: ['лайт 2', 'light 2', 'lite 2'] },
  { id: 'mini3', title: 'Станция Мини 3', price: 140, aliases: ['мини 3', 'mini 3'] },
  { id: 'miniPro', title: 'Станция Мини 3 Про', price: 180, aliases: ['мини 3 про', 'мини про', 'mini 3 pro', 'mini pro'] },
  { id: 'midi', title: 'Станция Миди', price: 210, aliases: ['миди', 'midi'] },
  { id: 'street', title: 'Станция Стрит', price: 190, aliases: ['стрит', 'street'] },
];
const faq = JSON.parse(fs.readFileSync(path.join(root, 'faq.json'), 'utf8'));
const translations = {
  'faq.fallback': 'Я пока не нашёл точный ответ.',
  'assistant.recommend': 'Рекомендую:',
  'assistantV2.clarifyPurpose': 'Для чего подбираем колонку?',
  'assistantV2.inStock': 'В наличии',
  'assistantV2.outOfStock': 'Нет в наличии',
  'assistantV2.availableAlternatives': 'Могу показать альтернативы.',
  'assistantV2.handoff': 'Свяжитесь с нами напрямую',
};
const options = {
  models: () => models,
  knownModels: () => models,
  modelText: (model, key) => model[key] || '',
  t: key => translations[key] || key,
  contactMethods: () => [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'telegram', label: 'Telegram' },
  ],
  findFaq: input => {
    const normalized = String(input).toLowerCase().trim();
    const match = faq.find(item => item.questions.some(question => question === normalized));
    return match
      ? { matched: true, confidence: 1, faq: match, answer: match.answer.ru }
      : { matched: false, confidence: 0, faq: null, answer: '' };
  },
};

// Exact historical question strings and expected route (including duplicates).
// Two responses intentionally remain unconfirmed rather than fabricate stock/intent.
const historical = [
  ['Какой впн?', 'vpn_setup', true],
  ['Сколько держит батарея', 'power_guidance', true],
  ['Как заряжать Алису?', 'power_guidance', true],
  ['Нужно ли заряжать Алису', 'power_guidance', true],
  ['Серёжа привет', 'greeting', true],
  ['я хочу 2 про', 'product_clarification', false],
  ['Аккумулятор продается?', 'accessory_clarification', false],
  ['Я хочу на вайфай', 'wifi_capabilities', true],
  ['Do you ship to Germany?', 'international_shipping', true],
  ['Does Alice understand English?', 'language_unsupported', true],
  ['Do you ship to Germany?', 'international_shipping', true],
  ['Do you ship to Greece?', 'international_shipping', true],
  ['Дайте номер', 'human_handoff', true],
  ['Можно поговорить с человеком?', 'human_handoff', true],
  ['Хочу поговорить с человеком', 'human_handoff', true],
  ['Мне нужен реальный человек', 'human_handoff', true],
  ['Телефон дайте', 'human_handoff', true],
  ['С человеком можно поговорить?', 'human_handoff', true],
  ['Дайте номер?', 'human_handoff', true],
  ['Можно поговорить с человеком?', 'human_handoff', true],
  ['Дайте номер', 'human_handoff', true],
  ['Хочу поговорить с человеком', 'human_handoff', true],
  ['Does, Alice understand engleesh?', 'language_unsupported', true],
  ['Alisa knows uzbek language?', 'language_uncertain', true],
  ['Для музыки', 'recommendation', true],
  ['дайте WhatsApp контакт', 'human_handoff', true],
  ['какой номер телефона?', 'human_handoff', true],
  ['можно поговорить с реальным человеком?', 'human_handoff', true],
];

test('replays all 28 historically unmatched messages without generic fallback', () => {
  assert.equal(historical.length, 28);
  for (const [question, expectedType, isResolved] of historical) {
    const engine = context.AssistantEngine.createAssistantEngine(options);
    if (question === 'я хочу 2 про') {
      engine.handle('Для дома');
      engine.handle('а 2 што для дома не подходит');
    }
    const response = engine.handle(question);
    assert.equal(response.type, expectedType, question);
    assert.equal(response.faq?.matched, isResolved, question);
    assert.ok(response.text && !/Я пока не нашёл точный ответ/.test(response.text), question);
    if (/^[A-Za-z]/.test(question)) assert.equal(response.locale, 'en', question);
  }
});

test('ambiguous 2 Pro follows previous recommendation and confirms quantity without inventing inventory', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  engine.handle('Для дома'); // asks purpose
  engine.handle('Для дома'); // follows up and recommends Mini 3 Pro
  const clarify = engine.handle('я хочу 2 про');
  assert.equal(clarify.type, 'product_clarification');
  assert.match(clarify.text, /Ранее мы обсуждали Мини 3 Про/);
  assert.equal(clarify.faq.matched, false);
  const confirmed = engine.handle('две');
  assert.equal(confirmed.type, 'quantity_handoff');
  assert.equal(confirmed.modelId, 'miniPro');
  assert.match(confirmed.text, /наличие именно двух штук необходимо подтвердить/i);
  assert.deepEqual(Array.from(confirmed.actions, action => action.channel), ['whatsapp', 'telegram']);
  engine.reset();
  assert.notEqual(engine.handle('две').type, 'quantity_handoff');
});

test('explicit purchase of two Mini 3 Pro units routes to human for stock verification', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Хочу 2 мини 3 про');
  assert.equal(response.type, 'quantity_handoff');
  assert.equal(response.modelId, 'miniPro');
  assert.doesNotMatch(response.text, /две штуки есть в наличии/i);
});

test('separate battery question never asserts unverified stock', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('Аккумулятор продается?');
  assert.equal(response.type, 'accessory_clarification');
  assert.equal(response.faq.matched, false);
  assert.match(response.text, /наличие отдельного аккумулятора пока не подтверждено/i);
  assert.deepEqual(Array.from(response.actions, action => action.channel), ['whatsapp', 'telegram']);
  assert.notEqual(engine.handle('У Стрит есть аккумулятор?').type, 'accessory_clarification');
});

test('Wi-Fi conversational phrasing and English typo remain supported', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  assert.equal(engine.handle('Я хочу на вайфай').type, 'wifi_capabilities');
  const english = engine.handle('Does, Alice understand engleesh?');
  assert.equal(english.type, 'language_unsupported');
  assert.equal(english.locale, 'en');
});


test('power answers distinguish built-in, optional and mains-only batteries', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  const generic = engine.handle('Сколько держит батарея');
  assert.equal(generic.type, 'power_guidance');
  assert.match(generic.text, /Стрит.*до 12 часов/);
  assert.match(generic.text, /Мини 3 Про.*до 7 часов/);
  assert.match(generic.text, /Лайт 2, Мини 3 и Миди/);

  const street = engine.handle('Как заряжать Стрит?');
  assert.match(street.text, /USB-C/);
  assert.match(street.text, /2,5 часа/);

  const mini = engine.handle('Нужно ли заряжать Мини 3?');
  assert.match(mini.text, /работает от розетки/);
  assert.doesNotMatch(mini.text, /до 7 часов/);

  const pro = engine.handle('Сколько держит батарея Мини 3 Про?');
  assert.match(pro.text, /отдельно приобретаемым/);
  assert.match(pro.text, /до 7 часов/);
});

test('battery questions follow the recommended model in the same conversation', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  const selected = engine.handle('Для музыки');
  assert.equal(selected.modelId, 'miniPro');
  const reply = engine.handle('Нужно ли заряжать Алису');
  assert.equal(reply.type, 'power_guidance');
  assert.match(reply.text, /Мини 3 Про/);
  assert.match(reply.text, /от розетки/);
});

test('VPN, greeting and English battery questions use a helpful language-aware route', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  const vpn = engine.handle('Какой впн?');
  assert.equal(vpn.type, 'vpn_setup');
  assert.match(vpn.text, /российским IP-адресом/);
  assert.deepEqual(Array.from(vpn.actions, action => action.channel), ['whatsapp', 'telegram']);
  assert.equal(engine.handle('Серёжа привет').type, 'greeting');
  assert.equal(engine.handle('Привет, есть доставка в Грецию?').type, 'international_shipping');
  const en = engine.handle('How long does Street battery last?');
  assert.equal(en.type, 'power_guidance');
  assert.equal(en.locale, 'en');
  assert.match(en.text, /12 hours/);
  const lv = engine.handle('Vai Street jāuzlādē?');
  assert.equal(lv.locale, 'lv');
  assert.equal(lv.type, 'power_guidance');
  assert.match(lv.text, /USB-C/);
});

test('unconfirmed separate battery stock is never invented', () => {
  const engine = context.AssistantEngine.createAssistantEngine(options);
  const response = engine.handle('У вас продается аккумулятор для Мини 3 Про?');
  assert.equal(response.type, 'accessory_clarification');
  assert.equal(response.faq.matched, false);
  assert.doesNotMatch(response.text, /есть в наличии/);
});
