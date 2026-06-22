const state = document.getElementById('catalog-state');
const content = document.getElementById('catalog-content');
const showroom = document.getElementById('showroom');
const modelDetails = document.getElementById('model-details');
const modelSwitcher = document.getElementById('model-switcher');
const colorGallery = document.getElementById('color-gallery');
const detailsGrid = document.getElementById('details-grid');
const heroImage = document.getElementById('hero-image');
const contactCta = document.getElementById('contact-cta');
const topContact = document.getElementById('top-contact');
const overlay = document.getElementById('overlay');
const contactPanel = document.getElementById('contact-panel');
const contactClose = document.getElementById('contact-close');
const contactActions = document.getElementById('contact-actions');
const questionActions = document.getElementById('question-actions');
const assistantFab = document.getElementById('assistant-fab');
const assistantPanel = document.getElementById('assistant-panel');
const assistantClose = document.getElementById('assistant-close');
const assistantOptions = document.getElementById('assistant-options');
const assistantResult = document.getElementById('assistant-result');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const CONTACT_CONFIG = {
  whatsappPhone: '37126198525',
  telegramUsername: 'alicestation',
};

const CONTACT_TOPICS = [
  { id: 'availability', label: 'Узнать наличие', text: 'Подскажите, пожалуйста, она ещё в наличии?' },
  { id: 'choose', label: 'Помочь выбрать модель', text: 'Помогите, пожалуйста, подобрать подходящую модель.' },
  { id: 'setup', label: 'Настройка устройства', text: 'Подскажите, пожалуйста, можно ли помочь с настройкой устройства?' },
  { id: 'question', label: 'Задать вопрос', text: 'Хочу задать вопрос по этой модели.' },
];

