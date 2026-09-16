/* Focused model-to-model comparison responses for the HeySmart assistant. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  }

  function locale() {
    const value = String(root?.catalogPageLocale || root?.document?.documentElement?.lang || 'ru').toLowerCase();
    return ['ru', 'en', 'lv'].includes(value) ? value : 'en';
  }

  function aliases(model, options) {
    return [model.id, ...(model.aliases || []), options.modelText?.(model, 'title'), options.modelText?.(model, 'short')]
      .map(normalize).filter(Boolean).sort((a, b) => b.length - a.length);
  }

  function mentionedModels(input, options) {
    const text = normalize(input);
    const models = typeof options.models === 'function' ? options.models() : [];
    return models.filter(model => aliases(model, options).some(alias => text.includes(alias)))
      .filter((model, index, all) => all.findIndex(item => item.id === model.id) === index);
  }

  function isComparison(input) {
    return /(?:сравн|отлич|разниц|\bvs\b|\bcompare\b|\bdifference\b|sal[iī]dzin|at[sš]k[iī]r)/i.test(normalize(input));
  }

  const PROFILES = {
    ru: {
      mini3: 'компактнее, рассчитана на небольшую комнату и повседневное прослушивание; звук легче и менее масштабный',
      midi: 'заметно крупнее и мощнее; звучание более объёмное и насыщенное, с более выраженным басом',
      miniPro: 'компактная, но с усиленным звуком и возможностями центра умного дома',
      light2: 'самая компактная из этих моделей, удобна для небольшой комнаты, детской или рабочего стола',
      street: 'портативная модель для использования вне дома',
    },
    en: {
      mini3: 'more compact, aimed at smaller rooms and everyday listening; its sound is lighter and less room-filling',
      midi: 'noticeably larger and more powerful; its sound is fuller and richer, with stronger bass',
      miniPro: 'compact, with stronger sound and smart-home hub capabilities',
      light2: 'very compact and suited to a small room, kids room or desk',
      street: 'portable and designed for use away from home',
    },
    lv: {
      mini3: 'kompaktāka, piemērota mazākai telpai un ikdienas klausīšanai; skanējums ir vieglāks un mazāk jaudīgs',
      midi: 'ievērojami lielāka un jaudīgāka; skanējums ir pilnīgāks un piesātinātāks, ar izteiktāku basu',
      miniPro: 'kompakta, ar jaudīgāku skaņu un viedās mājas centra iespējām',
      light2: 'ļoti kompakta, piemērota mazai telpai, bērnistabai vai darba galdam',
      street: 'pārnēsājama un paredzēta lietošanai ārpus mājas',
    },
  };

  function comparisonResponse(input, options) {
    if (!isComparison(input)) return null;
    const selected = mentionedModels(input, options).slice(0, 2);
    if (selected.length < 2) return null;

    const lang = locale();
    const profile = PROFILES[lang];
    const lines = selected.map(model => {
      const title = options.modelText?.(model, 'title') || model.title || model.id;
      const price = Number(model.price) > 0 ? `${Number(model.price)} €` : '';
      const difference = profile[model.id] || options.modelText?.(model, 'line') || options.modelText?.(model, 'description') || '';
      return `${title}${price ? ` (${price})` : ''}: ${difference}.`;
    });
    const conclusion = {
      ru: 'Если важнее компактность, выбирайте более компактную модель; если приоритет — мощность, объём звучания и бас, смотрите в сторону более мощной.',
      en: 'If compactness matters more, choose the smaller model; if power, fuller sound and bass matter more, look at the more powerful one.',
      lv: 'Ja svarīgāks ir kompaktums, izvēlieties mazāko modeli; ja prioritāte ir jauda, pilnīgāks skanējums un bass, skatieties uz jaudīgāko modeli.',
    }[lang];
    const lead = { ru: 'Главные отличия:', en: 'Main differences:', lv: 'Galvenās atšķirības:' }[lang];
    const text = `${lead}\n${lines.join('\n')}\n${conclusion}`;
    return {
      type: 'compare', intent: 'model_comparison', text,
      modelIds: selected.map(model => model.id), actions: [],
      faq: { matched: true, confidence: 1, faq: null, answer: text },
    };
  }

  function install() {
    const assistant = root?.AssistantEngine;
    if (!assistant?.createAssistantEngine || assistant.__comparisonFixesInstalled) return false;
    const originalCreate = assistant.createAssistantEngine.bind(assistant);
    assistant.createAssistantEngine = function (options) {
      const engine = originalCreate(options);
      if (!engine?.handle) return engine;
      const originalHandle = engine.handle.bind(engine);
      return {
        ...engine,
        handle(input) {
          return comparisonResponse(input, options) || originalHandle(input);
        },
      };
    };
    assistant.__comparisonFixesInstalled = true;
    return true;
  }

  if (root?.AssistantEngine) install();
  return { install, comparisonResponse, mentionedModels, isComparison };
});
