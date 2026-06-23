const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('assistant-engine.js', 'utf8'), context);

const models = [
  { id: 'light2', price: 90, aliases: ['light 2', 'lite 2', 'лайт 2'], photos: [{ colorKey: 'blue' }] },
  { id: 'mini3', price: 140, aliases: ['mini 3', 'мини 3'], photos: [{ colorKey: 'gray' }] },
  { id: 'midi', price: 180, aliases: ['midi', 'миди'], photos: [{ colorKey: 'gray' }] },
];

const translations = {
  'assistant.recommend': 'Рекомендую:',
  'assistant.scenarios.child.reason': 'Для детской подходит компактная модель.',
  'assistant.scenarios.music.reason': 'Для музыки лучше модель с более мощным звуком.',
  'assistant.scenarios.home.reason': 'Для дома подойдёт модель для повседневных сценариев.',
  'assistant.scenarios.gift.reason': 'Для подарка лучше понятная универсальная модель.',
  'assistant.scenarios.music.label': 'Для музыки',
  'assistant.scenarios.home.label': 'Для дома',
  'assistant.scenarios.child.label': 'Для ребёнка',
  'assistant.scenarios.gift.label': 'В подарок',
  'assistantV2.showProduct': 'Показать в каталоге',
  'assistantV2.compare': 'Сравнить',
  'assistantV2.anotherOption': 'Ещё вариант',
  'assistantV2.back': 'Назад',
  'assistantV2.clarifyPurpose': 'Для чего подбираем колонку?',
  'assistantV2.cheaperLead': 'Можно посмотреть более доступный вариант:',
  'assistantV2.cheaperReason': 'Для базовых сценариев это хороший старт.',
  'assistantV2.colorAvailable': 'Да, такой цвет есть для',
  'assistantV2.colorUnavailable': 'Такого цвета сейчас нет у выбранной модели.',
  'assistantV2.compareAnswer': 'Лайт 2 — старт, Мини 3 — баланс, Миди — музыка.',
  'assistantV2.alternativeLead': 'Ещё можно посмотреть',
  'faq.fallback': 'Я пока не нашёл точный ответ.',
};

function modelText(model, key) {
  const data = {
    light2: { title: 'Станция Лайт 2', short: 'Лайт 2', line: 'Компактная модель для первого знакомства.' },
    mini3: { title: 'Станция Мини 3', short: 'Мини 3', line: 'Баланс размера и звука.' },
    midi: { title: 'Станция Миди', short: 'Миди', line: 'Более мощная модель для музыки.' },
  };
  return data[model.id][key] || '';
}

const engine = context.window.AssistantEngine.createAssistantEngine({
  models: () => models,
  t: key => translations[key] || key,
  modelText,
  findFaq: () => ({ matched: false, confidence: 0 }),
});

const steps = [
  ['Для ребёнка', 'light2'],
  ['А подешевле?', 'light2'],
  ['Теперь хочу для музыки', 'midi'],
  ['Для дома', 'mini3'],
  ['Миди', 'midi'],
  ['Ещё вариант', 'light2'],
  ['Назад', 'midi'],
  ['Light 2', 'light2'],
  ['Ещё вариант', 'mini3'],
  ['Mini 3', 'mini3'],
  ['Ещё вариант', 'light2'],
  ['Midi', 'midi'],
];

for (const [input, expectedModelId] of steps) {
  const response = engine.handle(input);
  assert.notStrictEqual(response.text, translations['faq.fallback'], `${input} returned fallback`);
  assert.strictEqual(response.modelId, expectedModelId, `${input} expected ${expectedModelId}, got ${response.modelId}`);
  assert(response.actions?.length, `${input} should include actions`);
}

for (const input of ['Показать в каталоге', 'Сравнить', 'Для музыки', 'Для дома', 'Для ребёнка', 'В подарок']) {
  const response = engine.handle(input);
  assert.notStrictEqual(response.text, translations['faq.fallback'], `${input} action label returned fallback`);
}

console.log('assistant engine v2 regression passed');