const PHOTO_MODELS = [
  {
    id: 'light2',
    short: 'Лайт 2',
    title: 'Станция Лайт 2',
    line: 'Компактная умная колонка с Алисой, LED-дисплеем и управлением голосом.',
    description: 'Компактная Станция с экраном, часами и живыми эмоциями Алисы. Хорошо смотрится у кровати, на кухне или на рабочем столе.',
    sections: [
      {
        title: 'Лёгкий старт в мир Алисы',
        text: 'Яндекс Станция Лайт 2 — компактная умная колонка с голосовым помощником Алисой и встроенным LED-дисплеем. Она помогает управлять умным домом, включает музыку, отвечает на вопросы, ставит будильники, рассказывает прогноз погоды и делает повседневные задачи проще.',
      },
      {
        title: 'Для дома каждый день',
        text: 'Станция подходит для спальни, кухни, детской комнаты или рабочего стола. Благодаря компактным размерам она легко вписывается практически в любой интерьер.',
      },
      {
        title: 'Музыка и развлечения',
        text: 'Слушайте музыку, подкасты и радиостанции, управляйте воспроизведением голосом и получайте быстрый доступ к сервисам Яндекса.',
      },
      {
        title: 'Умный дом',
        text: 'Используйте Алису для управления совместимыми устройствами умного дома: освещением, розетками, датчиками и другой техникой без необходимости брать телефон в руки.',
      },
      {
        title: 'LED-дисплей',
        text: 'На передней панели отображаются часы, таймеры, погода, уровень громкости и другая полезная информация, делая взаимодействие со Станцией ещё удобнее.',
      },
    ],
    details: ['Алиса нового поколения', 'LED-дисплей', 'Голосовое управление', 'Музыка и подкасты', 'Управление умным домом', 'Несколько цветовых вариантов'],
    fits: ['Спальня', 'Кухня', 'Детская', 'Рабочий стол'],
    badge: 'доступная',
    compare: ['Первое знакомство', 'Компактная', 'LED-дисплей', 'Спальня, кухня, детская'],
    aliases: ['лайт 2', 'light 2', 'light2', 'lite 2', 'lite2'],
    glow: 'rgba(65, 178, 255, .18)',
    wash: '#f2f7fb',
    photos: [
      { name: 'Голубой', photos: ['images/catalog/light-2/blue/01.webp'], aliases: ['голуб'], transparent: true },
      { name: 'Фиолетовый', photos: ['images/catalog/light-2/violet/01.webp'], aliases: ['фиолет'], transparent: true },
      { name: 'Зелёный', photos: ['images/catalog/light-2/green/01.webp'], aliases: ['зелен', 'зелён'], transparent: true },
      { name: 'Розовый', photos: ['images/catalog/light-2/pink/01.webp'], aliases: ['розов'], transparent: true },
      { name: 'Коралловый', photos: ['images/catalog/light-2/coral/01.webp'], aliases: ['корал'], transparent: true },
      { name: 'Чёрный', photos: ['images/catalog/light-2/black/01.webp'], aliases: ['черн', 'чёрн', 'графит'], transparent: true },
    ],
  },
  {
    id: 'mini3',
    short: 'Мини 3',
    title: 'Станция Мини 3',
    line: 'Компактная Станция с Алисой, LED-дисплеем и более собранным звучанием.',
    description: 'Мини 3 сохраняет компактный формат, но ощущается взрослее: спокойный дизайн, экран на передней панели и звук для ежедневного прослушивания.',
    sections: [
      {
        title: 'Каждый день рядом',
        text: 'Станция Мини 3 подходит для тех мест, где колонка нужна постоянно: на кухне, у кровати, в кабинете или на полке в гостиной. Она занимает мало места и не спорит с интерьером.',
      },
      {
        title: 'Алиса без лишних действий',
        text: 'Попросите включить музыку, поставить таймер, напомнить о деле, рассказать погоду или ответить на вопрос. Голосовое управление удобно, когда руки заняты или телефон далеко.',
      },
      {
        title: 'Звук для повседневного ритма',
        text: 'Мини 3 рассчитана на музыку, радио, подкасты и фоновое звучание дома. Она хорошо подходит для комнаты, кухни или рабочего места.',
      },
      {
        title: 'Умный дом под рукой',
        text: 'Через Алису можно управлять совместимыми лампами, розетками и другой техникой. Команды становятся частью обычного домашнего сценария.',
      },
      {
        title: 'Полезный экран',
        text: 'LED-дисплей показывает время, таймеры, громкость и другую информацию, которую удобно видеть сразу.',
      },
    ],
    details: ['LED-дисплей', 'Более собранный звук', 'Голосовое управление', 'Таймеры и будильники', 'Умный дом', 'Компактный корпус'],
    fits: ['Дом', 'Рабочее место', 'Кухня', 'Подарок'],
    badge: 'баланс',
    compare: ['Баланс', 'Более собранный звук', 'Компактный формат', 'На каждый день'],
    aliases: ['мини 3', 'mini 3', 'mini3'],
    glow: 'rgba(120, 160, 150, .18)',
    wash: '#f3f6f4',
    photos: [
      { name: 'Серый', photos: ['images/catalog/mini-3/gray/01.webp'], aliases: ['сер', 'сереб'], transparent: true },
    ],
  },
  {
    id: 'miniPro',
    short: 'Мини 3 Про',
    title: 'Станция Мини 3 Про',
    line: 'Компактная Станция с усиленным звуком, Zigbee и возможностями центра умного дома.',
    description: 'Мини Про выглядит компактно, но создана для более серьёзных сценариев: музыка плотнее, управление домом шире, а возможности можно расширять дополнительными модулями.',
    sections: [
      {
        title: 'Больше возможностей в компактном формате',
        text: 'Станция Мини Про подойдёт тем, кому важны размер Мини, но хочется более взрослого звучания и расширенных функций для умного дома.',
      },
      {
        title: 'Алиса как центр управления',
        text: 'Алиса помогает запускать музыку, создавать напоминания, отвечать на вопросы и управлять домашними сценариями голосом.',
      },
      {
        title: 'Звук с запасом',
        text: 'По сравнению с базовыми компактными моделями Мини Про звучит плотнее и увереннее, поэтому хорошо подходит для гостиной, кабинета или большой кухни.',
      },
      {
        title: 'Zigbee для умного дома',
        text: 'Поддержка Zigbee помогает подключать совместимые устройства напрямую и строить домашние сценарии без лишних промежуточных шагов.',
      },
      {
        title: 'Готова к расширению',
        text: 'Модель поддерживает дополнительные модули и аксессуары, поэтому её можно адаптировать под разные задачи дома.',
      },
    ],
    details: ['Усиленный звук', 'Zigbee', 'Голосовые сценарии', 'LED-дисплей', 'Поддержка модулей', 'Центр умного дома'],
    fits: ['Умный дом', 'Музыка', 'Кабинет', 'Гостиная'],
    badge: 'умный дом',
    compare: ['Умный дом', 'Zigbee', 'Модули', 'Больше возможностей'],
    aliases: ['мини 3 про', 'мини про', 'mini 3 pro', 'mini pro', 'minipro'],
    glow: 'rgba(84, 139, 255, .16)',
    wash: '#f1f4f8',
    photos: [
      { name: 'Зелёный', photos: ['images/catalog/mini-pro/green/01.webp'], aliases: ['зелен', 'зелён'], transparent: true },
      { name: 'Голубой', photos: ['images/catalog/mini-pro/blue/01.webp'], aliases: ['голуб', 'син'], transparent: true },
      { name: 'Серый', photos: ['images/catalog/mini-pro/gray/01.webp'], aliases: ['сер', 'сереб'], transparent: true },
      { name: 'Графит', photos: ['images/catalog/mini-pro/graphite/01.webp'], aliases: ['черн', 'чёрн', 'графит'] },
    ],
  },
  {
    id: 'midi',
    short: 'Миди',
    title: 'Станция Миди',
    line: 'Станция для большой комнаты, фильмов, музыки и семейных сценариев.',
    description: 'Миди — следующий шаг для тех, кому нужен более мощный звук и уверенное присутствие в комнате. Она подходит для гостиной, вечеров с фильмами и музыки без ощущения фонового режима.',
    sections: [
      {
        title: 'Звук для комнаты',
        text: 'Станция Миди раскрывается там, где компактной модели уже мало: в гостиной, просторной кухне или общей комнате.',
      },
      {
        title: 'Музыка и фильмы',
        text: 'Более мощное звучание и глубокие басы помогают смотреть фильмы, слушать плейлисты и включать музыку для компании.',
      },
      {
        title: 'Алиса для семьи',
        text: 'Колонка помогает с напоминаниями, таймерами, погодой, вопросами и голосовым управлением без необходимости искать телефон.',
      },
      {
        title: 'Умный дом',
        text: 'Станция может стать заметной частью домашней системы: включать свет, управлять розетками и запускать привычные сценарии.',
      },
      {
        title: 'Для вечеров дома',
        text: 'Миди хорошо подходит для семейного использования, встреч и спокойных вечеров, когда звук должен заполнить пространство.',
      },
    ],
    details: ['Мощный звук', 'Глубокие басы', 'Фильмы и музыка', 'Голосовое управление', 'Семейные сценарии', 'Умный дом'],
    fits: ['Гостиная', 'Музыка', 'Фильмы', 'Семья'],
    badge: 'музыка',
    compare: ['Музыка', 'Мощный звук', 'Комната и фильмы', 'Семейные вечера'],
    aliases: ['миди', 'midi'],
    glow: 'rgba(120, 120, 160, .16)',
    wash: '#f3f4f7',
    photos: [],
  },
  {
    id: 'street',
    short: 'Стрит',
    title: 'Станция Стрит',
    line: 'Портативная Станция с аккумулятором, защитой от влаги и Bluetooth.',
    description: 'Стрит создана для тех, кто хочет брать Алису и музыку с собой: из комнаты на балкон, во двор, в поездку или на пикник.',
    sections: [
      {
        title: 'Музыка не только дома',
        text: 'Станция Стрит работает от встроенного аккумулятора, поэтому её удобно переносить между комнатами, брать на дачу, к друзьям или на прогулку.',
      },
      {
        title: 'Для отдыха и поездок',
        text: 'Портативный формат подходит для пикников, поездок и вечеров на улице. Колонка остаётся самостоятельной, когда рядом нет привычного места у розетки.',
      },
      {
        title: 'Алиса рядом',
        text: 'Дома можно пользоваться привычными голосовыми командами: включать музыку, узнавать погоду, ставить таймеры и управлять сценариями.',
      },
      {
        title: 'Bluetooth, когда нужен простой звук',
        text: 'Если хочется быстро подключить телефон, Bluetooth помогает использовать колонку как портативную акустику.',
      },
      {
        title: 'Защита от влаги',
        text: 'Корпус рассчитан на использование вне дома, где бывают брызги, влажные поверхности и переменчивая погода.',
      },
    ],
    details: ['Встроенный аккумулятор', 'Защита от влаги', 'Bluetooth', 'Музыка вне дома', 'Голосовое управление', 'Для поездок'],
    fits: ['Пикник', 'Дача', 'Путешествия', 'Дом'],
    badge: 'портативная',
    compare: ['Портативность', 'Аккумулятор', 'Bluetooth', 'Дом и поездки'],
    aliases: ['стрит', 'street'],
    glow: 'rgba(190, 185, 130, .2)',
    wash: '#f4f1e8',
    photos: [
      { name: 'Серый', photos: ['images/catalog/street/gray/01.webp'], aliases: ['сер', 'сереб'] },
      { name: 'Фиолетовый', photos: ['images/catalog/street/violet/01.webp'], aliases: ['фиолет'] },
      { name: 'Зелёный', photos: ['images/catalog/street/green/01.webp'], aliases: ['зелен', 'зелён', 'олив'], transparent: true },
      { name: 'Чёрный', photos: ['images/catalog/street/black/01.webp'], aliases: ['черн', 'чёрн', 'графит'] },
    ],
  },
];

