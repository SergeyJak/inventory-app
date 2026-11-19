/* Regression fixes for audited HeySmart assistant conversations. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function pageLocale() {
    const value = String(root?.catalogPageLocale || root?.document?.documentElement?.lang || 'en').toLowerCase();
    return ['ru', 'en', 'lv'].includes(value) ? value : 'en';
  }

  function detectInputLocale(input) {
    const raw = String(input || '').trim();
    if (!raw) return pageLocale();
    if (/[а-яё]/i.test(raw)) return 'ru';
    if (/[āčēģīķļņšūž]/i.test(raw)) return 'lv';

    const normalized = raw.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const lvHints = new Set(['vai','alise','latvija','latvija','piegade','piegadi','piegadat','cik','maksa','maksat','varu','var','ir','bernam','majam','anglu','krievu','valoda','valodu','skaļrunis','skalrunis']);
    const lvHits = tokens.filter(token => lvHints.has(token)).length;
    if (lvHits >= 2) return 'lv';
    if (/[a-z]/i.test(raw)) return 'en';
    return pageLocale();
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  }

  function unsupportedLanguageResponse(input) {
    const normalized = String(input || '').toLowerCase();
    const asksAboutEnglish = /(?:english|engleesh|английск|angļu|anglu)/i.test(normalized) &&
      /(?:alice|alisa|station|speaker|алис|станц|колон|understand|speak|language|язык|valod)/i.test(normalized);
    if (asksAboutEnglish) {
      const text = {
        ru: 'Нет, Алиса на Яндекс Станции не поддерживает английский язык. Голосовой ассистент работает на русском языке.',
        en: 'No. Alice on Yandex Station does not support English. The voice assistant works in Russian.',
        lv: 'Nē. Alise Yandex Station neatbalsta angļu valodu. Balss asistents darbojas krievu valodā.',
      }[detectInputLocale(input)];
      return { type: 'language_unsupported', intent: 'faq_question', locale: detectInputLocale(input), text, actions: [], faq: { matched: true, confidence: 1, faq: null, answer: text } };
    }
    if (!/(?:uzbek|o['’]?zbek|узбек)/i.test(normalized)) return null;
    const text = {
      ru: 'У меня нет подтверждённой информации, что Алиса поддерживает узбекский язык. Перед покупкой лучше проверить актуальный список поддерживаемых языков Яндекса.',
      en: 'I do not have confirmed information that Alice supports Uzbek. Before buying, please check Yandex’s current list of supported languages.',
      lv: 'Man nav apstiprinātas informācijas, ka Alise atbalsta uzbeku valodu. Pirms pirkuma pārbaudiet Yandex aktuālo atbalstīto valodu sarakstu.',
    }[detectInputLocale(input)];
    return { type: 'language_uncertain', intent: 'faq_question', locale: detectInputLocale(input), text, actions: [], faq: { matched: true, confidence: 1, faq: null, answer: text } };
  }


  function auditedAnswer(input, type, text) {
    return { type, intent: 'faq_question', locale: detectInputLocale(input), text, actions: [],
      faq: { matched: true, confidence: 1, faq: null, answer: text } };
  }

  // Facts from Yandex docs: Street has a built-in 12h battery; Mini 3 Pro
  // can use a separate, optional 7h battery. Do not promise accessory stock.
  function powerGuidanceResponse(input, context) {
    const raw = String(input || '');
    if (!/(заряж|заряд|аккумулятор|акумулятор|батаре|розетк|battery|charg|power pack|uzl[aā]d|akumulator|baterij)/i.test(raw)) return null;
    if (/(прода|купить|заказ|налич|sell|buy|purchase|stock|order|p[aā]rdod|pirkt)/i.test(raw)) return null;
    const n = normalize(input);
    const model = /стрит|street/.test(n) ? 'street'
      : /мини\s*(?:3\s*)?(?:про|pro)|mini\s*(?:3\s*)?pro/.test(n) ? 'miniPro'
      : /мини\s*3|mini\s*3|лайт\s*2|light\s*2|lite\s*2|миди|midi/.test(n) ? 'stationary'
      : context?.lastModelId || 'unknown';
    const lasting = /(сколько|хватит|держит|долго|время работы|на сколько|how long|battery life|last|cik ilgi|cik stund)/i.test(n);
    const messages = {
      ru: {
        street: lasting ? 'У Станции Стрит встроенный аккумулятор: до 12 часов музыки. Время зависит от громкости.' : 'Станция Стрит заряжается через USB-C. Полная зарядка занимает около 2,5 часа.',
        miniPro: lasting ? 'Мини 3 Про без аккумулятора работает от розетки. С отдельно приобретаемым фирменным аккумулятором она играет до 7 часов на средней громкости.' : 'Мини 3 Про работает от розетки. Дополнительный фирменный аккумулятор приобретается отдельно и заряжается через USB-C примерно за 2 часа.',
        stationary: 'Эта Станция работает от розетки и не имеет встроенного аккумулятора. Заряжать её не нужно, используйте штатный блок питания.',
        unknown: lasting ? 'Стрит работает до 12 часов от встроенного аккумулятора; Мини 3 Про с отдельным аккумулятором — до 7 часов. Лайт 2, Мини 3 и Миди работают от сети. Какая модель вас интересует?' : 'Стрит заряжается через USB-C; у Мини 3 Про есть отдельный аккумулятор. Лайт 2, Мини 3 и Миди работают от сети и не требуют зарядки. Какая у вас модель?',
      },
      en: {
        street: lasting ? 'Station Street has a built-in battery for up to 12 hours of music, depending on volume.' : 'Charge Station Street via USB-C. A full charge takes about 2.5 hours.',
        miniPro: lasting ? 'Mini 3 Pro normally uses mains power. With its separately purchased official battery it can play music for up to 7 hours at medium volume.' : 'Mini 3 Pro uses mains power. Its optional official battery is sold separately and charges via USB-C in about 2 hours.',
        stationary: 'This Station needs mains power and has no built-in rechargeable battery. Keep it connected to its power adapter.',
        unknown: lasting ? 'Street lasts up to 12 hours on its built-in battery; Mini 3 Pro up to 7 hours with a separate battery. Lite 2, Mini 3 and Midi use mains power. Which model?' : 'Street charges via USB-C; Mini 3 Pro has an optional separate battery. Lite 2, Mini 3 and Midi require mains power. Which model do you have?',
      },
      lv: {
        street: lasting ? 'Station Street iebūvētais akumulators darbojas līdz 12 stundām, atkarībā no skaļuma.' : 'Station Street uzlādē ar USB-C; pilna uzlāde aizņem aptuveni 2,5 stundas.',
        miniPro: lasting ? 'Mini 3 Pro parasti darbojas no elektrotīkla. Ar atsevišķi nopērkamu oriģinālo akumulatoru tā darbojas līdz 7 stundām.' : 'Mini 3 Pro darbojas no elektrotīkla. Papildu akumulatoru pārdod atsevišķi, un tas uzlādējas ar USB-C aptuveni 2 stundās.',
        stationary: 'Šī Station darbojas no elektrotīkla, un tai nav iebūvēta akumulatora. Pievienojiet barošanas bloku.',
        unknown: lasting ? 'Street akumulators darbojas līdz 12 stundām; Mini 3 Pro ar atsevišķu akumulatoru — līdz 7 stundām. Lite 2, Mini 3 un Midi darbojas no elektrotīkla. Kurš modelis?' : 'Street uzlādē ar USB-C, Mini 3 Pro ir atsevišķs akumulators. Lite 2, Mini 3 un Midi darbojas no elektrotīkla. Kurš modelis?',
      },
    };
    const key = model === 'light2' || model === 'mini3' || model === 'midi' ? 'stationary' : model;
    return auditedAnswer(input, 'power_guidance', messages[detectInputLocale(input)][messages.ru[key] ? key : 'unknown']);
  }

  function vpnGuidanceResponse(input, options) {
    if (!/(?:\bvpn\b|впн|вэпээн)/i.test(input)) return null;
    const text = {
      ru: 'Для первичной настройки в Латвии иногда нужен VPN с российским IP-адресом. Проверьте доступность сервера в России: она меняется. Можем помочь подобрать и настроить подключение через WhatsApp или Telegram.',
      en: 'Initial setup in Latvia may require a VPN with a Russian IP address. Check that the provider has a working Russian server, as availability changes. We can help via WhatsApp or Telegram.',
      lv: 'Sākotnējai iestatīšanai Latvijā dažkārt vajadzīgs VPN ar Krievijas IP adresi. Serveru pieejamība mainās. Varam palīdzēt WhatsApp vai Telegram.',
    }[detectInputLocale(input)];
    const methods = (typeof options.contactMethods === 'function' ? options.contactMethods() : [])
      .filter(item => item?.id === 'whatsapp' || item?.id === 'telegram');
    const response = auditedAnswer(input, 'vpn_setup', text);
    response.actions = methods.map(item => ({ id: 'contact', channel: item.id, label: item.label }));
    return response;
  }

  function greetingResponse(input) {
    const n = normalize(input);
    if (!/^(?:(?:сережа|сергей)\s+)?(?:привет|здравствуйте|добрый день|добрый вечер|hello|hi|hey)(?:\s+(?:сережа|сергей))?$/.test(n)) return null;
    const text = {
      ru: 'Здравствуйте! Помогу выбрать колонку, объяснить настройку или уточнить доставку. Что вас интересует?',
      en: 'Hello! I can help with choosing a speaker, setup or delivery. What would you like to know?',
      lv: 'Sveiki! Varu palīdzēt izvēlēties skaļruni, iestatīt to vai uzzināt par piegādi. Kā varu palīdzēt?',
    }[detectInputLocale(input)];
    return auditedAnswer(input, 'greeting', text);
  }

  function wifiCapabilitiesResponse(input) {
    const raw = String(input || '');
    const wifi = /(?:wi[\s-]?fi|вай\s?фай|вайфай|wifi|вай\s?фай)/i.test(raw);
    const question = /(?:есть|имеется|поддерж|работает|можно|умеет|нужен|нужна|у нее|у неё|хочу|ищу|подключ|надо|want|looking|need|does|have|has|support|work|vai|atbalsta|ir)/i.test(raw);
    if (!wifi || !question) return null;
    const lang = detectInputLocale(input);
    const text = {
      ru: 'Да, Яндекс Станции поддерживают Wi-Fi. Для работы Алисы и потоковой музыки нужен доступ к интернету. Подключение и настройка выполняются через приложение Яндекса.',
      en: 'Yes, Yandex Station speakers support Wi-Fi. Alice and music streaming require an internet connection. Setup is done through the Yandex app.',
      lv: 'Jā, Yandex Station skaļruņi atbalsta Wi-Fi. Alises darbībai un mūzikas straumēšanai nepieciešams internets. Iestatīšana notiek Yandex lietotnē.',
    }[lang];
    return { type: 'wifi_capabilities', intent: 'faq_question', locale: lang, text, actions: [], faq: { matched: true, confidence: 1, faq: null, answer: text } };
  }


  // A purchase request for a spare battery is not proof that we sell one.
  function batteryAvailabilityResponse(input, options) {
    const raw = String(input || '');
    if (!/(?:аккумулятор|акумулятор|батаре[яйию]|battery|akumulator)/i.test(raw) ||
        !/(?:прода|купить|заказать|заказ|налич|отдельн|sell|buy|purchase|stock|order|p[aā]rdod|pirkt)/i.test(raw)) return null;
    const locale = detectInputLocale(input);
    const messages = {
      ru: 'Уточните, пожалуйста, для какой модели нужен аккумулятор. Наличие отдельного аккумулятора пока не подтверждено. Мы можем уточнить возможность заказа через WhatsApp или Telegram.',
      en: 'Which speaker model do you need a battery for? We have not confirmed that a separate battery is available. Please contact us via WhatsApp or Telegram so we can check.',
      lv: 'Kādam skaļruņa modelim nepieciešams akumulators? Atsevišķa akumulatora pieejamība nav apstiprināta. Sazinieties ar mums WhatsApp vai Telegram, lai to precizētu.',
    };
    const text = messages[locale];
    const methods = (typeof options.contactMethods === 'function' ? options.contactMethods() : [])
      .filter(item => item?.id === 'whatsapp' || item?.id === 'telegram');
    return {
      type: 'accessory_clarification', intent: 'accessory_availability', locale, text,
      actions: methods.map(item => ({ id: 'contact', channel: item.id, label: item.label })),
      faq: { matched: false, confidence: 0, faq: null, answer: text },
    };
  }

  function ambiguousProResponse(input, previousContext) {
    const normalized = normalize(input);
    if (!/(?:^| )(?:2|две|два) про(?:$| )/.test(normalized) ||
        /(?:мини|mini) (?:3 )?(?:про|pro)/.test(normalized)) return null;
    const locale = detectInputLocale(input);
    const wasMiniPro = previousContext?.lastModelId === 'miniPro';
    const messages = {
      ru: wasMiniPro
        ? 'Ранее мы обсуждали Мини 3 Про. Вы хотите две колонки Мини 3 Про или спрашиваете о другой модели «2 Про»?'
        : 'Уточните: вы хотите две колонки Мини 3 Про или спрашиваете о модели «2 Про»?',
      en: 'Do you mean two Mini 3 Pro speakers, or a different model called “2 Pro”?',
      lv: 'Vai vēlaties divas Mini 3 Pro skandas vai jautājat par citu modeli “2 Pro”?',
    };
    const text = messages[locale];
    return {
      type: 'product_clarification', intent: 'product_selection', locale, text, actions: [],
      faq: { matched: false, confidence: 0, faq: null, answer: text },
    };
  }

  function twoMiniProQuantityResponse(input, options, awaitingConfirmation) {
    const normalized = normalize(input);
    const explicitTwoMiniPro = /(?:^| )(?:2|две|два) (?:мини|mini) (?:3 )?(?:про|pro)(?:$| )/.test(normalized);
    const shortConfirmation = awaitingConfirmation && /^(?:2|две|два)(?: штуки| шт| колонки)?$/.test(normalized);
    if (!explicitTwoMiniPro && !shortConfirmation) return null;
    const locale = detectInputLocale(input);
    const messages = {
      ru: 'Понял, вам нужны две Станции Мини 3 Про. Наличие именно двух штук необходимо подтвердить. Напишите в WhatsApp или Telegram, и мы проверим заказ.',
      en: 'You would like two Mini 3 Pro speakers. We need to confirm that two units are available. Contact us via WhatsApp or Telegram to check your order.',
      lv: 'Jums nepieciešamas divas Mini 3 Pro skandas. Divu vienību pieejamība ir jāapstiprina. Sazinieties WhatsApp vai Telegram, lai pārbaudītu pasūtījumu.',
    };
    const text = messages[locale];
    const methods = (typeof options.contactMethods === 'function' ? options.contactMethods() : [])
      .filter(item => item?.id === 'whatsapp' || item?.id === 'telegram');
    return {
      type: 'quantity_handoff', intent: 'product_selection', locale, text, modelId: 'miniPro',
      actions: methods.map(item => ({ id: 'contact', channel: item.id, label: item.label })),
      faq: { matched: true, confidence: 1, faq: null, answer: text },
    };
  }

  function handoffResponse(input, options) {
    const handoff = root?.HeySmartAssistantHandoff;
    if (!handoff?.isHandoffRequest?.(input)) return null;
    const methods = (typeof options.contactMethods === 'function' ? options.contactMethods() : [])
      .filter(item => item?.id === 'whatsapp' || item?.id === 'telegram');
    const labels = methods.map(item => item?.label).filter(Boolean);
    const text = handoff.handoffText(detectInputLocale(input), labels);
    return {
      type: 'human_handoff', intent: 'human_handoff', locale: detectInputLocale(input), text,
      actions: methods.map(item => ({ id: 'contact', channel: item.id, label: item.label })),
      faq: { matched: true, confidence: 1, faq: null, answer: text },
    };
  }

  function internationalShippingResponse(input, options) {
    const raw = String(input || '');
    const normalized = normalize(raw);
    const shippingRequested = /(?:ship|shipping|deliver|delivery|courier|достав|отправ|pieg[aā]d)/i.test(raw);
    const greece = /(?:greece|greek|korinth|corinth|греци)/i.test(raw);
    const international = greece ||
      /(?:germany|deutschland|германи|vācij|vaciju|sweden|швец|zviedrij|finland|финлянди|somij|estonia|эстони|igaunij|uk|united kingdom|britain|англи|британи|lielbritanij|poland|польш|polij|lithuania|литв|lietuva|cyprus|кипр|kipr|bulgaria|болгари|bulgarij)/i.test(raw) ||
      /(?:abroad|international|europe|europa|европ|за границ)/i.test(raw) ||
      /\b(?:ship|deliver)\s+(?:it\s+)?to\s+[a-z]/i.test(raw);
    if (!shippingRequested || !international) return null;

    const availableModels = typeof options.models === 'function' ? options.models() : [];
    const knownModels = typeof options.knownModels === 'function' ? options.knownModels() : availableModels;
    const mentioned = knownModels
      .flatMap(model => modelAliases(model, options).map(alias => ({ model, alias })))
      .filter(item => item.alias && normalized.includes(item.alias))
      .sort((left, right) => right.alias.length - left.alias.length)[0]?.model || null;
    const available = mentioned ? availableModels.find(model => model.id === mentioned.id) : null;
    const title = mentioned ? (options.modelText?.(mentioned, 'title') || mentioned.title || mentioned.id) : '';
    const price = available && Number(available.price) > 0 ? Number(available.price) : 0;

    const productLine = title
      ? (available
        ? (price ? `${title} is currently in stock for €${price}. ` : `${title} is currently in stock. `)
        : `${title} is currently not in stock. `)
      : '';

    const textByLocale = greece ? {
      ru: `${title ? (available ? `${title}${price ? ` стоит €${price}` : ''} сейчас в наличии. ` : `${title} сейчас нет в наличии. `) : ''}Да, можем отправить заказ в Грецию, включая Коринф. Доставка стоит примерно €20. Оплата возможна через Revolut. Срок доставки подтвердим перед отправкой. Обратите внимание: Алиса на Яндекс Станции не поддерживает английский язык и работает на русском.`,
      en: `${productLine}Yes, we can ship to Greece, including Korinthos. Shipping is approximately €20. Payment can be made via Revolut. We will confirm the delivery time before dispatch. Please note that Alice on Yandex Station does not support English; the voice assistant works in Russian.`,
      lv: `${title ? (available ? `${title}${price ? ` maksā €${price}` : ''} pašlaik ir pieejama. ` : `${title} pašlaik nav noliktavā. `) : ''}Jā, varam nosūtīt pasūtījumu uz Grieķiju, tostarp Korintu. Piegāde maksā aptuveni €20. Apmaksu var veikt ar Revolut. Piegādes termiņu apstiprināsim pirms nosūtīšanas. Ņemiet vērā: Alise Yandex Station neatbalsta angļu valodu un darbojas krievu valodā.`,
    } : {
      ru: 'Доставка по Европе возможна курьерской службой. Стоимость зависит от страны и согласуется отдельно. Оплата возможна через Revolut. Срок доставки подтвердим перед отправкой. Для нерусскоязычных покупателей важно: Алиса на Яндекс Станции не поддерживает английский язык и работает на русском.',
      en: 'Courier delivery across Europe is available. Shipping cost depends on the destination and is confirmed separately. Payment can be made via Revolut. We will confirm the delivery time before dispatch. Please note that Alice on Yandex Station does not support English; the voice assistant works in Russian.',
      lv: 'Piegāde Eiropā ir iespējama ar kurjeru. Cena ir atkarīga no galamērķa un tiek saskaņota atsevišķi. Apmaksu var veikt ar Revolut. Piegādes termiņu apstiprināsim pirms nosūtīšanas. Ņemiet vērā: Alise Yandex Station neatbalsta angļu valodu un darbojas krievu valodā.',
    };

    const responseLocale = detectInputLocale(input);
    const text = textByLocale[responseLocale];
    const methods = (typeof options.contactMethods === 'function' ? options.contactMethods() : [])
      .filter(item => item?.id === 'whatsapp' || item?.id === 'telegram');
    return {
      type: 'international_shipping',
      intent: 'international_shipping',
      locale: responseLocale,
      text,
      modelId: mentioned?.id || '',
      actions: methods.map(item => ({ id: 'contact', channel: item.id, label: item.label })),
      faq: { matched: true, confidence: 1, faq: null, answer: text },
    };
  }

  function modelAliases(model, options) {
    return [model.id, ...(model.aliases || []), options.modelText?.(model, 'title'), options.modelText?.(model, 'short')]
      .map(normalize).filter(Boolean).sort((a, b) => b.length - a.length);
  }

  const COMPARISON_PROFILES = {
    ru: {
      mini3: 'компактнее, лучше подходит для небольшой комнаты и повседневного прослушивания; звучание легче и менее масштабное',
      midi: 'заметно крупнее и мощнее; звучание более объёмное и насыщенное, с более выраженным басом',
      miniPro: 'компактная, но с усиленным звуком и возможностями центра умного дома',
      light2: 'очень компактная, удобна для небольшой комнаты, детской или рабочего стола',
      street: 'портативная модель для использования вне дома',
    },
    en: {
      mini3: 'more compact and better suited to a smaller room and everyday listening; its sound is lighter and less room-filling',
      midi: 'noticeably larger and more powerful; its sound is fuller and richer, with stronger bass',
      miniPro: 'compact, with stronger sound and smart-home hub capabilities',
      light2: 'very compact and suited to a small room, kids room or desk',
      street: 'portable and designed for use away from home',
    },
    lv: {
      mini3: 'kompaktāka un labāk piemērota mazākai telpai un ikdienas klausīšanai; skanējums ir vieglāks un mazāk jaudīgs',
      midi: 'ievērojami lielāka un jaudīgāka; skanējums ir pilnīgāks un piesātinātāks, ar izteiktāku basu',
      miniPro: 'kompakta, ar jaudīgāku skaņu un viedās mājas centra iespējām',
      light2: 'ļoti kompakta, piemērota mazai telpai, bērnistabai vai darba galdam',
      street: 'pārnēsājama un paredzēta lietošanai ārpus mājas',
    },
  };

  function directComparisonResponse(input, options) {
    const text = normalize(input);
    if (!/(?:сравн|отлич|разниц|\bvs\b|\bcompare\b|\bdifference\b|sal[iī]dzin|at[sš]k[iī]r)/i.test(text)) return null;

    const availableModels = typeof options.models === 'function' ? options.models() : [];
    const knownModels = typeof options.knownModels === 'function' ? options.knownModels() : availableModels;
    const mentionedKnown = knownModels.filter(model => modelAliases(model, options).some(alias => text.includes(alias)));
    const mentionedIds = mentionedKnown.map(model => model.id)
      .filter((id, index, ids) => id && ids.indexOf(id) === index);
    if (mentionedIds.length < 2) return null;

    const selected = mentionedIds.slice(0, 2).map(id =>
      availableModels.find(model => model.id === id) || knownModels.find(model => model.id === id)
    ).filter(Boolean);
    if (selected.length < 2) return null;

    const lang = detectInputLocale(input);
    const profiles = COMPARISON_PROFILES[lang];
    const unavailableLabel = { ru: 'сейчас нет в наличии', en: 'currently out of stock', lv: 'pašlaik nav noliktavā' }[lang];
    const availableIds = new Set(availableModels.map(model => model.id));
    const lines = selected.map(model => {
      const title = options.modelText?.(model, 'title') || model.title || model.id;
      const availability = availableIds.has(model.id)
        ? (Number(model.price) > 0 ? `${Number(model.price)} €` : '')
        : unavailableLabel;
      const suffix = availability ? ` (${availability})` : '';
      const detail = profiles[model.id] || options.modelText?.(model, 'line') || options.modelText?.(model, 'description') || '';
      return `${title}${suffix}: ${detail}.`;
    });
    const lead = { ru: 'Главные отличия:', en: 'Main differences:', lv: 'Galvenās atšķirības:' }[lang];
    const conclusion = {
      ru: 'Если важнее компактность, выбирайте более компактную модель. Если приоритет — мощность, объём звучания и бас, выбирайте более мощную.',
      en: 'If compactness matters more, choose the smaller model. If power, fuller sound and bass matter more, choose the more powerful one.',
      lv: 'Ja svarīgāks ir kompaktums, izvēlieties mazāko modeli. Ja prioritāte ir jauda, pilnīgāks skanējums un bass, izvēlieties jaudīgāko.',
    }[lang];
    const result = `${lead}\n${lines.join('\n')}\n${conclusion}`;
    return {
      type: 'compare', intent: 'model_comparison', locale: lang, text: result,
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
    const lang = ['ru', 'en', 'lv'].includes(response.locale) ? response.locale : pageLocale();
    const title = options.modelText?.(model, 'title') || model.title || response.modelId;
    const price = Number(model.price) > 0 ? ` ${Number(model.price)} €` : '';
    const lead = options.t?.('assistant.recommend') || ({ ru: 'Рекомендую:', en: 'I recommend:', lv: 'Iesaku:' }[lang]);
    const reason = {
      ru: 'Эта модель лучше всего подходит под выбранный сценарий из моделей, которые сейчас есть в каталоге.',
      en: 'This model is the best fit for the selected use case among the models currently shown in the catalog.',
      lv: 'Šis modelis vislabāk atbilst izvēlētajam lietošanas scenārijam no pašlaik katalogā redzamajiem modeļiem.',
    }[lang];
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
      let activeLocale = pageLocale();
      const localizedOptions = {
        ...options,
        t: key => typeof options.tForLocale === 'function' ? options.tForLocale(key, activeLocale) : options.t(key),
        modelText: (model, key) => typeof options.modelTextForLocale === 'function'
          ? options.modelTextForLocale(model, key, activeLocale)
          : options.modelText(model, key),
        findFaq: input => typeof options.findFaqForLocale === 'function'
          ? options.findFaqForLocale(input, activeLocale)
          : options.findFaq(input),
      };
      const engine = originalCreate(localizedOptions);
      if (!engine?.handle) return engine;
      const originalHandle = engine.handle.bind(engine);
      let awaitingProClarification = false;
      return {
        ...engine,
        reset() {
          awaitingProClarification = false;
          return engine.reset?.();
        },
        handle(input) {
          activeLocale = detectInputLocale(input);
          const quantity = twoMiniProQuantityResponse(input, localizedOptions, awaitingProClarification);
          if (quantity) {
            awaitingProClarification = false;
            return quantity;
          }
          const ambiguousPro = ambiguousProResponse(input, engine.snapshot?.());
          awaitingProClarification = Boolean(ambiguousPro);
          if (ambiguousPro) return ambiguousPro;
          const battery = batteryAvailabilityResponse(input, localizedOptions);
          if (battery) return battery;
          const directHandoff = handoffResponse(input, localizedOptions);
          if (directHandoff) return directHandoff;
          const greeting = greetingResponse(input);
          if (greeting) return greeting;
          const power = powerGuidanceResponse(input, engine.snapshot?.());
          if (power) return power;
          const vpn = vpnGuidanceResponse(input, localizedOptions);
          if (vpn) return vpn;
          const wifi = wifiCapabilitiesResponse(input);
          if (wifi) return wifi;
          const language = unsupportedLanguageResponse(input);
          if (language) return language;
          const shipping = internationalShippingResponse(input, localizedOptions);
          if (shipping) return shipping;
          const comparison = directComparisonResponse(input, localizedOptions);
          if (comparison) return comparison;
          const response = { ...originalHandle(input), locale: activeLocale };
          return normalizeAnalytics(recommendationText(response, engine, localizedOptions));
        },
      };
    };
    assistant.__auditFixesInstalled = true;
    installContactNavigation();
    return true;
  }

  if (root?.AssistantEngine) install();
  return { install, detectInputLocale, greetingResponse, powerGuidanceResponse, vpnGuidanceResponse, wifiCapabilitiesResponse, unsupportedLanguageResponse, batteryAvailabilityResponse, ambiguousProResponse, twoMiniProQuantityResponse, internationalShippingResponse, handoffResponse, directComparisonResponse, recommendationText, normalizeAnalytics, installContactNavigation };
});