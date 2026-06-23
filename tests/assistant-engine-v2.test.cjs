const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ru = (...codes) => String.fromCharCode(...codes);

const words = {
  childScenario: ru(1044,1083,1103,32,1088,1077,1073,1105,1085,1082,1072),
  cheaper: ru(1040,32,1087,1086,1076,1077,1096,1077,1074,1083,1077,63),
  musicSwitch: ru(1058,1077,1087,1077,1088,1100,32,1093,1086,1095,1091,32,1076,1083,1103,32,1084,1091,1079,1099,1082,1080),
  homeScenario: ru(1044,1083,1103,32,1076,1086,1084,1072),
  giftScenario: ru(1042,32,1087,1086,1076,1072,1088,1086,1082),
  another: ru(1045,1097,1105,32,1074,1072,1088,1080,1072,1085,1090),
  back: ru(1053,1072,1079,1072,1076),
  showProduct: ru(1055,1086,1082,1072,1079,1072,1090,1100,32,1074,32,1082,1072,1090,1072,1083,1086,1075,1077),
  compare: ru(1057,1088,1072,1074,1085,1080,1090,1100),
  stationTypo: ru(1082,1072,1083,1086,1085,1082,1072),
  alice: ru(1072,1083,1080,1089,1072),
  station: ru(1089,1090,1072,1085,1094,1080,1103),
  daughter: ru(1076,1083,1103,32,1076,1086,1095,1082,1080),
  music: ru(1076,1083,1103,32,1084,1091,1079,1099,1082,1080),
  latviaTypo: ru(1083,1072,1090,1074,1080,1077),
  delivery: ru(1076,1086,1089,1090,1072,1074,1082,1072),
  setup: ru(1085,1072,1089,1090,1088,1086,1081,1082,1072),
  unknown: ru(1087,1086,1095,1077,1084,1091,32,1085,1077,1073,1086,32,1082,1074,1072,1076,1088,1072,1090,1085,1086,1077),
  blueQuestion: ru(1045,1089,1090,1100,32,1089,1080,1085,1103,1103,63),
  redQuestion: ru(1045,1089,1090,1100,32,1082,1088,1072,1089,1085,1072,1103,63),
  blackQuestion: ru(1045,1089,1090,1100,32,1095,1105,1088,1085,1072,1103,63),
  wantSpeaker: ru(1061,1086,1095,1091,32,1082,1086,1083,1086,1085,1082,1091),
  budget100: ru(1044,1086,32,49,48,48,32,1077,1074,1088,1086),
};

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('assistant-engine.js', 'utf8'), context);

const models = [
  { id: 'light2', price: 90, aliases: ['light 2', 'lite 2', ru(1083,1072,1081,1090,32,50)], photos: [{ colorKey: 'blue' }, { colorKey: 'black' }] },
  { id: 'mini3', price: 140, aliases: ['mini 3', ru(1084,1080,1085,1080,32,51)], photos: [{ colorKey: 'gray' }] },
  { id: 'miniPro', price: 160, aliases: ['mini 3 pro', 'mini pro', ru(1084,1080,1085,1080,32,51,32,1087,1088,1086)], photos: [{ colorKey: 'green' }, { colorKey: 'blue' }, { colorKey: 'gray' }] },
  { id: 'midi', price: 180, aliases: ['midi', ru(1084,1080,1076,1080)], photos: [{ colorKey: 'gray' }] },
  { id: 'street', price: 160, aliases: ['street', ru(1089,1090,1088,1080,1090)], photos: [{ colorKey: 'green' }] },
];