let models = [];
let activeModel = 0;
let activeColor = 0;

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
}

function setState(message) {
  state.textContent = message;
}

function currentSelection() {
  const model = models[activeModel];
  const photo = model?.photos[activeColor] || model?.photos[0];
  return { model, photo, price: photo?.price || model?.price || 0 };
}

function selectedStockText(photo) {
  const stock = Number(photo?.product?.stock) || 0;
  return stock > 0 ? 'В наличии' : 'Наличие уточняется';
}

function buildMessage(topicId = 'availability') {
  const { model, photo, price } = currentSelection();
  const priceText = price ? money.format(price) : 'уточнить';
  return [
    'Здравствуйте!',
    `Интересует ${model?.title || 'Яндекс Станция'}, ${String(photo?.name || 'выбранный цвет').toLowerCase()}.`,
    `Цена: ${priceText}.`,
    `Наличие: ${selectedStockText(photo)}.`,
    'Подскажите, пожалуйста, актуально?',
  ].join('\n');
}

function contactUrl(channel, topicId) {
  const message = encodeURIComponent(buildMessage(topicId));
  if (channel === 'whatsapp' && CONTACT_CONFIG.whatsappPhone) {
    return `https://wa.me/${CONTACT_CONFIG.whatsappPhone}?text=${message}`;
  }
  if (channel === 'telegram' && CONTACT_CONFIG.telegramUsername) {
    return `https://t.me/${CONTACT_CONFIG.telegramUsername}`;
  }
  return '';
}

