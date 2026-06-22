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

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const contactHref = '#';

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
      { name: 'Голубой', photos: ['images/catalog/light-2/blue/01.png'], aliases: ['голуб'], transparent: true },
      { name: 'Фиолетовый', photos: ['images/catalog/light-2/violet/01.png'], aliases: ['фиолет'], transparent: true },
      { name: 'Зелёный', photos: ['images/catalog/light-2/green/01.png'], aliases: ['зелен', 'зелён'], transparent: true },
      { name: 'Розовый', photos: ['images/catalog/light-2/pink/01.png'], aliases: ['розов'], transparent: true },
      { name: 'Коралловый', photos: ['images/catalog/light-2/coral/01.png'], aliases: ['корал'], transparent: true },
      { name: 'Чёрный', photos: ['images/catalog/light-2/black/01.png'], aliases: ['черн', 'чёрн', 'графит'], transparent: true },
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
      { name: 'Серый', photos: ['images/catalog/mini-3/gray/01.png'], aliases: ['сер', 'сереб'], transparent: true },
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
      { name: 'Зелёный', photos: ['images/catalog/mini-pro/green/01.png'], aliases: ['зелен', 'зелён'], transparent: true },
      { name: 'Голубой', photos: ['images/catalog/mini-pro/blue/01.png'], aliases: ['голуб', 'син'], transparent: true },
      { name: 'Серый', photos: ['images/catalog/mini-pro/gray/01.png'], aliases: ['сер', 'сереб'], transparent: true },
      { name: 'Графит', photos: ['images/catalog/mini-pro/graphite/01.jfif'], aliases: ['черн', 'чёрн', 'графит'] },
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
      { name: 'Серый', photos: ['images/catalog/street/gray/01.jfif'], aliases: ['сер', 'сереб'] },
      { name: 'Фиолетовый', photos: ['images/catalog/street/violet/01.jfif'], aliases: ['фиолет'] },
      { name: 'Зелёный', photos: ['images/catalog/street/green/01.png'], aliases: ['зелен', 'зелён', 'олив'], transparent: true },
      { name: 'Чёрный', photos: ['images/catalog/street/black/01.jfif'], aliases: ['черн', 'чёрн', 'графит'] },
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

function setContactLinks(model) {
  const href = contactHref;
  contactCta.href = href;
  topContact.href = href;
  contactCta.setAttribute('aria-label', `Уточнить ${model.title}`);
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
  heroImage.src = primaryPhoto(photo);
  heroImage.alt = `${model.title}, ${photo.name}`;
  setContactLinks(model);

  modelSwitcher.innerHTML = models.map((item, index) => `
    <button class="model-btn ${index === activeModel ? 'active' : ''}" data-model="${index}" type="button">
      ${item.short}
    </button>
  `).join('');

  colorGallery.innerHTML = model.photos.map((photoItem, index) => `
    <button class="thumb ${index === activeColor ? 'active' : ''}" data-color="${index}" type="button">
      <img src="${primaryPhoto(photoItem)}" alt="" />
      <span><strong>${photoItem.name}</strong><span>В наличии</span></span>
    </button>
  `).join('');

  detailsGrid.innerHTML = model.details.map(detail => `
    <div class="detail-item">${detail}</div>
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

loadCatalog();