const modelCopy = {
  ru: {
    light2: { title: ru(1057,1090,1072,1085,1094,1080,1103,32,1051,1072,1081,1090,32,50), short: ru(1051,1072,1081,1090,32,50), line: ru(1050,1086,1084,1087,1072,1082,1090,1085,1072,1103,32,1084,1086,1076,1077,1083,1100) },
    mini3: { title: ru(1057,1090,1072,1085,1094,1080,1103,32,1052,1080,1085,1080,32,51), short: ru(1052,1080,1085,1080,32,51), line: ru(1041,1072,1083,1072,1085,1089,32,1088,1072,1079,1084,1077,1088,1072,32,1080,32,1079,1074,1091,1082,1072) },
    miniPro: { title: ru(1057,1090,1072,1085,1094,1080,1103,32,1052,1080,1085,1080,32,51,32,1055,1088,1086), short: ru(1052,1080,1085,1080,32,51,32,1055,1088,1086), line: ru(1062,1077,1085,1090,1088,32,1091,1084,1085,1086,1075,1086,32,1076,1086,1084,1072) },
    midi: { title: ru(1057,1090,1072,1085,1094,1080,1103,32,1052,1080,1076,1080), short: ru(1052,1080,1076,1080), line: ru(1044,1083,1103,32,1084,1091,1079,1099,1082,1080,32,1080,32,1092,1080,1083,1100,1084,1086,1074) },
    street: { title: ru(1057,1090,1072,1085,1094,1080,1103,32,1057,1090,1088,1080,1090), short: ru(1057,1090,1088,1080,1090), line: ru(1055,1086,1088,1090,1072,1090,1080,1074,1085,1072,1103,32,1084,1086,1076,1077,1083,1100) },
  },
  en: {
    light2: { title: 'Station Lite 2', short: 'Lite 2', line: 'Compact first Station.' },
    mini3: { title: 'Station Mini 3', short: 'Mini 3', line: 'Balanced daily model.' },
    miniPro: { title: 'Station Mini 3 Pro', short: 'Mini 3 Pro', line: 'Smart home center.' },
    midi: { title: 'Station Midi', short: 'Midi', line: 'For music and movies.' },
    street: { title: 'Station Street', short: 'Street', line: 'Portable model.' },
  },
  lv: {
    light2: { title: 'Station Lite 2', short: 'Lite 2', line: 'Kompakts sākums.' },
    mini3: { title: 'Station Mini 3', short: 'Mini 3', line: 'Līdzsvarots ikdienai.' },
    miniPro: { title: 'Station Mini 3 Pro', short: 'Mini 3 Pro', line: 'Viedās mājas centrs.' },
    midi: { title: 'Station Midi', short: 'Midi', line: 'Mūzikai un filmām.' },
    street: { title: 'Station Street', short: 'Street', line: 'Pārnēsājams modelis.' },
  },
};