function isContactConfigured(channel) {
  return channel === 'whatsapp' ? Boolean(CONTACT_CONFIG.whatsappPhone) : Boolean(CONTACT_CONFIG.telegramUsername);
}

function setContactLinks(model) {
  contactCta.setAttribute('aria-label', `Связаться по ${model.title}`);
  topContact.setAttribute('aria-label', 'Связаться');
}

function matchesModel(product, model) {
  const haystack = normalize([product.productType, product.label, product.color].join(' '));
  return model.aliases.some(alias => haystack.includes(normalize(alias)));
}

function matchesPhoto(product, photo) {
  const haystack = normalize([product.color, product.label, product.productType].join(' '));
  return photo.aliases.some(alias => haystack.includes(normalize(alias)));
}

function primaryPhoto(photo) {
  return photo.photos[0];
}

function detailIcon(index) {
  const icons = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="4"/><path d="M9 9h6M9 15h6"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3.25"/><circle cx="16" cy="8" r="3.25"/><circle cx="16" cy="16" r="3.25"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10.5V19h11v-8.5"/><path d="M10 19v-5h4v5"/></svg>',
  ];
  return icons[index % icons.length];
}

function channelIcon(channel) {
  if (channel === 'whatsapp') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 18.8 4.5 20l1.1-3.1A8 8 0 1 1 7.8 18.8Z"/><path d="M9.2 8.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.6 1.4c.1.3 0 .5-.2.7l-.4.5c.7 1.2 1.7 2.1 3 2.7l.5-.6c.2-.2.4-.3.7-.2l1.4.6c.3.1.4.3.4.6v.4c0 .4-.2.7-.6.9-.6.3-1.5.3-2.7-.1-2.5-.8-4.5-2.7-5.5-5.1-.4-1-.4-1.8 0-2.4Z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 5-3.2 14.2c-.1.5-.7.7-1.1.4l-4.1-3-2 1.9c-.3.3-.8.1-.9-.3l-.6-3.8L4.4 13c-.6-.2-.6-1.1.1-1.4L19 4.2c.6-.3 1.2.2 1 1Z"/><path d="m8.2 14.3 8.4-6.2"/></svg>';
}

