(function () {
  const SYNONYMS = {
    station: ['колонка', 'колонки', 'калонка', 'станция', 'станции', 'алиса', 'яндекс', 'speaker', 'station', 'skaļrunis'],
    child: ['ребенок', 'ребёнок', 'дети', 'сын', 'дочка', 'детская', 'child', 'kids', 'bērns', 'berns', 'bērnam', 'bernam'],
    music: ['громкая', 'мощная', 'бас', 'музыка', 'песни', 'music', 'bass', 'loud', 'mūzika', 'muzika'],
    home: ['дом', 'квартира', 'кухня', 'спальня', 'home', 'house', 'māja', 'maja', 'mājām', 'majam'],
    gift: ['подарок', 'дарить', 'gift', 'present', 'dāvana', 'davana'],
    cheaper: ['подешевле', 'дешевле', 'недорогая', 'доступная', 'цена', 'бюджет', 'cheap', 'cheaper', 'budget', 'price', 'lētāk', 'letak', 'cena'],
    latvia: ['латвия', 'латвие', 'рига', 'lv', 'latvia', 'riga', 'latvija'],
    delivery: ['доставка', 'привезти', 'курьер', 'delivery', 'deliver', 'piegāde', 'piegade'],
    setup: ['настройка', 'настроить', 'подключить', 'setup', 'connect', 'iestatīšana', 'iestatisana', 'pieslēgt', 'pieslegt'],
    compare: ['сравнить', 'отличаются', 'разница', 'compare', 'difference', 'salīdzināt', 'salidzinat', 'atšķirība', 'atskiriba'],
  };

  const COLOR_MAP = [
    ['blue', ['синяя', 'синий', 'голубая', 'голубой', 'blue', 'zila']],
    ['green', ['зеленая', 'зеленый', 'зелёная', 'зелёный', 'green', 'zaļa', 'zala']],
    ['pink', ['розовая', 'розовый', 'pink', 'roza']],
    ['coral', ['коралловая', 'коралловый', 'coral']],
    ['black', ['черная', 'черный', 'чёрная', 'чёрный', 'black', 'melna']],
    ['gray', ['серая', 'серый', 'gray', 'grey', 'pelēka', 'peleka']],
  ];

  COLOR_MAP.push(
    ['red', ['red', 'sarkana']],
    ['white', ['white', 'balta']],
    ['violet', ['purple', 'violeta']],
    ['beige', ['beige', 'bД“ЕЎa', 'besa']]
  );

  const ru = (...codes) => String.fromCharCode(...codes);
  SYNONYMS.station.push(
    ru(1082,1086,1083,1086,1085,1082),
    ru(1082,1086,1083,1086,1085,1082,1072),
    ru(1082,1072,1083,1086,1085,1082),
    ru(1082,1072,1083,1086,1085,1082,1072),
    ru(1089,1090,1072,1085,1094,1080,1103),
    ru(1072,1083,1080,1089,1072),
    ru(1103,1085,1076,1077,1082,1089)
  );
  SYNONYMS.station.push('light', 'lite', 'mini', 'midi', 'street');
  SYNONYMS.child.push(
    ru(1088,1077,1073,1077,1085),
    ru(1088,1077,1073,1077,1085,1086,1082),
    ru(1088,1077,1073,1077,1085,1082,1072),
    ru(1088,1077,1073,1105,1085),
    ru(1088,1077,1073,1105,1085,1086,1082),
    ru(1088,1077,1073,1105,1085,1082,1072),
    ru(1076,1077,1090,1080),
    ru(1089,1099,1085),
    ru(1076,1086,1095,1082,1072),
    ru(1076,1086,1095,1082,1080),
    ru(1076,1077,1090,1089,1082,1072,1103)
  );
  SYNONYMS.music.push(
    ru(1084,1091,1079,1099,1082),
    ru(1075,1088,1086,1084,1082,1072,1103),
    ru(1084,1086,1097,1085,1072,1103),
    ru(1073,1072,1089),
    ru(1084,1091,1079,1099,1082),
    ru(1084,1091,1079,1099,1082,1072)
  );
  SYNONYMS.home.push(
    ru(1076,1086,1084),
    ru(1076,1086,1084,1072),
    ru(1082,1074,1072,1088,1090,1080,1088,1072),
    ru(1082,1091,1093,1085,1103),
    ru(1089,1087,1072,1083,1100,1085,1103)
  );
  SYNONYMS.gift.push(ru(1087,1086,1076,1072,1088,1086,1082), ru(1076,1072,1088,1080,1090,1100));
  SYNONYMS.cheaper.push(
    ru(1087,1086,1076,1077,1096,1077,1074,1083,1077),
    ru(1076,1077,1096,1077,1074,1083,1077),
    ru(1085,1077,1076,1086,1088,1086,1075,1072,1103),
    ru(1076,1086,1089,1090,1091,1087,1085,1072,1103),
    ru(1094,1077,1085,1072),
    ru(1073,1102,1076,1078,1077,1090)
  );
  SYNONYMS.compare.push(ru(1089,1088,1072,1074,1085,1080,1090,1100), ru(1086,1090,1083,1080,1095,1072,1102,1090,1089,1103), ru(1088,1072,1079,1085,1080,1094,1072));
  SYNONYMS.compare.push('compare', 'salidzinat');
  SYNONYMS.latvia.push(ru(1083,1072,1090,1074,1080,1103), ru(1083,1072,1090,1074,1080,1077), ru(1088,1080,1075,1072));
  SYNONYMS.delivery.push(ru(1076,1086,1089,1090,1072,1074,1082,1072), ru(1087,1088,1080,1074,1077,1079,1090,1080), ru(1082,1091,1088,1100,1077,1088));
  SYNONYMS.setup.push(ru(1085,1072,1089,1090,1088,1086,1081,1082,1072), ru(1085,1072,1089,1090,1088,1086,1080,1090,1100), ru(1087,1086,1076,1082,1083,1102,1095,1080,1090,1100));
  COLOR_MAP[0][1].push(ru(1089,1080,1085,1103,1103), ru(1089,1080,1085,1080,1081), ru(1075,1086,1083,1091,1073,1072,1103), ru(1075,1086,1083,1091,1073,1086,1081));
  COLOR_MAP[1][1].push(ru(1079,1077,1083,1077,1085,1072,1103), ru(1079,1077,1083,1077,1085,1099,1081), ru(1079,1077,1083,1105,1085,1072,1103), ru(1079,1077,1083,1105,1085,1099,1081));
  COLOR_MAP[2][1].push(ru(1088,1086,1079,1086,1074,1072,1103), ru(1088,1086,1079,1086,1074,1099,1081));
  COLOR_MAP[3][1].push(ru(1082,1086,1088,1072,1083,1083,1086,1074,1072,1103), ru(1082,1086,1088,1072,1083,1083,1086,1074,1099,1081));
  COLOR_MAP[4][1].push(ru(1095,1077,1088,1085,1072,1103), ru(1095,1077,1088,1085,1099,1081), ru(1095,1105,1088,1085,1072,1103), ru(1095,1105,1088,1085,1099,1081));
  COLOR_MAP[5][1].push(ru(1089,1077,1088,1072,1103), ru(1089,1077,1088,1099,1081));
  COLOR_MAP.find(([key]) => key === 'red')[1].push(ru(1082,1088,1072,1089,1085,1072,1103), ru(1082,1088,1072,1089,1085,1099,1081));
  COLOR_MAP.find(([key]) => key === 'white')[1].push(ru(1073,1077,1083,1072,1103), ru(1073,1077,1083,1099,1081));
  COLOR_MAP.find(([key]) => key === 'violet')[1].push(ru(1092,1080,1086,1083,1077,1090,1086,1074,1072,1103), ru(1092,1080,1086,1083,1077,1090,1086,1074,1099,1081));
  COLOR_MAP.find(([key]) => key === 'beige')[1].push(ru(1073,1077,1078,1077,1074,1072,1103), ru(1073,1077,1078,1077,1074,1099,1081));

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\u0451/g, '\u0435')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\u0430-\u044f0-9]+/g, ' ')
      .trim();
  }

  function hasAny(text, words) {
    const normalized = normalize(text);
    return words.some(word => normalized.includes(normalize(word)));
  }

  function detectColor(text) {
    return COLOR_MAP.find(([, words]) => hasAny(text, words))?.[0] || null;
  }

  function sameIntent(text, words) {
    const normalized = normalize(text);
    return words.some(word => {
      const candidate = normalize(word);
      return candidate && (normalized === candidate || normalized.includes(candidate));
    });
  }

  function createContext() {
    return {
      lastModelId: null,
      selectedScenario: null,
      budget: null,
      purpose: null,
      color: null,
      previousQuestions: [],
      awaiting: null,
      alternatives: [],
    };
  }

  function createAssistantEngine(options) {
    let context = createContext();
    let responseHistory = [];

    function reset() {
      context = createContext();
      responseHistory = [];
    }

    function remember(input) {
      context.previousQuestions.push(input);
      context.previousQuestions = context.previousQuestions.slice(-8);
    }

    function modelById(id) {
      return options.models().find(model => model.id === id) || null;
    }

    function availableModels(ids) {
      return ids.map(modelById).filter(Boolean);
    }

    function detectModel(input) {
      const normalized = normalize(input);
      return options.models()
        .flatMap(model => [model.id, ...(model.aliases || []), options.modelText(model, 'title'), options.modelText(model, 'short')]
          .map(alias => ({ model, candidate: normalize(alias) })))
        .filter(item => item.candidate && (normalized === item.candidate || normalized.includes(item.candidate)))
        .sort((a, b) => b.candidate.length - a.candidate.length)[0]?.model || null;
    }

    function pushResponse(response) {
      responseHistory.push(response);
      responseHistory = responseHistory.slice(-8);
      return response;
    }

    function recommendationActions(model) {
      const actions = [];
      if (model) actions.push({ id: 'show_product', label: options.t('assistantV2.showProduct'), modelId: model.id, colorKey: context.color });
      actions.push({ id: 'compare', label: options.t('assistantV2.compare') });
      if (context.alternatives.length) actions.push({ id: 'alternative', label: options.t('assistantV2.anotherOption') });
      actions.push({ id: 'back', label: options.t('assistantV2.back') });
      return actions;
    }

    function resetScenarioState(scenarioId) {
      if (context.selectedScenario !== scenarioId) {
        context.budget = null;
        context.color = null;
        context.alternatives = [];
      }
    }

    function recommendForScenario(scenarioId) {
      resetScenarioState(scenarioId);
      const priority = {
        child: ['light2', 'mini3'],
        music: ['midi', 'miniPro', 'street', 'mini3', 'light2'],
        home: ['miniPro', 'mini3', 'light2'],
        gift: ['light2', 'mini3', 'miniPro'],
      }[scenarioId] || ['light2', 'mini3', 'miniPro', 'street'];
      const choices = availableModels(priority);
      const selected = choices[0] || options.models()[0];
      context.awaiting = null;
      context.selectedScenario = scenarioId;
      context.purpose = scenarioId;
      context.lastModelId = selected?.id || null;
      context.alternatives = choices.slice(1).map(model => model.id);
      return selected;
    }

    function cheapestModel(scopeIds) {
      const pool = (scopeIds?.length ? availableModels(scopeIds) : options.models())
        .filter(model => Number(model.price) > 0)
        .sort((a, b) => Number(a.price) - Number(b.price));
      return pool[0] || options.models()[0];
    }

    function scenarioAnswer(scenarioId) {
      const model = recommendForScenario(scenarioId);
      return pushResponse({
        type: 'recommendation',
        text: `${options.t('assistant.recommend')} ${options.modelText(model, 'title')}. ${options.t(`assistant.scenarios.${scenarioId}.reason`)}`,
        modelId: model?.id,
        colorKey: context.color,
        actions: recommendationActions(model),
      });
    }

    function clarify() {
      context.awaiting = 'purpose';
      return pushResponse({
        type: 'clarify',
        text: options.t('assistantV2.clarifyPurpose'),
        actions: [
          { id: 'scenario', scenarioId: 'music', label: options.t('assistant.scenarios.music.label') },
          { id: 'scenario', scenarioId: 'home', label: options.t('assistant.scenarios.home.label') },
          { id: 'scenario', scenarioId: 'child', label: options.t('assistant.scenarios.child.label') },
          { id: 'scenario', scenarioId: 'gift', label: options.t('assistant.scenarios.gift.label') },
        ],
      });
    }

    function modelHasColor(model, colorKey) {
      return model?.photos?.some(photo => photo.colorKey === colorKey);
    }

    function modelsWithColor(colorKey) {
      return options.models().filter(model => modelHasColor(model, colorKey));
    }

    function colorLabel(colorKey) {
      const translationKey = `assistantV2.colors.${colorKey}`;
      const translated = options.t(translationKey);
      if (translated && translated !== translationKey) return translated;
      return {
        blue: ru(1089,1080,1085,1080,1081),
        red: ru(1082,1088,1072,1089,1085,1099,1081),
        black: ru(1095,1105,1088,1085,1099,1081),
        white: ru(1073,1077,1083,1099,1081),
        green: ru(1079,1077,1083,1105,1085,1099,1081),
        violet: ru(1092,1080,1086,1083,1077,1090,1086,1074,1099,1081),
        beige: ru(1073,1077,1078,1077,1074,1099,1081),
        gray: ru(1089,1077,1088,1099,1081),
        pink: ru(1088,1086,1079,1086,1074,1099,1081),
        coral: ru(1082,1086,1088,1072,1083,1083,1086,1074,1099,1081),
      }[colorKey] || colorKey;
    }

    function modelColorList(model) {
      const colors = (model?.photos || []).map(photo => colorLabel(photo.colorKey));
      return colors.length ? colors.join(', ') : '';
    }

    function colorResponse(colorKey) {
      const selected = modelById(context.lastModelId);
      if (selected) {
        const hasColor = modelHasColor(selected, colorKey);
        return pushResponse({
          type: hasColor ? 'color' : 'color_unavailable',
          text: hasColor
            ? `${options.t('assistantV2.colorAvailable')} ${options.modelText(selected, 'title')}.`
            : `Сейчас ${colorLabel(colorKey)} цвет недоступен для ${options.modelText(selected, 'title')}. Доступные цвета: ${modelColorList(selected)}.`,
          modelId: selected.id,
          colorKey,
          actions: hasColor ? recommendationActions(selected) : [{ id: 'back', label: options.t('assistantV2.back') }],
        });
      }

      const matches = modelsWithColor(colorKey);
      if (matches.length) {
        context.color = colorKey;
        const first = matches[0];
        context.lastModelId = first.id;
        context.alternatives = matches.slice(1).map(model => model.id);
        return pushResponse({
          type: 'color',
          text: `${options.t('assistantV2.colorAvailable')}: ${matches.map(model => options.modelText(model, 'title')).join(', ')}.`,
          modelId: first.id,
          colorKey,
          actions: recommendationActions(first),
        });
      }

      return pushResponse({
        type: 'color_unavailable',
        text: `Сейчас ${colorLabel(colorKey)} цвета в каталоге нет. Могу показать доступные цвета.`,
        colorKey,
        actions: [{ id: 'back', label: options.t('assistantV2.back') }],
      });
    }

    function modelResponse(model) {
      context.awaiting = null;
      context.lastModelId = model.id;
      context.alternatives = options.models().filter(item => item.id !== model.id).map(item => item.id);
      const line = options.modelText(model, 'line') || options.modelText(model, 'description') || '';
      return pushResponse({
        type: 'model',
        text: `${options.modelText(model, 'title')}. ${line}`.trim(),
        modelId: model.id,
        colorKey: context.color,
        actions: recommendationActions(model),
      });
    }

    function compareResponse() {
      return pushResponse({
        type: 'compare',
        text: options.t('assistantV2.compareAnswer'),
        actions: [
          { id: 'compare', label: options.t('assistantV2.compare') },
          { id: 'back', label: options.t('assistantV2.back') },
        ],
      });
    }

    function backResponse() {
      if (responseHistory.length <= 1) return clarify();
      responseHistory.pop();
      const previous = responseHistory[responseHistory.length - 1];
      if (previous?.modelId) {
        context.lastModelId = previous.modelId;
        context.color = previous.colorKey || null;
      }
      return { ...previous, type: 'back' };
    }

    function nextAlternative() {
      const currentId = context.lastModelId;
      let id = context.alternatives.find(item => item !== currentId);
      if (!id) id = options.models().find(model => model.id !== currentId)?.id;
      context.alternatives = context.alternatives.filter(item => item !== id);
      const model = modelById(id) || options.models()[0];
      context.lastModelId = model?.id || null;
      return pushResponse({
        type: 'recommendation',
        text: `${options.t('assistantV2.alternativeLead')} ${options.modelText(model, 'title')}.`,
        modelId: model?.id,
        colorKey: context.color,
        actions: recommendationActions(model),
      });
    }

    function isBudgetAmount(input) {
      const normalized = normalize(input);
      const upToRu = ru(1076,1086);
      const euroRu = ru(1077,1074,1088,1086);
      return /(?:^| )(under|up to|max|eur|euro|€) ?\d+/.test(normalized) ||
        normalized.includes(euroRu) ||
        new RegExp(`(?:^| )${upToRu} \\d+`).test(normalized);
    }

    function handle(input) {
      remember(input);
      const color = detectColor(input);
      if (color) context.color = color;

      if (sameIntent(input, [options.t('assistantV2.anotherOption'), 'another option', 'next', ru(1077,1097,1077,32,1074,1072,1088,1080,1072,1085,1090)])) return nextAlternative();
      if (sameIntent(input, [options.t('assistantV2.back'), 'back', ru(1085,1072,1079,1072,1076)])) return backResponse();
      if (sameIntent(input, [options.t('assistantV2.compare'), 'compare', ru(1089,1088,1072,1074,1085,1080,1090,1100)])) return compareResponse();

      if (context.awaiting === 'purpose') {
        if (hasAny(input, SYNONYMS.music)) return scenarioAnswer('music');
        if (hasAny(input, SYNONYMS.child)) return scenarioAnswer('child');
        if (hasAny(input, SYNONYMS.gift)) return scenarioAnswer('gift');
        return scenarioAnswer('home');
      }

      if (hasAny(input, SYNONYMS.child)) return scenarioAnswer('child');
      if (hasAny(input, SYNONYMS.music)) return scenarioAnswer('music');
      if (hasAny(input, SYNONYMS.gift)) return scenarioAnswer('gift');
      if (hasAny(input, SYNONYMS.home)) return scenarioAnswer('home');

      const model = detectModel(input);
      if (model) return modelResponse(model);

      if (sameIntent(input, [options.t('assistantV2.showProduct'), 'show in catalog', 'show product', ru(1087,1086,1082,1072,1079,1072,1090,1100,32,1074,32,1082,1072,1090,1072,1083,1086,1075,1077)])) {
        const selected = modelById(context.lastModelId);
        if (selected) return modelResponse(selected);
      }

      if (hasAny(input, SYNONYMS.cheaper) || isBudgetAmount(input)) {
        const scope = context.selectedScenario === 'child' ? ['light2', 'mini3'] : null;
        const selected = cheapestModel(scope);
        context.budget = 'low';
        context.lastModelId = selected?.id || context.lastModelId;
        return pushResponse({
          type: 'recommendation',
          text: `${options.t('assistantV2.cheaperLead')} ${options.modelText(selected, 'title')}. ${options.t('assistantV2.cheaperReason')}`,
          modelId: selected?.id,
          colorKey: context.color,
          actions: recommendationActions(selected),
        });
      }

      if (color) return colorResponse(color);

      if (hasAny(input, SYNONYMS.compare)) return compareResponse();
      if (hasAny(input, SYNONYMS.station) && normalize(input).split(' ').length <= 3) return clarify();

      const faq = options.findFaq(input);
      if (faq.matched) {
        return pushResponse({
          type: 'faq',
          text: faq.answer,
          faq,
          actions: faq.faq?.id === 'model_difference'
            ? [{ id: 'compare', label: options.t('assistantV2.compare') }, { id: 'back', label: options.t('assistantV2.back') }]
            : [{ id: 'back', label: options.t('assistantV2.back') }],
        });
      }

      return pushResponse({
        type: 'fallback',
        text: options.t('faq.fallback'),
        actions: [{ id: 'back', label: options.t('assistantV2.back') }],
      });
    }

    function snapshot() {
      return { ...context };
    }

    return { reset, handle, nextAlternative, back: backResponse, snapshot };
  }

  window.AssistantEngine = { createAssistantEngine };
})();