const translationSets = {
  ru: {
    'assistant.recommend': ru(1056,1077,1082,1086,1084,1077,1085,1076,1091,1102,58),
    'assistant.scenarios.child.reason': 'Для детской подходит компактная модель.',
    'assistant.scenarios.music.reason': 'Для музыки лучше модель с более мощным звуком.',
    'assistant.scenarios.home.reason': 'Для дома подойдёт модель для повседневных сценариев.',
    'assistant.scenarios.gift.reason': 'Для подарка лучше понятная универсальная модель.',
    'assistant.scenarios.music.label': words.music,
    'assistant.scenarios.home.label': words.homeScenario,
    'assistant.scenarios.child.label': words.childScenario,
    'assistant.scenarios.gift.label': words.giftScenario,
    'assistantV2.showProduct': words.showProduct,
    'assistantV2.compare': words.compare,
    'assistantV2.anotherOption': words.another,
    'assistantV2.back': words.back,
    'assistantV2.clarifyPurpose': 'Для чего подбираем колонку?',
    'assistantV2.cheaperLead': 'Можно посмотреть более доступный вариант:',
    'assistantV2.cheaperReason': 'Для базовых сценариев это хороший старт.',
    'assistantV2.colorAvailable': 'Да, такой цвет есть для',
    'assistantV2.colorUnavailable': 'Такого цвета сейчас нет у выбранной модели.',
    'assistantV2.compareAnswer': 'Лайт 2 — старт, Мини 3 — баланс, Миди — музыка.',
    'assistantV2.alternativeLead': 'Ещё можно посмотреть',
    'assistantV2.colors.blue': 'синий',
    'assistantV2.colors.red': 'красный',
    'assistantV2.colors.black': 'чёрный',
    'assistantV2.colors.white': 'белый',
    'assistantV2.colors.green': 'зелёный',
    'assistantV2.colors.violet': 'фиолетовый',
    'assistantV2.colors.beige': 'бежевый',
    'assistantV2.colors.gray': 'серый',
    'faq.fallback': 'Я пока не нашёл точный ответ.',
  },
  en: {
    'assistant.recommend': 'Recommended:',
    'assistant.scenarios.child.reason': 'A compact model works well for a child.',
    'assistant.scenarios.music.reason': 'For music, choose stronger sound.',
    'assistant.scenarios.home.reason': 'For home, choose a daily model.',
    'assistant.scenarios.gift.reason': 'For a gift, choose a simple model.',
    'assistant.scenarios.music.label': 'For music',
    'assistant.scenarios.home.label': 'For home',
    'assistant.scenarios.child.label': 'For a child',
    'assistant.scenarios.gift.label': 'As a gift',
    'assistantV2.showProduct': 'Show in catalog',
    'assistantV2.compare': 'Compare',
    'assistantV2.anotherOption': 'Another option',
    'assistantV2.back': 'Back',
    'assistantV2.clarifyPurpose': 'What will the speaker be used for?',
    'assistantV2.cheaperLead': 'You can look at a more affordable option:',
    'assistantV2.cheaperReason': 'It is a good start.',
    'assistantV2.colorAvailable': 'Yes, this color is available for',
    'assistantV2.colorUnavailable': 'This color is not currently available.',
    'assistantV2.compareAnswer': 'Lite 2 is first, Mini 3 is balanced, Midi is music.',
    'assistantV2.alternativeLead': 'Another option is',
    'assistantV2.colors.blue': 'blue',
    'assistantV2.colors.red': 'red',
    'assistantV2.colors.black': 'black',
    'assistantV2.colors.white': 'white',
    'assistantV2.colors.green': 'green',
    'assistantV2.colors.violet': 'purple',
    'assistantV2.colors.beige': 'beige',
    'assistantV2.colors.gray': 'gray',
    'faq.fallback': 'I have not found an exact answer yet.',
  },
  lv: {
    'assistant.recommend': 'Ieteikums:',
    'assistant.scenarios.child.reason': 'Bērnam der kompakts modelis.',
    'assistant.scenarios.music.reason': 'Mūzikai labāk der jaudīgāks modelis.',
    'assistant.scenarios.home.reason': 'Mājām der ikdienas modelis.',
    'assistant.scenarios.gift.reason': 'Dāvanai der vienkāršs modelis.',
    'assistant.scenarios.music.label': 'Mūzikai',
    'assistant.scenarios.home.label': 'Mājām',
    'assistant.scenarios.child.label': 'Bērnam',
    'assistant.scenarios.gift.label': 'Dāvanai',
    'assistantV2.showProduct': 'Parādīt katalogā',
    'assistantV2.compare': 'Salīdzināt',
    'assistantV2.anotherOption': 'Vēl variants',
    'assistantV2.back': 'Atpakaļ',
    'assistantV2.clarifyPurpose': 'Kam izvēlamies skaļruni?',
    'assistantV2.cheaperLead': 'Var apskatīt pieejamāku variantu:',
    'assistantV2.cheaperReason': 'Tas ir labs sākums.',
    'assistantV2.colorAvailable': 'Jā, šī krāsa ir pieejama modelim',
    'assistantV2.colorUnavailable': 'Šī krāsa pašlaik nav pieejama.',
    'assistantV2.compareAnswer': 'Lite 2 ir sākumam, Mini 3 balansam, Midi mūzikai.',
    'assistantV2.alternativeLead': 'Vēl var apskatīt',
    'assistantV2.colors.blue': 'zila',
    'assistantV2.colors.red': 'sarkana',
    'assistantV2.colors.black': 'melna',
    'assistantV2.colors.white': 'balta',
    'assistantV2.colors.green': 'zaļa',
    'assistantV2.colors.violet': 'violeta',
    'assistantV2.colors.beige': 'bēša',
    'assistantV2.colors.gray': 'pelēka',
    'faq.fallback': 'Es vēl neatradu precīzu atbildi.',
  },
};

const faqAnswers = {
  ru: {
    latvia: 'Да, работает в Латвии.',
    delivery: 'Доставка курьерской службой.',
    setup: 'Настройка по договорённости.',
  },
  en: {
    latvia: 'Yes, it works in Latvia.',
    delivery: 'Courier delivery is available.',
    setup: 'Setup is available by agreement.',
  },
  lv: {
    latvia: 'Jā, darbojas Latvijā.',
    delivery: 'Piegāde ar kurjeru ir pieejama.',
    setup: 'Iestatīšana pēc vienošanās.',
  },
};

function createEngine(lang = 'ru') {
  return context.window.AssistantEngine.createAssistantEngine({
    models: () => models,
    t: key => translationSets[lang][key] || key,
    modelText: (model, key) => modelCopy[lang][model.id][key] || '',
    findFaq: input => {
      const normalized = String(input).toLowerCase();
      const matched =
        /latvia|latvij|латви|рига|lv/.test(normalized) ? 'latvia' :
        /delivery|deliver|piegāde|piegade|доставка|курьер/.test(normalized) ? 'delivery' :
        /setup|connect|iestat|настрой|подключ/.test(normalized) ? 'setup' :
        null;
      return matched
        ? { matched: true, faq: { id: matched }, confidence: 1, answer: faqAnswers[lang][matched] }
        : { matched: false, confidence: 0 };
    },
  });
}

