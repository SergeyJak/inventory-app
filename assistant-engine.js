(function () {
  console.info('AssistantEngine version: v2.1');

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
    availability: ['есть', 'доступна', 'доступен', 'наличии', 'available', 'in stock', 'ir', 'pieejams', 'pieejama'],
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
  COLOR_MAP.push(['graphite', ['graphite', ru(1075,1088,1072,1092,1080,1090)]]);
  SYNONYMS.station.push(
    ru(1082,1086,1083,1086,1085,1082),
    ru(1082,1086,1083,1086,1085,1082,1072),
    ru(1082,1072,1083,1086,1085,1082),
    ru(1082,1072,1083,1086,1085,1082,1072),
    ru(1089,1090,1072,1085,1094,1080,1103),
    ru(1089,1090,1072,1085,1094,1099,1103),
    ru(1072,1083,1080,1089,1072),
    ru(1103,1083,1080,1089,1072),
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
    ru(1082,1091,1093,1085,1080),
    ru(1089,1087,1072,1083,1100,1085,1103),
    ru(1089,1087,1072,1083,1100,1085,1080),
    ru(1076,1072,1095,1072),
    ru(1076,1072,1095,1080),
    ru(1076,1083,1103,32,1087,1086,1078,1080,1083,1086,1075,1086),
    ru(1087,1086,1078,1080,1083,1086,1075,1086),
    ru(1076,1083,1103,32,1089,1077,1073,1103),
    ru(1089,1077,1073,1103)
  );
  SYNONYMS.gift.push(ru(1087,1086,1076,1072,1088,1086,1082), ru(1076,1072,1088,1080,1090,1100));
  SYNONYMS.cheaper.push(
    ru(1087,1086,1076,1077,1096,1077,1074,1083,1077),
    ru(1076,1077,1096,1077,1074,1083,1077),
    ru(1089,1072,1084,1072,1103,32,1076,1077,1096,1077,1074,1072,1103),
    ru(1085,1077,1076,1086,1088,1086,1075,1072,1103),
    ru(1076,1086,1089,1090,1091,1087,1085,1072,1103),
    ru(1094,1077,1085,1072),
    ru(1073,1102,1076,1078,1077,1090)
  );
  SYNONYMS.compare.push(ru(1089,1088,1072,1074,1085,1080,1090,1100), ru(1086,1090,1083,1080,1095,1072,1102,1090,1089,1103), ru(1088,1072,1079,1085,1080,1094,1072));
  SYNONYMS.compare.push('compare', 'salidzinat');
  SYNONYMS.compare.push(
    'vs',
    ru(1080,1083,1080),
    ru(1083,1091,1095,1096,1077),
    ru(1083,1091,1095,1096,1072,1103),
    ru(1074,1099,1073,1088,1072,1090,1100),
    ru(1074,1099,1073,1088,1072,1090,1100,32,1083,1091,1095,1077),
    ru(1089,1088,1072,1074,1085,1080)
  );
  SYNONYMS.availability.push(ru(1077,1089,1090,1100), ru(1076,1086,1089,1090,1091,1087,1085,1072), ru(1076,1086,1089,1090,1091,1087,1077,1085), ru(1085,1072,1083,1080,1095,1080,1080));
  SYNONYMS.availability.push(
    ru(1082,1086,1075,1076,1072,32,1073,1091,1076,1077,1090),
    ru(1079,1072,1082,1086,1085,1095,1080,1083,1072,1089,1100),
    ru(1082,1091,1087,1080,1090,1100),
    ru(1079,1072,1082,1072,1079,1072,1090,1100),
    ru(1085,1072,32,1089,1082,1083,1072,1076,1077)
  );
  SYNONYMS.latvia.push(ru(1083,1072,1090,1074,1080,1103), ru(1083,1072,1090,1074,1080,1077), ru(1088,1080,1075,1072), ru(1073,1091,1076,1077,1090,32,1088,1072,1073,1086,1090,1072,1090,1100), ru(1084,1086,1078,1085,1086,32,1087,1086,1083,1100,1079,1086,1074,1072,1090,1100,1089,1103), ru(1085,1091,1078,1077,1085,32,118,112,110));
  SYNONYMS.delivery.push(ru(1076,1086,1089,1090,1072,1074,1082,1072), ru(1087,1088,1080,1074,1077,1079,1090,1080), ru(1082,1091,1088,1100,1077,1088), ru(1086,1090,1087,1088,1072,1074,1080,1090,1077), ru(1086,1090,1087,1088,1072,1074,1082,1072));
  SYNONYMS.setup.push(ru(1085,1072,1089,1090,1088,1086,1081,1082,1072), ru(1085,1072,1089,1090,1088,1086,1080,1090,1100), ru(1087,1086,1076,1082,1083,1102,1095,1080,1090,1100), 'vpn', ru(1088,1091,1089,1089,1082,1080,1081,32,1103,1079,1099,1082));
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

  function isUnsupportedProduct(text) {
    return hasAny(text, [
      'iphone',
      'alexa',
      'google home',
      'siri',
      ru(1090,1077,1083,1077,1074,1080,1079,1086,1088),
      ru(1093,1086,1083,1086,1076,1080,1083,1100,1085,1080,1082),
    ]);
  }

  function isSmallTalk(text) {
    const normalized = normalize(text);
    return [
      ru(1087,1088,1080,1074,1077,1090),
      ru(1079,1076,1088,1072,1074,1089,1090,1074,1091,1081,1090,1077),
      ru(1089,1087,1072,1089,1080,1073,1086),
      ru(1087,1086,1082,1072),
      ru(1076,1086,1073,1088,1099,1081,32,1076,1077,1085,1100),
      'hello',
      'hi',
      'thanks',
      'bye',
    ].some(word => normalize(word) === normalized);
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

    function knownModels() {
      return typeof options.knownModels === 'function' ? options.knownModels() : options.models();
    }

    function knownModelById(id) {
      return knownModels().find(model => model.id === id) || modelById(id);
    }

    function availableModels(ids) {
      return ids.map(modelById).filter(Boolean);
    }

    function detectModel(input) {
      const normalized = normalize(input);
      const detected = knownModels()
        .flatMap(model => [model.id, ...(model.aliases || []), options.modelText(model, 'title'), options.modelText(model, 'short')]
          .map(alias => ({ model, candidate: normalize(alias) })))
        .filter(item => item.candidate && (normalized === item.candidate || normalized.includes(item.candidate)))
        .sort((a, b) => b.candidate.length - a.candidate.length)[0]?.model || null;
      if (detected) return detected;
      const shortAliases = [
        { id: 'miniPro', words: ['pro', ru(1087,1088,1086), ru(1084,1080,1085,1080,1087,1088,1086)] },
        { id: 'mini3', words: ['mini', ru(1084,1080,1085,1080)] },
        { id: 'light2', words: ['light', 'lite', ru(1083,1072,1081,1090)] },
      ];
      const match = shortAliases.find(item => item.words.some(word => normalized === normalize(word)));
      return match ? knownModelById(match.id) : null;
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

    function showAvailableActions() {
      return [
        { id: 'show_available', label: options.t('assistantV2.showAvailable') },
        { id: 'back', label: options.t('assistantV2.back') },
      ];
    }

    function availableListResponse() {
      const available = options.models();
      const first = available[0] || null;
      if (first) context.lastModelId = first.id;
      return pushResponse({
        type: 'availability_list',
        text: available.length
          ? `${options.t('assistantV2.inStock')}: ${available.map(model => options.modelText(model, 'title')).join(', ')}.`
          : options.t('assistantV2.availableAlternatives'),
        modelId: first?.id,
        actions: first ? recommendationActions(first) : showAvailableActions(),
      });
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
        kitchen: ['miniPro', 'mini3', 'light2'],
        bedroom: ['light2', 'mini3'],
        country: ['street', 'light2', 'mini3'],
        elderly: ['mini3', 'light2'],
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
      const reasonKey = {
        kitchen: 'home',
        bedroom: 'child',
        country: 'home',
        elderly: 'home',
      }[scenarioId] || scenarioId;
      return pushResponse({
        type: 'recommendation',
        text: `${options.t('assistant.recommend')} ${options.modelText(model, 'title')}. ${options.t(`assistant.scenarios.${reasonKey}.reason`)}`,
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

    function isColorListQuestion(input) {
      const normalized = normalize(input);
      return normalized.includes(ru(1094,1074,1077,1090)) &&
        (normalized.includes(ru(1082,1072,1082,1080,1077)) || normalized.includes('what') || normalized.includes('which'));
    }

    function colorListResponse() {
      const colors = Array.from(new Set(options.models()
        .flatMap(model => model.photos || [])
        .map(photo => photo.colorKey)
        .filter(Boolean)));
      return pushResponse({
        type: 'color_list',
        text: colors.length
          ? `${ru(1057,1077,1081,1095,1072,1089,32,1076,1086,1089,1090,1091,1087,1085,1099,32,1094,1074,1077,1090,1072)}: ${colors.map(colorLabel).join(', ')}.`
          : options.t('faq.fallback'),
        actions: [{ id: 'back', label: options.t('assistantV2.back') }],
      });
    }

    function modelResponse(model) {
      const available = modelById(model.id);
      if (!available) return availabilityResponse(model, false);
      context.awaiting = null;
      context.lastModelId = available.id;
      context.alternatives = options.models().filter(item => item.id !== available.id).map(item => item.id);
      const line = options.modelText(available, 'line') || options.modelText(available, 'description') || '';
      return pushResponse({
        type: 'model',
        text: `${options.modelText(available, 'title')}. ${line}`.trim(),
        modelId: available.id,
        colorKey: context.color,
        actions: recommendationActions(available),
      });
    }

    function availabilityResponse(model, available = Boolean(modelById(model?.id))) {
      if (!model) {
        return pushResponse({
          type: 'fallback',
          text: options.t('faq.fallback'),
          actions: [{ id: 'back', label: options.t('assistantV2.back') }],
        });
      }
      const current = modelById(model.id);
      if (available && current) {
        context.lastModelId = current.id;
        context.alternatives = options.models().filter(item => item.id !== current.id).map(item => item.id);
        return pushResponse({
          type: 'availability',
          text: `${options.t('assistantV2.inStock')}: ${options.modelText(current, 'title')}.`,
          modelId: current.id,
          colorKey: context.color,
          actions: recommendationActions(current),
        });
      }
      context.lastModelId = model.id;
      context.alternatives = options.models().map(item => item.id);
      return pushResponse({
        type: 'availability_unavailable',
        text: `${options.t('assistantV2.outOfStock')}: ${options.modelText(model, 'title')}. ${options.t('assistantV2.availableAlternatives')}`,
        modelId: model.id,
        actions: showAvailableActions(),
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

    function faqResponse(input) {
      const faq = options.findFaq(input);
      if (!faq.matched) return null;
      return pushResponse({
        type: 'faq',
        text: faq.answer,
        faq,
        actions: faq.faq?.id === 'model_difference'
          ? [{ id: 'compare', label: options.t('assistantV2.compare') }, { id: 'back', label: options.t('assistantV2.back') }]
          : [{ id: 'back', label: options.t('assistantV2.back') }],
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
      const notMoreRu = ru(1085,1077,32,1076,1086,1088,1086,1078,1077);
      return /(?:^| )(under|up to|max|eur|euro|€) ?\d+/.test(normalized) ||
        (/\d+/.test(normalized) && normalized.includes(notMoreRu)) ||
        normalized.includes(euroRu) ||
        new RegExp(`(?:^| )${upToRu} \\d+`).test(normalized);
    }

    function isHigherBudget(input) {
      return hasAny(input, [
        ru(1087,1086,1076,1086,1088,1086,1078,1077),
        ru(1076,1086,1088,1086,1078,1077),
        ru(1073,1077,1079,32,1086,1075,1088,1072,1085,1080,1095,1077,1085,1080,1081),
        'more expensive',
        'higher budget',
      ]);
    }

    function handle(input) {
      remember(input);
      if (!normalize(input)) return clarify();
      if (isSmallTalk(input)) {
        return pushResponse({
          type: 'smalltalk',
          text: options.t('assistantV2.clarifyPurpose'),
          actions: [
            { id: 'scenario', scenarioId: 'music', label: options.t('assistant.scenarios.music.label') },
            { id: 'scenario', scenarioId: 'home', label: options.t('assistant.scenarios.home.label') },
            { id: 'scenario', scenarioId: 'child', label: options.t('assistant.scenarios.child.label') },
            { id: 'scenario', scenarioId: 'gift', label: options.t('assistant.scenarios.gift.label') },
          ],
        });
      }
      if (isUnsupportedProduct(input)) {
        return pushResponse({
          type: 'fallback',
          text: options.t('faq.fallback'),
          actions: [{ id: 'back', label: options.t('assistantV2.back') }],
        });
      }
      const color = detectColor(input);
      if (color) context.color = color;

      if (sameIntent(input, [
        options.t('assistantV2.anotherOption'),
        'another option',
        'next',
        ru(1077,1097,1077,32,1074,1072,1088,1080,1072,1085,1090),
        ru(1072,32,1077,1097,1077),
        ru(1072,32,1077,1097,1105),
        ru(1077,1089,1090,1100,32,1083,1091,1095,1096,1077),
        ru(1077,1089,1090,1100,32,1082,1086,1084,1087,1072,1082,1090,1085,1077,1077),
        ru(1077,1089,1090,1100,32,1084,1086,1097,1085,1077,1077)
      ])) return nextAlternative();
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
      if (hasAny(input, [ru(1082,1091,1093,1085,1103), ru(1082,1091,1093,1085,1080)])) return scenarioAnswer('kitchen');
      if (hasAny(input, [ru(1089,1087,1072,1083,1100,1085,1103), ru(1089,1087,1072,1083,1100,1085,1080)])) return scenarioAnswer('bedroom');
      if (hasAny(input, [ru(1076,1072,1095,1072), ru(1076,1072,1095,1080)])) return scenarioAnswer('country');
      if (hasAny(input, [ru(1087,1086,1078,1080,1083,1086,1075,1086), ru(1076,1083,1103,32,1087,1086,1078,1080,1083,1086,1075,1086)])) return scenarioAnswer('elderly');
      if (hasAny(input, SYNONYMS.home)) return scenarioAnswer('home');

      if (hasAny(input, SYNONYMS.compare)) return compareResponse();

      const model = detectModel(input);
      if (model && hasAny(input, SYNONYMS.availability)) return availabilityResponse(model);
      if (model) return modelResponse(model);

      if (sameIntent(input, [options.t('assistantV2.showProduct'), 'show in catalog', 'show product', ru(1087,1086,1082,1072,1079,1072,1090,1100,32,1074,32,1082,1072,1090,1072,1083,1086,1075,1077), ru(1087,1086,1082,1072,1079,1072,1090,1100), ru(1086,1090,1082,1088,1099,1090,1100)])) {
        const selected = modelById(context.lastModelId);
        if (selected) return modelResponse(selected);
      }

      if (sameIntent(input, [ru(1079,1072,1082,1088,1099,1090,1100), 'close'])) {
        return pushResponse({
          type: 'close',
          text: '',
          actions: [],
        });
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

      if (isHigherBudget(input)) {
        return nextAlternative();
      }

      if (isColorListQuestion(input)) return colorListResponse();
      if (color) return colorResponse(color);
      if (hasAny(input, SYNONYMS.availability)) return availableListResponse();

      if (hasAny(input, SYNONYMS.delivery)) {
        const response = faqResponse('delivery');
        if (response) return response;
      }
      if (hasAny(input, SYNONYMS.setup)) {
        const response = faqResponse('setup');
        if (response) return response;
      }
      if (hasAny(input, SYNONYMS.latvia)) {
        const response = faqResponse('latvia');
        if (response) return response;
      }

      if (hasAny(input, SYNONYMS.station) && normalize(input).split(' ').length <= 3) return clarify();

      const faq = faqResponse(input);
      if (faq) return faq;

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
