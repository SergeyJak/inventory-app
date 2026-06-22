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

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const CONTACT_CONFIG = {
  whatsappPhone: '37126198525',
  telegramUsername: '',
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
    line: 'Для музыки, Алисы и умного дома.',
    description: 'Компактная Станция с экраном, часами и живыми эмоциями Алисы. Хорошо смотрится у кровати, на кухне или на рабочем столе.',
    details: ['LED-экран с часами', 'Яркие цвета и софт-тач корпус', 'Удобно переносить между комнатами'],
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
    line: 'Компактная Станция с Алисой, экраном и чистым звуком.',
    description: 'Небольшая Станция для кухни, спальни или рабочего стола. Показывает время, отвечает на вопросы и управляет умным домом.',
    details: ['LED-экран с часами', 'Компактный корпус', 'Алиса и умный дом'],
    aliases: ['мини 3', 'mini 3', 'mini3'],
    glow: 'rgba(120, 160, 150, .18)',
    wash: '#f3f6f4',
    photos: [
      { name: 'Серый', photos: ['images/catalog/mini-3/gray/01.webp'], aliases: ['сер', 'сереб'], transparent: true },
    ],
  },
  {
    id: 'miniPro',
    short: 'Мини Про',
    title: 'Станция Мини Про',
    line: 'Компактная модель с экраном и плотным звучанием.',
    description: 'Компактная, но более серьёзная Станция с плотным звуком, экраном и тканевой отделкой.',
    details: ['До 18 Вт звука', 'Пассивные излучатели для баса', 'Поддержка модулей и аксессуаров'],
    aliases: ['мини про', 'mini pro', 'minipro'],
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
    id: 'street',
    short: 'Стрит',
    title: 'Станция Стрит',
    line: 'Портативная Станция для музыки дома и вне дома.',
    description: 'Портативная Станция для дома, поездок и музыки вне комнаты.',
    details: ['30 Вт', 'До 12 часов работы', 'Wi‑Fi и Bluetooth'],
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
  const topic = CONTACT_TOPICS.find(item => item.id === topicId) || CONTACT_TOPICS[0];
  const priceText = price ? money.format(price) : 'цену уточню';
  return [
    'Здравствуйте!',
    `Интересует ${model?.title || 'Яндекс Станция'}, ${String(photo?.name || 'выбранный цвет').toLowerCase()} цвет.`,
    `Цена на сайте: ${priceText}. ${selectedStockText(photo)}.`,
    topic.text,
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

  questionActions.innerHTML = `
    <div class="panel-divider"></div>
    <p class="panel-kicker">Задать вопрос</p>
    ${CONTACT_TOPICS.map(topic => `
      <button class="question-chip ${topic.id === topicId ? 'active' : ''}" type="button" data-topic="${topic.id}">
        ${topic.label}
      </button>
    `).join('')}
    ${(!CONTACT_CONFIG.whatsappPhone || !CONTACT_CONFIG.telegramUsername) ? '<p class="config-note">Контакты подключаются в CONTACT_CONFIG.</p>' : ''}
  `;
}

function pickModel(preferredIds) {
  return preferredIds.map(id => models.find(model => model.id === id)).find(Boolean) || models[0];
}

function assistantScenarios() {
  return [
    { id: 'home', label: 'Для дома', modelIds: ['light2', 'mini3', 'miniPro'], reason: 'Для дома лучше взять компактную Станцию, которая хорошо смотрится в комнате и быстро отвечает на бытовые вопросы.' },
    { id: 'music', label: 'Для музыки', modelIds: ['miniPro', 'street', 'light2'], reason: 'Для музыки лучше смотреть модель с более плотным звучанием и запасом громкости.' },
    { id: 'child', label: 'Для ребёнка', modelIds: ['light2', 'mini3'], reason: 'Для ребёнка удобнее компактная модель с экраном и понятным управлением.' },
    { id: 'gift', label: 'В подарок', modelIds: ['light2', 'miniPro', 'mini3'], reason: 'В подарок лучше работает универсальная модель: красивая, понятная и без сложного выбора.' },
    { id: 'compare', label: 'Сравнить модели', modelIds: ['miniPro', 'light2', 'mini3'], reason: 'Сравнение лучше начинать с размера, звука и места, где будет стоять Станция.' },
    { id: 'budget', label: 'Самая недорогая', modelIds: [], reason: 'Самый недорогой вариант сейчас лучше выбирать по актуальной цене и доступному цвету.' },
  ];
}

function renderAssistant() {
  assistantOptions.innerHTML = assistantScenarios().map(item => `
    <button class="assistant-chip" type="button" data-scenario="${item.id}">${item.label}</button>
  `).join('');
}

function showAssistantResult(scenarioId) {
  const scenario = assistantScenarios().find(item => item.id === scenarioId) || assistantScenarios()[0];
  const model = scenario.id === 'budget'
    ? [...models].sort((a, b) => (a.price || 0) - (b.price || 0))[0]
    : pickModel(scenario.modelIds);
  const modelIndex = models.findIndex(item => item.id === model.id);
  assistantResult.hidden = false;
  assistantResult.innerHTML = `
    <strong>${model.short}</strong>
    <p>${scenario.reason}</p>
    <div class="assistant-result-actions">
      <button type="button" data-show-model="${modelIndex}">Показать</button>
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
  heroImage.style.animation = 'none';
  void heroImage.offsetHeight;
  heroImage.style.animation = '';
  heroImage.src = primaryPhoto(photo);
  heroImage.alt = `${model.title}, ${photo.name}`;
  heroImage.decoding = 'async';
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

  detailsGrid.innerHTML = model.details.map((detail, index) => `
    <div class="detail-item"><span class="detail-icon">${detailIcon(index)}</span><span>${detail}</span></div>
  `).join('');
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

loadCatalog();