function openOverlay(panel) {
  overlay.hidden = false;
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  });
}

function closeOverlays() {
  overlay.classList.remove('open');
  contactPanel.classList.remove('open');
  assistantPanel.classList.remove('open');
  contactPanel.setAttribute('aria-hidden', 'true');
  assistantPanel.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    if (!contactPanel.classList.contains('open') && !assistantPanel.classList.contains('open')) {
      overlay.hidden = true;
    }
  }, 220);
}

function openContactPanel(topicId = 'availability') {
  renderContactPanel(topicId);
  openOverlay(contactPanel);
}

function renderContactPanel(topicId = 'availability') {
  const channels = [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'telegram', label: 'Telegram' },
  ];

  contactActions.innerHTML = channels.map(channel => {
    const url = contactUrl(channel.id, topicId);
    const disabled = !isContactConfigured(channel.id);
    return `
      <a class="channel-link ${disabled ? 'disabled' : ''}" data-channel="${channel.id}" data-topic="${topicId}" ${url ? `href="${url}" target="_blank" rel="noopener"` : 'aria-disabled="true" tabindex="-1"'}>
        <span class="channel-icon">${channelIcon(channel.id)}</span>
        <span>${channel.label}</span>
      </a>
    `;
  }).join('');

  questionActions.innerHTML = '';
}

function pickModel(preferredIds) {
  return preferredIds.map(id => models.find(model => model.id === id)).find(Boolean) || models[0];
}