function assertNotFallback(response, lang = 'ru', label = 'response') {
  assert.notStrictEqual(response.text, translationSets[lang]['faq.fallback'], `${label} returned fallback`);
}

function assertAction(response, id, label = 'response') {
  assert(response.actions?.some(action => action.id === id), `${label} missing action ${id}`);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
}

function showProductAction(response, label = 'response') {
  const action = response.actions?.find(item => item.id === 'show_product');
  assert(action, `${label} missing show_product action`);
  assert(action.modelId, `${label} show_product missing modelId`);
  assert(models.some(model => model.id === action.modelId), `${label} show_product has unknown modelId ${action.modelId}`);
  return action;
}

function isUnknownFallback(response, lang = 'ru') {
  return response.type === 'fallback' && response.text === translationSets[lang]['faq.fallback'];
}

function assertNormal(response, lang, label) {
  assert(!isUnknownFallback(response, lang), `${label} unexpectedly returned unknown fallback`);
}

function runDialog(name, lang, steps, coverage) {
  const engine = createEngine(lang);
  const seenModels = [];
  let previousModelId = null;
  let previousRecommendationModelId = null;

  for (const step of steps) {
    const response = engine.handle(step.input);
    const label = `${name}: ${step.input}`;
    if (step.intent) coverage.add(step.intent);
    if (step.noFallback !== false) assertNormal(response, lang, label);
    if (step.type) assert.strictEqual(response.type, step.type, label);
    if (step.modelId) assert.strictEqual(response.modelId, step.modelId, label);
    if (step.scenario) assert.strictEqual(engine.snapshot().selectedScenario, step.scenario, label);
    if (step.action) assertAction(response, step.action, label);
    if (step.showProduct) showProductAction(response, label);
    if (step.expectShowProductModelId) assert.strictEqual(showProductAction(response, label).modelId, step.expectShowProductModelId, label);
    if (step.notRepeatPrevious) assert.notStrictEqual(response.modelId, previousModelId, label);
    if (step.backToPreviousRecommendation) assert.strictEqual(response.modelId, previousRecommendationModelId, label);
    if (response.modelId) {
      seenModels.push(response.modelId);
      previousModelId = response.modelId;
      if (response.type === 'recommendation' || response.type === 'model') previousRecommendationModelId = response.modelId;
    }
  }
  return { engine, seenModels };
}

function testScenarioSwitchClearsContext() {
  const engine = createEngine('ru');
  assert.strictEqual(engine.handle(words.childScenario).modelId, 'light2');
  assert.strictEqual(engine.handle(words.cheaper).modelId, 'light2');
  const music = engine.handle(words.musicSwitch);
  assert.strictEqual(music.modelId, 'midi');
  assert.strictEqual(engine.snapshot().selectedScenario, 'music');
  assert.strictEqual(engine.snapshot().budget, null);
}

function testActionCommandsAsText() {
  const engine = createEngine('ru');
  engine.handle(words.childScenario);
  for (const input of [words.another, words.back, words.showProduct, words.compare]) {
    const response = engine.handle(input);
    assertNotFallback(response, 'ru', input);
  }
}

function testSpecificModels() {
  const cases = [['Light 2', 'light2'], ['Mini 3', 'mini3'], ['Midi', 'midi'], ['Street', 'street']];
  for (const [input, expected] of cases) {
    const response = createEngine('ru').handle(input);
    assert.strictEqual(response.modelId, expected, input);
    assertAction(response, 'show_product', input);
  }
}

function testSynonymsTyposAndFaq() {
  const cases = [
    [words.stationTypo, undefined],
    [words.alice, undefined],
    [words.station, undefined],
    [words.daughter, 'light2'],
    [words.music, 'midi'],
    [words.latviaTypo, undefined],
    [words.delivery, undefined],
    [words.setup, undefined],
  ];
  for (const [input, modelId] of cases) {
    const response = createEngine('ru').handle(input);
    assertNotFallback(response, 'ru', input);
    if (modelId) assert.strictEqual(response.modelId, modelId, input);
  }
}

function testFallbackUnknown() {
  const response = createEngine('ru').handle(words.unknown);
  assert.strictEqual(response.text, translationSets.ru['faq.fallback']);
}

