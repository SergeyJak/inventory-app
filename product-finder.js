(function heySmartFinder(root) {
  'use strict';

  const MODELS = [
    { id: 'light2', title: { ru: 'Лайт 2', en: 'Lite 2', lv: 'Lite 2' }, role: { ru: 'Первая колонка, детская', en: 'First speaker, kids', lv: 'Pirmais skaļrunis, bērniem' }, feature: { ru: 'LED-дисплей', en: 'LED display', lv: 'LED displejs' } },
    { id: 'mini3', title: { ru: 'Мини 3', en: 'Mini 3', lv: 'Mini 3' }, role: { ru: 'На каждый день', en: 'Everyday use', lv: 'Ikdienai' }, feature: { ru: 'Компактный формат', en: 'Compact design', lv: 'Kompakts dizains' } },
    { id: 'miniPro', title: { ru: 'Мини 3 Про', en: 'Mini 3 Pro', lv: 'Mini 3 Pro' }, role: { ru: 'Умный дом, Zigbee', en: 'Smart home, Zigbee', lv: 'Viedā māja, Zigbee' }, feature: { ru: 'Поддержка Zigbee', en: 'Zigbee support', lv: 'Zigbee atbalsts' } },
    { id: 'midi', title: { ru: 'Миди', en: 'Midi', lv: 'Midi' }, role: { ru: 'Музыка в гостиной', en: 'Living-room music', lv: 'Mūzika viesistabā' }, feature: { ru: 'Более мощный звук', en: 'More powerful sound', lv: 'Jaudīgāka skaņa' } },
    { id: 'street', title: { ru: 'Стрит', en: 'Street', lv: 'Street' }, role: { ru: 'Улица и поездки', en: 'Outdoors and travel', lv: 'Ārā un ceļojumos' }, feature: { ru: 'Аккумулятор, Bluetooth', en: 'Battery, Bluetooth', lv: 'Akumulators, Bluetooth' } },
  ];
  const PRIORITIES = {
    everyday: ['mini3', 'light2', 'miniPro', 'midi', 'street'],
    child: ['light2', 'mini3', 'miniPro', 'midi', 'street'],
    music: ['midi', 'miniPro', 'mini3', 'light2', 'street'],
    smart: ['miniPro'],
    travel: ['street'],
    gift: ['mini3', 'light2', 'miniPro', 'midi', 'street'],
  };
  const ROOMS = {
    small: ['light2', 'mini3', 'miniPro', 'midi', 'street'],
    medium: ['mini3', 'miniPro', 'light2', 'midi', 'street'],
    large: ['midi', 'miniPro', 'mini3', 'light2', 'street'],
    outside: ['street'],
  };
  const COPY = {
    ru: {
      kicker: 'Поможем с выбором', heading: 'Подберите Алису за 30 секунд',
      intro: 'Три вопроса. Результат только из моделей, которые сейчас есть на складе.',
      purpose: 'Для чего?', room: 'Где будет стоять?', budget: 'Бюджет',
      find: 'Подобрать колонку', compare: 'Сравнить модели и наличие',
      purposeOptions: { everyday: 'На каждый день', child: 'Для ребёнка', music: 'Для музыки', smart: 'Умный дом (Zigbee)', travel: 'На улицу и в поездки', gift: 'В подарок' },
      roomOptions: { small: 'Спальня / детская', medium: 'Кухня / кабинет', large: 'Гостиная', outside: 'На улице' },
      budgetOptions: { any: 'Без ограничений', 120: 'До 120 €', 170: 'До 170 €', 220: 'До 220 €' },
      best: 'Рекомендуем', alternatives: 'Также подойдут', open: 'Посмотреть модель',
      noMatch: 'Сейчас нет подходящей модели в наличии в выбранном бюджете. Измените условия или уточните поступление.',
      loading: 'Проверяем актуальное наличие…', error: 'Не удалось проверить склад. Попробуйте обновить страницу.',
      model: 'Модель', scenario: 'Лучше всего для', feature: 'Особенность', price: 'Цена', stock: 'Наличие',
      available: 'В наличии', unavailable: 'Нет в наличии', askPrice: 'Цена уточняется', noPrice: '—',
      tableNote: 'Цены и наличие обновляются по данным склада HeySmart.',
    },
    en: {
      kicker: 'Find your fit', heading: 'Find your Alice speaker in 30 seconds',
      intro: 'Three quick questions. Recommendations use only currently stocked models.',
      purpose: 'What for?', room: 'Where will it be used?', budget: 'Budget',
      find: 'Find my speaker', compare: 'Compare models and stock',
      purposeOptions: { everyday: 'Everyday use', child: 'For a child', music: 'Music', smart: 'Smart home (Zigbee)', travel: 'Outdoors and travel', gift: 'A gift' },
      roomOptions: { small: 'Bedroom / kids room', medium: 'Kitchen / home office', large: 'Living room', outside: 'Outdoors' },
      budgetOptions: { any: 'Any budget', 120: 'Up to €120', 170: 'Up to €170', 220: 'Up to €220' },
      best: 'Our pick', alternatives: 'Other matches', open: 'View speaker',
      noMatch: 'No matching speaker is currently in stock within your budget. Change your preferences or ask about new arrivals.',
      loading: 'Checking live availability…', error: 'Stock could not be checked. Please reload the page.',
      model: 'Model', scenario: 'Best for', feature: 'Key feature', price: 'Price', stock: 'Stock',
      available: 'In stock', unavailable: 'Out of stock', askPrice: 'Ask for price', noPrice: '—',
      tableNote: 'Prices and availability reflect HeySmart inventory.',
    },
    lv: {
      kicker: 'Palīdzēsim izvēlēties', heading: 'Atrodiet savu Alises skaļruni 30 sekundēs',
      intro: 'Trīs jautājumi. Ieteiksim tikai noliktavā pieejamus modeļus.',
      purpose: 'Kādam nolūkam?', room: 'Kur izmantosiet?', budget: 'Budžets',
      find: 'Atrast skaļruni', compare: 'Salīdzināt modeļus un pieejamību',
      purposeOptions: { everyday: 'Ikdienai', child: 'Bērnam', music: 'Mūzikai', smart: 'Viedajai mājai (Zigbee)', travel: 'Ārā un ceļojumos', gift: 'Dāvanai' },
      roomOptions: { small: 'Guļamistaba / bērnistaba', medium: 'Virtuve / kabinets', large: 'Viesistaba', outside: 'Ārā' },
      budgetOptions: { any: 'Bez ierobežojuma', 120: 'Līdz 120 €', 170: 'Līdz 170 €', 220: 'Līdz 220 €' },
      best: 'Iesakām', alternatives: 'Citi varianti', open: 'Apskatīt modeli',
      noMatch: 'Pašlaik nav pieejama piemērota modeļa jūsu budžetā. Mainiet izvēli vai jautājiet par piegādi.',
      loading: 'Pārbaudām pieejamību…', error: 'Neizdevās pārbaudīt noliktavu. Pārlādējiet lapu.',
      model: 'Modelis', scenario: 'Piemērotākais', feature: 'Priekšrocība', price: 'Cena', stock: 'Pieejamība',
      available: 'Pieejams', unavailable: 'Nav pieejams', askPrice: 'Cena jāprecizē', noPrice: '—',
      tableNote: 'Cenas un pieejamība atbilst HeySmart noliktavas datiem.',
    },
  };

  function modelId(product) {
    const raw = [product && product.productType, product && product.label].filter(Boolean).join(' ').toLowerCase().replace(/ё/g, 'е');
    if (/мини\s*(?:3\s*)?про|mini\s*3\s*pro|mini\s*pro/.test(raw)) return 'miniPro';
    if (/мини\s*3|mini\s*3/.test(raw)) return 'mini3';
    if (/лайт\s*2|light\s*2|lite\s*2/.test(raw)) return 'light2';
    if (/миди|midi/.test(raw)) return 'midi';
    if (/стрит|street/.test(raw)) return 'street';
    return null;
  }

  function summarizeStock(products) {
    const entries = Array.isArray(products) ? products : [];
    return MODELS.map(model => {
      const stocked = entries.filter(product => product && product.inStock === true && modelId(product) === model.id);
      const prices = stocked.map(product => Number(product.sellPrice)).filter(price => Number.isFinite(price) && price > 0);
      return { id: model.id, inStock: stocked.length > 0, price: prices.length ? Math.min(...prices) : null };
    });
  }

  function pickModels(stock, options = {}) {
    const purpose = Object.hasOwn(PRIORITIES, options.purpose) ? options.purpose : 'everyday';
    const room = Object.hasOwn(ROOMS, options.room) ? options.room : 'medium';
    const budget = Number(options.budget);
    const hasBudget = options.budget !== 'any' && options.budget !== undefined && Number.isFinite(budget) && budget > 0;
    const allowed = PRIORITIES[purpose].filter(id => ROOMS[room].includes(id));
    return (Array.isArray(stock) ? stock : [])
      .filter(item => item.inStock && allowed.includes(item.id) && (!hasBudget || (item.price !== null && item.price <= budget)))
      .sort((a, b) => {
        const score = item => (PRIORITIES[purpose].length - PRIORITIES[purpose].indexOf(item.id)) * 20 +
          (ROOMS[room].length - ROOMS[room].indexOf(item.id)) * 3;
        return score(b) - score(a) || (a.price ?? Infinity) - (b.price ?? Infinity);
      });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { modelId, summarizeStock, pickModels };
  if (typeof document === 'undefined') return;
  const section = document.getElementById('smart-finder');
  if (!section) return;
  const form = section.querySelector('#smart-finder-form');
  const result = section.querySelector('#smart-finder-result');
  const comparison = section.querySelector('#smart-finder-comparison');
  const fields = {
    purpose: form.querySelector('[name="purpose"]'),
    room: form.querySelector('[name="room"]'),
    budget: form.querySelector('[name="budget"]'),
  };
  let products = root.catalogInitialData?.productsVerified === false
    ? null : Array.isArray(root.catalogInitialData?.products) ? root.catalogInitialData.products : null;
  let submitted = false;
  let failed = false;

  function language() {
    const lang = document.documentElement.lang;
    return Object.hasOwn(COPY, lang) ? lang : 'ru';
  }
  function priceText(price) {
    if (price === null) return COPY[language()].askPrice;
    return new Intl.NumberFormat(language() === 'en' ? 'en-IE' : language() === 'lv' ? 'lv-LV' : 'ru-RU', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
    }).format(price);
  }
  function productLink(id) {
    const anchor = document.querySelector('[data-quick-model="' + id + '"] h3 a');
    const href = anchor?.getAttribute('href');
    return href && href.startsWith('/') && !href.startsWith('//') ? href : null;
  }
  function fillSelect(node, entries) {
    const selected = node.value;
    node.replaceChildren();
    Object.entries(entries).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      node.append(option);
    });
    if ([...node.options].some(option => option.value === selected)) node.value = selected;
  }
  function applyLanguage() {
    const t = COPY[language()];
    const targets = {
      'finder-kicker': t.kicker, 'smart-finder-title': t.heading, 'finder-intro': t.intro,
      'finder-purpose-label': t.purpose, 'finder-room-label': t.room, 'finder-budget-label': t.budget,
      'finder-submit': t.find, 'finder-comparison-label': t.compare,
    };
    Object.entries(targets).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
    fillSelect(fields.purpose, t.purposeOptions);
    fillSelect(fields.room, t.roomOptions);
    fillSelect(fields.budget, t.budgetOptions);
    renderComparison();
    if (submitted) renderResults();
  }
  function renderComparison() {
    const t = COPY[language()];
    if (products === null) {
      comparison.textContent = failed ? t.error : t.loading;
      return;
    }
    const stock = summarizeStock(products);
    const table = document.createElement('table');
    table.className = 'finder-table';
    const head = document.createElement('thead');
    const tr = document.createElement('tr');
    [t.model, t.scenario, t.feature, t.price, t.stock].forEach(label => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      tr.append(th);
    });
    head.append(tr);
    table.append(head);
    const body = document.createElement('tbody');
    MODELS.forEach(model => {
      const offer = stock.find(item => item.id === model.id);
      const row = document.createElement('tr');
      const cell = document.createElement('th');
      cell.scope = 'row';
      const link = offer.inStock ? productLink(model.id) : null;
      if (link) {
        const a = document.createElement('a');
        a.href = link;
        a.textContent = model.title[language()];
        cell.append(a);
      } else {
        cell.textContent = model.title[language()];
      }
      row.append(cell);
      [model.role[language()], model.feature[language()], offer.inStock ? priceText(offer.price) : t.noPrice,
        offer.inStock ? t.available : t.unavailable].forEach((value, index) => {
        const td = document.createElement('td');
        td.textContent = value;
        if (index === 3) td.className = offer.inStock ? 'finder-stock yes' : 'finder-stock no';
        row.append(td);
      });
      body.append(row);
    });
    table.append(body);
    comparison.replaceChildren(table);
    const note = document.createElement('p');
    note.className = 'finder-note';
    note.textContent = t.tableNote;
    comparison.append(note);
  }
  function renderResults() {
    const t = COPY[language()];
    result.replaceChildren();
    if (products === null) {
      result.textContent = failed ? t.error : t.loading;
      return;
    }
    const choices = { purpose: fields.purpose.value, room: fields.room.value, budget: fields.budget.value };
    const suggestions = pickModels(summarizeStock(products), choices).slice(0, 3);
    if (!suggestions.length) {
      result.textContent = t.noMatch;
      return;
    }
    const heading = document.createElement('h3');
    heading.textContent = t.best;
    result.append(heading);
    const list = document.createElement('div');
    list.className = 'finder-matches';
    suggestions.forEach((item, index) => {
      const model = MODELS.find(entry => entry.id === item.id);
      const article = document.createElement('article');
      article.className = 'finder-match' + (index === 0 ? ' primary' : '');
      const intro = document.createElement('span');
      intro.className = 'finder-match-caption';
      intro.textContent = index === 0 ? t.best : t.alternatives;
      const name = document.createElement('strong');
      name.textContent = model.title[language()];
      const feature = document.createElement('span');
      feature.textContent = model.role[language()];
      const cost = document.createElement('b');
      cost.textContent = priceText(item.price);
      article.append(intro, name, feature, cost);
      const link = productLink(item.id);
      if (link) {
        const a = document.createElement('a');
        a.className = 'finder-product-link';
        a.href = link;
        a.textContent = t.open;
        article.append(a);
      }
      list.append(article);
    });
    result.append(list);
  }

  root.addEventListener('heysmart:catalog-products', event => {
    if (!Array.isArray(event.detail?.products)) return;
    products = event.detail.products;
    failed = false;
    renderComparison();
    if (submitted) renderResults();
  });
  root.addEventListener('heysmart:catalog-products-error', () => {
    if (products !== null) return;
    failed = true;
    renderComparison();
    if (submitted) renderResults();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    submitted = true;
    renderResults();
    root.gtag?.('event', 'finder_results', { purpose: fields.purpose.value, room: fields.room.value, budget: fields.budget.value });
  });
  new MutationObserver(mutations => {
    if (mutations.some(m => m.attributeName === 'lang')) applyLanguage();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  applyLanguage();
})(typeof window !== "undefined" ? window : globalThis);