function assistantScenarios() {
  return [
    { id: 'home', label: 'Для дома', modelIds: ['miniPro', 'midi', 'mini3', 'light2'], reason: 'Для дома рекомендую модель с запасом по голосовому управлению и сценариям умного дома. Если доступна Мини 3 Про, начните с неё.' },
    { id: 'music', label: 'Для музыки', modelIds: ['midi', 'miniPro', 'street', 'light2'], reason: 'Для музыки нужна модель с более мощным звуком. Если Миди доступна, она хорошо подходит для комнаты, фильмов и ежедневного прослушивания.' },
    { id: 'child', label: 'Для ребёнка', modelIds: ['light2', 'mini3'], reason: 'Для детской подойдёт Лайт 2: компактная, с часами, будильниками, сказками и понятным голосовым управлением.' },
    { id: 'gift', label: 'В подарок', modelIds: ['light2', 'mini3'], reason: 'В подарок хорошо подходят Лайт 2 или Мини 3: понятный формат, приятный внешний вид и быстрый старт с Алисой.' },
    { id: 'compare', label: 'Сравнить модели', modelIds: ['miniPro', 'mini3', 'light2'], reason: 'Сравнение покажет роли моделей: старт, ежедневное использование, умный дом, музыка или портативность.' },
    { id: 'budget', label: 'Доступная по цене', modelIds: [], reason: 'По цене чаще всего стоит начать с Лайт 2: базовые функции Алисы, компактность и LED-дисплей без лишней сложности.' },
  ];
}

function renderAssistant() {
  assistantOptions.innerHTML = assistantScenarios().map(item => `
    <button class="assistant-chip" type="button" data-scenario="${item.id}">${item.label}</button>
  `).join('');
  assistantResult.hidden = true;
  assistantResult.innerHTML = '';
}

function showAssistantResult(scenarioId) {
  const scenario = assistantScenarios().find(item => item.id === scenarioId) || assistantScenarios()[0];
  const model = scenario.id === 'budget'
    ? [...models].sort((a, b) => (a.price || 0) - (b.price || 0))[0]
    : pickModel(scenario.modelIds);
  const modelIndex = models.findIndex(item => item.id === model.id);
  assistantResult.hidden = false;
  assistantResult.innerHTML = `
    <span class="assistant-choice">${scenario.label}</span>
    <strong>Рекомендую: ${model.title}</strong>
    <p>${scenario.reason}</p>
    <div class="assistant-result-actions">
      <button type="button" data-show-model="${modelIndex}">Показать модель</button>
      <button type="button" data-scenario="compare">Сравнить</button>
      <button type="button" data-contact-topic="choose">Связаться</button>
    </div>
  `;
}

function buildModels(publicProducts) {
  return PHOTO_MODELS.map(model => {
    const products = publicProducts.filter(product => matchesModel(product, model));
    if (!products.length) return null;

    const photos = model.photos
      .map(photo => {
        const matchingProducts = products.filter(product => matchesPhoto(product, photo));
        if (!matchingProducts.length) return null;
        const minPrice = Math.min(...matchingProducts.map(product => Number(product.sellPrice) || 0).filter(Boolean));
        return {
          ...photo,
          price: minPrice || Number(matchingProducts[0].sellPrice) || 0,
          product: matchingProducts[0],
        };
      })
      .filter(Boolean);

    if (!photos.length) return null;

    const minPrice = Math.min(...photos.map(photo => photo.price).filter(Boolean));
    return {
      ...model,
      photos,
      price: minPrice || photos[0].price || 0,
      products,
    };
  }).filter(Boolean);
}

function renderHeroPhoto(photo, model) {
  const src = primaryPhoto(photo);
  const applyImage = () => {
    heroImage.src = src;
    heroImage.alt = `${model.title}, ${photo.name}`;
    heroImage.decoding = 'async';
  };

  if (prefersReducedMotion.matches || !heroImage.src) {
    applyImage();
    return;
  }

  heroImage.classList.add('is-switching');
  window.setTimeout(() => {
    applyImage();
    heroImage.classList.remove('is-switching');
    heroImage.classList.add('is-entering');
    window.setTimeout(() => heroImage.classList.remove('is-entering'), 240);
  }, 130);
}