function testAlternativeDoesNotRepeatCurrentModel() {
  const engine = createEngine('ru');
  const first = engine.handle('Light 2');
  const second = engine.handle(words.another);
  const third = engine.handle(words.another);
  assert.notStrictEqual(second.modelId, first.modelId);
  assert.notStrictEqual(third.modelId, second.modelId);
}

function testBackReturnsPreviousState() {
  const engine = createEngine('ru');
  engine.handle(words.childScenario);
  const midi = engine.handle('Midi');
  assert.strictEqual(midi.modelId, 'midi');
  const back = engine.handle(words.back);
  assert.strictEqual(back.modelId, 'light2');
  assert.strictEqual(back.type, 'back');
}

function testNavigationActionIncludesModelAndColor() {
  const engine = createEngine('ru');
  const response = engine.handle('Light 2');
  const show = response.actions.find(action => action.id === 'show_product');
  assert(show, 'show_product action missing');
  assert.strictEqual(show.modelId, 'light2');
  assert.strictEqual(show.colorKey, null);
}

function testColorIntentKnownUnavailableAndAvailable() {
  const cases = [
    { lang: 'ru', input: words.blueQuestion, type: 'color', modelId: undefined },
    { lang: 'ru', input: words.redQuestion, type: 'color_unavailable', includes: ru(1082,1088,1072,1089,1085) },
    { lang: 'ru', before: 'Mini 3 Pro', input: words.redQuestion, type: 'color_unavailable', modelId: 'miniPro', includes: ru(1082,1088,1072,1089,1085) },
    { lang: 'ru', input: words.blackQuestion, type: 'color', modelId: undefined },
    { lang: 'en', input: 'Is there red?', type: 'color_unavailable', includes: 'red' },
    { lang: 'lv', input: 'Vai ir sarkana?', type: 'color_unavailable', includes: 'sarkana' },
  ];
  for (const item of cases) {
    const engine = createEngine(item.lang);
    if (item.before) engine.handle(item.before);
    const response = engine.handle(item.input);
    assertNormal(response, item.lang, item.input);
    assert.strictEqual(response.type, item.type, item.input);
    if (item.modelId) assert.strictEqual(response.modelId, item.modelId, item.input);
    if (item.includes) assert(normalizeText(response.text).includes(normalizeText(item.includes)), `${item.input} should mention ${item.includes}`);
    if (response.type === 'color') assertAction(response, 'show_product', item.input);
  }
}

function testRequiredRegressionFlow() {
  const engine = createEngine('ru');
  const steps = [
    [words.childScenario, 'light2'],
    [words.cheaper, 'light2'],
    [words.musicSwitch, 'midi'],
    [words.homeScenario, 'miniPro'],
    ['Midi', 'midi'],
    [words.another, 'light2'],
    [words.back, 'midi'],
    ['Light 2', 'light2'],
    [words.another, 'mini3'],
    ['Mini 3', 'mini3'],
    [words.another, 'light2'],
    ['Midi', 'midi'],
  ];
  for (const [input, expectedModelId] of steps) {
    const response = engine.handle(input);
    assertNotFallback(response, 'ru', input);
    assert.strictEqual(response.modelId, expectedModelId, `${input} expected ${expectedModelId}`);
    assert(response.actions?.length, `${input} should include actions`);
  }
}

function testLanguages() {
  const cases = {
    ru: [words.homeScenario, words.music, words.childScenario, words.delivery, words.setup, words.latviaTypo],
    en: ['For home', 'For music', 'For a child', 'delivery', 'setup', 'Latvia'],
    lv: ['Mājām', 'Mūzikai', 'Bērnam', 'piegāde', 'iestatīšana', 'Latvijā'],
  };
  for (const [lang, inputs] of Object.entries(cases)) {
    for (const input of inputs) {
      const response = createEngine(lang).handle(input);
      assertNotFallback(response, lang, `${lang}:${input}`);
    }
  }
}

