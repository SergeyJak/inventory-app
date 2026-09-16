/* Regression fixes for audited HeySmart assistant conversations. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function locale() {
    const value = String(root?.catalogPageLocale || root?.document?.documentElement?.lang || 'en').toLowerCase();
    return ['ru', 'en', 'lv'].includes(value) ? value : 'en';
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  }

  function unsupportedLanguageResponse(input) {
    const normalized = String(input || '').toLowerCase();
    if (!/(?:uzbek|o['’]?zbek|узбек)/i.test(normalized)) return null;
    const text = {
      ru: 'У меня нет подтверждённой информации, что Алиса поддерживает узбекский язык. Перед покупкой лучше проверить актуальный список поддерживаемых языков Яндекса.',
      en: 'I do not have confirmed information that Alice supports Uzbek. Before buying, please check Yandex’s current list of supported languages.',
      lv: 'Man nav apstiprinātas informācijas, ka Alise atbalsta uzbeku valodu. Pirms pirkuma pārbaudiet Yandex aktuālo atbalstīto valodu sarakstu.',
    }[locale()];
    return { type: 'language_uncertain', intent: 'faq_question', text, actions: [], faq: { matched: true, confidence: 1, faq: null, answer: text } };
  }

  function handoffResponse(input, options) {
    const handoff = root?.HeySmartAssistantHandoff;
    if (!handoff?.isHandoffRequest?.(input)) return null;
    const methods = (typeof options.contactMethods === 'function' ? options.contactMethods() : [])
      .filter(item => item?.id === 'whatsapp' || item?.id === 'telegram');
    const labels = methods.map(item => item?.label).filter(Boolean);
    const text = handoff.handoffText(locale(), labels);
    return {
      type: 'human_handoff', intent: 'human_handoff', text,
      actions: methods.map(item => ({ id: 'contact', channel: item.id, label: item.label })),
      faq: { matched: true, confidence: 1, faq: null, answer: text },
    };
  }

  function modelAliases(model, options) {
    return [model.id, ...(model.aliases || []), options.modelText?.(model, 'title'), options.modelText?.(model, 'short')]
      .map(normalize).filter(Boolean).sort((a, b) => b.length - a.length);
  }

  function directComparisonResponse(input, options) {
    const text = normalize(input);
    const models = typeof options.models === 'function' ? options.models() : [];
    const mentioned = models.filter(model => modelAliases(model, options).some(alias => text.includes(alias)));
    const unique = mentioned.filter((model, index) => mentioned.findIndex(item => item.id === model.id) === index);
    if (unique.length < 2) return null;

    const comparisonIntent = /(?:сравн|отлич|разниц|\bvs\b|\bcompare\b|\bdifference\b|sal[iī]dzin|at[sš]k[iī]r)/i.test(text);
    if (!comparisonIntent) return null;

    const selected = unique.slice(0, 2);
    const lines = selected.map(model => {
      const title = options.modelText?.(model, 'title') || model.title || model.id;
      const price = Number(model.price) > 0 ? ` ${Number(model.price)} €` : '';
      const detail = options.modelText?.(model, 'line') || options.modelText?.(model, 'description') || '';
      return `${title}${price}${detail ? `: ${detail}` : ''}`;
    });
    const lead = { ru: 'Сравнение:', en: 'Comparison:', lv: 'Salīdzinājums:' }[locale()];
    const result = `${lead} ${lines.join(' | ')}`;
    return {
      type: 'compare', intent: 'model_comparison', text: result,
      modelIds: selected.map(model => model.id), actions: [],
      faq: { matched: true, confidence: 1, faq: null, answer: result },
    };
  }

  function recommendationText(response, engine, options) {
    if (response?.type !== 'recommendation' || !response.modelId) return response;
    const scenario = engine?.snapshot?.().selectedScenario;
    if (!scenario) return response;
    const model = (typeof options.models === 'function' ? options.models() : []).find(item => item.id === response.modelId);
    if (!model) return response;
    const title = options.modelText?.(model, 'title') || model.title || response.modelId;
    const price = Number(model.price) > 0 ? ` ${Number(model.price)} €` : '';
    const lead = options.t?.('assistant.recommend') || ({ ru: 'Рекомендую:', en: 'I recommend:', lv: 'Iesaku:' }[locale()]);
    const reason = {
      ru: 'Эта модель лучше всего подходит под выбранный сценарий из моделей, которые сейчас есть в каталоге.',
      en: 'This model is the best fit for the selected use case among the models currently shown in the catalog.',
      lv: 'Šis modelis vislabāk atbilst izvēlētajam lietošanas scenārijam no pašlaik katalogā redzamajiem modeļiem.',
    }[locale()];
    return { ...response, text: `${lead} ${title}${price}. ${reason}` };
  }

  function normalizeAnalytics(response) {
    if (!response || response.faq) return response;
    const handled = response.type && !['fallback', 'noise_or_test'].includes(response.type);
    return { ...response, faq: { matched: Boolean(handled), confidence: handled ? 1 : 0, faq: null, answer: response.text || '' } };
  }

  function installContactNavigation() {
    const doc = root?.document;
    if (!doc?.addEventListener || doc.__assistantContactNavigationInstalled) return;
    doc.addEventListener('click', event => {
      const action = event.target?.closest?.('.assistant-action[data-action="contact"][data-channel]');
      if (!action) return;
      const channel = action.dataset.channel;
      const url = channel === 'whatsapp' ? 'https://wa.me/37126198525' : channel === 'telegram' ? 'https://t.me/alicestation' : '';
      if (!url) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      root.location.href = url;
    }, true);
    doc.__assistantContactNavigationInstalled = true;
  }

  function install() {
    const assistant = root?.AssistantEngine;
    if (!assistant?.createAssistantEngine || assistant.__auditFixesInstalled) return false;
    const originalCreate = assistant.createAssistantEngine.bind(assistant);
    assistant.createAssistantEngine = function (options) {
      const engine = originalCreate(options);
      if (!engine?.handle) return engine;
      const originalHandle = engine.handle.bind(engine);
      return {
        ...engine,
        handle(input) {
          const directHandoff = handoffResponse(input, options);
          if (directHandoff) return directHandoff;
          const language = unsupportedLanguageResponse(input);
          if (language) return language;
          const comparison = directComparisonResponse(input, options);
          if (comparison) return comparison;
          const response = originalHandle(input);
          return normalizeAnalytics(recommendationText(response, engine, options));
        },
      };
    };
    assistant.__auditFixesInstalled = true;
    installContactNavigation();
    return true;
  }

  if (root?.AssistantEngine) install();
  return { install, unsupportedLanguageResponse, handoffResponse, directComparisonResponse, recommendationText, normalizeAnalytics, installContactNavigation };
});