function render() {
  const model = models[activeModel];
  const photo = model.photos[activeColor] || model.photos[0];
  const price = photo.price || model.price || 0;

  showroom.style.setProperty('--glow', model.glow);
  showroom.style.setProperty('--wash', model.wash);
  document.getElementById('model-title').textContent = model.title;
  document.getElementById('model-line').textContent = model.line;
  document.getElementById('model-price').textContent = money.format(price);
  document.getElementById('details-title').textContent = model.title;
  document.getElementById('details-summary').textContent = model.description;
  renderHeroPhoto(photo, model);
  setContactLinks(model);

  modelSwitcher.innerHTML = models.map((item, index) => `
    <button class="model-btn ${index === activeModel ? 'active' : ''}" data-model="${index}" type="button">
      ${item.short}
    </button>
  `).join('');

  colorGallery.innerHTML = model.photos.map((photoItem, index) => `
    <button class="thumb ${index === activeColor ? 'active' : ''}" data-color="${index}" type="button">
      <img src="${primaryPhoto(photoItem)}" alt="" loading="lazy" decoding="async" />
      <span><strong>${photoItem.name}</strong><span>В наличии</span></span>
    </button>
  `).join('');

  const sections = model.sections || [];
  const sectionsHtml = sections.length ? `
    <div class="model-story">
      ${sections.map(section => `
        <article class="story-item">
          <h3>${section.title}</h3>
          <p>${section.text}</p>
        </article>
      `).join('')}
    </div>
  ` : '';

  detailsGrid.innerHTML = `
    ${sectionsHtml}
    <div class="detail-list">
      ${model.details.map((detail, index) => `
    <div class="detail-item"><span class="detail-icon">${detailIcon(index)}</span><span>${detail}</span></div>
      `).join('')}
    </div>
    <div class="fit-list" aria-label="Кому подойдёт">
      ${(model.fits || []).map(fit => `
        <div class="fit-item"><span>${fit}</span></div>
      `).join('')}
    </div>
    <div class="compare-block" aria-label="Сравнение моделей">
      <div class="compare-head">
        <h3>Какую Станцию выбрать?</h3>
        <p>Коротко о разнице между доступными моделями.</p>
      </div>
      <div class="compare-list">
        ${models.map((item, index) => `
          <button class="compare-card ${index === activeModel ? 'active' : ''}" type="button" data-compare-model="${index}">
            <span class="compare-badge">${item.badge || 'модель'}</span>
            <strong>${item.short}</strong>
            ${(item.compare || []).map(text => `<span>${text}</span>`).join('')}
            <em>${money.format(item.price)}</em>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="trust-block" aria-label="Почему покупают у нас">
      <div class="compare-head">
        <h3>Почему выбирают нас</h3>
      </div>
      <div class="trust-list">
        <div><strong>Консультация перед покупкой</strong><span>Подскажем, какая модель подойдёт под ваши задачи и бюджет.</span></div>
        <div><strong>Настройка по договорённости</strong><span>Можем помочь с подключением Алисы и умного дома как отдельной услугой.</span></div>
        <div><strong>Новые устройства</strong><span>Все Яндекс Станции продаются новыми, в заводской упаковке.</span></div>
        <div><strong>Поддержка при нашей настройке</strong><span>Если настройку выполняем мы, поможем после подключения с вопросами по работе устройства.</span></div>
      </div>
    </div>
    <div class="final-cta" aria-label="Остались вопросы">
      <div>
        <h3>Остались вопросы?</h3>
        <p>Напишите удобным способом. Подскажем по модели, цвету и актуальному наличию.</p>
      </div>
      <div class="final-actions">
        <a href="${contactUrl('whatsapp', 'question')}" target="_blank" rel="noopener">WhatsApp</a>
        <a href="${contactUrl('telegram', 'question')}" target="_blank" rel="noopener">Telegram</a>
      </div>
    </div>
  `;
}

function applyUrlSelection() {
  const params = new URLSearchParams(window.location.search);
  const [selectedModel, selectedColor] = String(params.get('select') || '').split(':');
  const modelId = params.get('model') || selectedModel;
  const colorIndex = Number(params.get('color') ?? selectedColor);
  const modelIndex = models.findIndex(model => model.id === modelId);
  if (modelIndex >= 0) activeModel = modelIndex;
  if (Number.isInteger(colorIndex) && colorIndex >= 0) {
    activeColor = Math.min(colorIndex, models[activeModel].photos.length - 1);
  }
}

async function loadCatalog() {
  try {
    setState('Загружаем модели...');
    const res = await fetch('/api/public/products');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];
    models = buildModels(products);

    if (!models.length) {
      content.hidden = true;
      modelDetails.hidden = true;
      modelSwitcher.innerHTML = '';
      colorGallery.innerHTML = '';
      setState('Сейчас нет доступных моделей с фотографиями.');
      return;
    }

    activeModel = 0;
    activeColor = 0;
    applyUrlSelection();
    content.hidden = false;
    modelDetails.hidden = false;
    setState('');
    render();
  } catch (err) {
    console.error('Catalog load error:', err);
    content.hidden = true;
    modelDetails.hidden = true;
    setState('Не удалось загрузить модели. Попробуйте обновить страницу.');
  }
}

modelSwitcher.addEventListener('click', event => {
  const btn = event.target.closest('[data-model]');
  if (!btn) return;
  activeModel = Number(btn.dataset.model);
  activeColor = 0;
  render();
});

colorGallery.addEventListener('click', event => {
  const btn = event.target.closest('[data-color]');
  if (!btn) return;
  activeColor = Number(btn.dataset.color);
  render();
});

detailsGrid.addEventListener('click', event => {
  const btn = event.target.closest('[data-compare-model]');
  if (!btn) return;
  activeModel = Number(btn.dataset.compareModel);
  activeColor = 0;
  render();
  showroom.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

contactCta.addEventListener('click', () => openContactPanel('availability'));
topContact.addEventListener('click', () => openContactPanel('question'));
contactClose.addEventListener('click', closeOverlays);
assistantClose.addEventListener('click', closeOverlays);
overlay.addEventListener('click', closeOverlays);

questionActions.addEventListener('click', event => {
  const btn = event.target.closest('[data-topic]');
  if (!btn) return;
  renderContactPanel(btn.dataset.topic);
});

contactActions.addEventListener('click', event => {
  const link = event.target.closest('[data-channel]');
  if (!link || link.dataset.channel !== 'telegram' || !CONTACT_CONFIG.telegramUsername) return;
  navigator.clipboard?.writeText(buildMessage(link.dataset.topic)).catch(() => {});
});

assistantFab.addEventListener('click', () => {
  renderAssistant();
  openOverlay(assistantPanel);
});

assistantOptions.addEventListener('click', event => {
  const btn = event.target.closest('[data-scenario]');
  if (!btn) return;
  showAssistantResult(btn.dataset.scenario);
});

assistantResult.addEventListener('click', event => {
  const modelBtn = event.target.closest('[data-show-model]');
  const scenarioBtn = event.target.closest('[data-scenario]');
  const contactBtn = event.target.closest('[data-contact-topic]');

  if (modelBtn) {
    activeModel = Number(modelBtn.dataset.showModel);
    activeColor = 0;
    render();
    closeOverlays();
    showroom.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (scenarioBtn) {
    showAssistantResult(scenarioBtn.dataset.scenario);
  }

  if (contactBtn) {
    closeOverlays();
    window.setTimeout(() => openContactPanel(contactBtn.dataset.contactTopic), 180);
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeOverlays();
});

showroom.addEventListener('pointermove', event => {
  if (prefersReducedMotion.matches || window.matchMedia('(max-width: 900px)').matches) return;
  const rect = showroom.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 6;
  heroImage.style.setProperty('--parallax-x', `${x}px`);
  heroImage.style.setProperty('--parallax-y', `${y}px`);
});

showroom.addEventListener('pointerleave', () => {
  heroImage.style.setProperty('--parallax-x', '0px');
  heroImage.style.setProperty('--parallax-y', '0px');
});

loadCatalog();