function testGoldenConversationsAndIntentCoverage() {
  const coverage = new Set();

  runDialog('A', 'ru', [
    { input: words.childScenario, intent: 'child', scenario: 'child', modelId: 'light2', showProduct: true },
    { input: words.cheaper, intent: 'budget', modelId: 'light2', showProduct: true },
    { input: words.musicSwitch, intent: 'music', scenario: 'music', modelId: 'midi', showProduct: true },
    { input: words.blueQuestion, intent: 'color', modelId: 'midi' },
    { input: words.latviaTypo, intent: 'latvia', type: 'faq' },
    { input: words.setup, intent: 'setup', type: 'faq' },
  ], coverage);

  runDialog('B', 'ru', [
    { input: words.wantSpeaker, type: 'clarify' },
    { input: words.homeScenario, intent: 'home', scenario: 'home', modelId: 'miniPro', showProduct: true },
    { input: words.another, intent: 'next_variant', notRepeatPrevious: true, showProduct: true },
    { input: words.back, intent: 'back', modelId: 'miniPro' },
    { input: words.showProduct, intent: 'show_product', expectShowProductModelId: 'miniPro' },
  ], coverage);

  runDialog('C', 'ru', [
    { input: 'Mini 3', intent: 'model', type: 'model', modelId: 'mini3', showProduct: true },
    { input: words.compare, intent: 'compare', type: 'compare', action: 'compare' },
    { input: 'Midi', intent: 'model', type: 'model', modelId: 'midi', showProduct: true },
    { input: words.showProduct, intent: 'show_product', expectShowProductModelId: 'midi' },
  ], coverage);

  runDialog('D', 'ru', [
    { input: words.giftScenario, intent: 'gift', scenario: 'gift', modelId: 'light2', showProduct: true },
    { input: words.budget100, intent: 'budget', modelId: 'light2', showProduct: true },
    { input: words.another, intent: 'next_variant', notRepeatPrevious: true, showProduct: true },
  ], coverage);

  runDialog('E', 'en', [
    { input: 'Do you deliver?', intent: 'delivery', type: 'faq' },
    { input: 'setup help', intent: 'setup', type: 'faq' },
    { input: 'music', intent: 'music', scenario: 'music', modelId: 'midi', showProduct: true },
    { input: 'show product', intent: 'show_product', expectShowProductModelId: 'midi' },
  ], coverage);

  runDialog('F', 'lv', [
    { input: 'Vai strada Latvija?', intent: 'latvia', type: 'faq' },
    { input: 'piegade', intent: 'delivery', type: 'faq' },
    { input: 'iestatisana', intent: 'setup', type: 'faq' },
  ], coverage);

  runDialog('G', 'ru', [
    { input: words.homeScenario, intent: 'home', modelId: 'miniPro', showProduct: true },
    { input: 'Light 2', intent: 'model', modelId: 'light2', showProduct: true },
    { input: words.another, intent: 'next_variant', notRepeatPrevious: true, showProduct: true },
    { input: words.another, intent: 'next_variant', notRepeatPrevious: true, showProduct: true },
  ], coverage);

  runDialog('H', 'en', [
    { input: 'For home', intent: 'home', scenario: 'home', modelId: 'miniPro', showProduct: true },
    { input: 'Another option', intent: 'next_variant', notRepeatPrevious: true, showProduct: true },
    { input: 'Back', intent: 'back', modelId: 'miniPro' },
  ], coverage);

  runDialog('I', 'lv', [
    { input: 'Muzikai', intent: 'music', scenario: 'music', modelId: 'midi', showProduct: true },
    { input: 'Vel variants', intent: 'next_variant', notRepeatPrevious: true, showProduct: true },
    { input: 'Atpakal', intent: 'back', modelId: 'midi' },
  ], coverage);

  runDialog('J', 'ru', [
    { input: words.unknown, intent: 'fallback', type: 'fallback', noFallback: false },
  ], coverage);

  const requiredIntents = [
    'home',
    'music',
    'child',
    'gift',
    'budget',
    'compare',
    'setup',
    'delivery',
    'latvia',
    'model',
    'color',
    'show_product',
    'next_variant',
    'back',
    'fallback',
  ];
  const missing = requiredIntents.filter(intent => !coverage.has(intent));
  assert.deepStrictEqual(missing, [], `Missing intent coverage: ${missing.join(', ')}`);
  console.log(`assistant v2 intent coverage: ${requiredIntents.join(', ')}`);
}

testScenarioSwitchClearsContext();
testActionCommandsAsText();
testSpecificModels();
testSynonymsTyposAndFaq();
testFallbackUnknown();
testAlternativeDoesNotRepeatCurrentModel();
testBackReturnsPreviousState();
testNavigationActionIncludesModelAndColor();
testColorIntentKnownUnavailableAndAvailable();
testRequiredRegressionFlow();
testLanguages();
testGoldenConversationsAndIntentCoverage();

console.log('assistant engine v2 regression passed');
