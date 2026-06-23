const state = document.getElementById('catalog-state');
const content = document.getElementById('catalog-content');
const showroom = document.getElementById('showroom');
const modelDetails = document.getElementById('model-details');
const modelSwitcher = document.getElementById('model-switcher');
const colorGallery = document.getElementById('color-gallery');
const detailsGrid = document.getElementById('details-grid');
const heroImage = document.getElementById('hero-image');
const anglePrev = document.getElementById('angle-prev');
const angleNext = document.getElementById('angle-next');
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
const languageSwitcher = document.getElementById('language-switcher');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const CONTACT_CONFIG = {
  whatsappPhone: '37126198525',
  telegramUsername: 'alicestation',
};

const LANGUAGES = ['ru', 'lv', 'en'];
const translations = window.catalogTranslations || {};
let currentLang = resolveInitialLanguage();

function resolveInitialLanguage() {
  const saved = localStorage.getItem('catalogLanguage');
  if (LANGUAGES.includes(saved)) return saved;
  const browserLang = String(navigator.language || '').slice(0, 2).toLowerCase();
  return LANGUAGES.includes(browserLang) ? browserLang : 'ru';
}

function dict(path, lang = currentLang) {
  return path.split('.').reduce((value, key) => value?.[key], translations[lang]) ??
    path.split('.').reduce((value, key) => value?.[key], translations.ru);
}

function money(value) {
  return `${Number(value || 0).toLocaleString(currentLang === 'en' ? 'en-US' : currentLang)} €`;
}

const PHOTO_MODELS = [
  {
    id: 'light2',
    aliases: ['лайт 2', 'light 2', 'light2', 'lite 2', 'lite2'],
    glow: 'rgba(65, 178, 255, .18)',
    wash: '#f2f7fb',
    photos: [
      { colorKey: 'blue', photos: ['images/catalog/light-2/blue/01.webp'], aliases: ['голуб'], transparent: true },
      { colorKey: 'violet', photos: ['images/catalog/light-2/violet/01.webp'], aliases: ['фиолет'], transparent: true },
      { colorKey: 'green', photos: ['images/catalog/light-2/green/01.webp'], aliases: ['зелен', 'зелён'], transparent: true },
      { colorKey: 'pink', photos: ['images/catalog/light-2/pink/01.webp'], aliases: ['розов'], transparent: true },
      { colorKey: 'coral', photos: ['images/catalog/light-2/coral/01.webp'], aliases: ['корал'], transparent: true },
      { colorKey: 'black', photos: ['images/catalog/light-2/black/01.webp'], aliases: ['черн', 'чёрн', 'графит'], transparent: true },
    ],
  },
  {
    id: 'mini3',
    aliases: ['мини 3', 'mini 3', 'mini3'],
    glow: 'rgba(120, 160, 150, .18)',
    wash: '#f3f6f4',
    photos: [
      { colorKey: 'gray', photos: ['images/catalog/mini-3/gray/01.webp'], aliases: ['сер', 'сереб'], transparent: true },
    ],
  },
  {
    id: 'miniPro',
    aliases: ['мини 3 про', 'мини про', 'mini 3 pro', 'mini pro', 'minipro'],
    glow: 'rgba(84, 139, 255, .16)',
    wash: '#f1f4f8',
    photos: [
      { colorKey: 'green', photos: ['images/catalog/mini-pro/green/01.webp'], aliases: ['зелен', 'зелён'], transparent: true },
      { colorKey: 'blue', photos: ['images/catalog/mini-pro/blue/01.webp'], aliases: ['голуб', 'син'], transparent: true },
      { colorKey: 'gray', photos: ['images/catalog/mini-pro/gray/01.webp'], aliases: ['сер', 'сереб'], transparent: true },
      { colorKey: 'graphite', photos: ['images/catalog/mini-pro/graphite/01.webp'], aliases: ['черн', 'чёрн', 'графит'] },
    ],
  },
  {
    id: 'midi',
    aliases: ['миди', 'midi'],
    glow: 'rgba(120, 120, 160, .16)',
    wash: '#f3f4f7',
    photos: [],
  },
  {
    id: 'street',
    aliases: ['стрит', 'street'],
    glow: 'rgba(190, 185, 130, .2)',
    wash: '#f4f1e8',
    photos: [
      { colorKey: 'gray', photos: ['images/catalog/street/gray/01.webp'], aliases: ['сер', 'сереб'] },
      { colorKey: 'violet', photos: ['images/catalog/street/violet/01.webp'], aliases: ['фиолет'] },
      { colorKey: 'green', photos: ['images/catalog/street/green/01.webp', 'images/catalog/street/green/02.webp', 'images/catalog/street/green/03.webp'], aliases: ['зелен', 'зелён', 'олив'], transparent: true },
      { colorKey: 'black', photos: ['images/catalog/street/black/01.webp'], aliases: ['черн', 'чёрн', 'графит'] },
    ],
  },
];

let models = [];
let activeModel = 0;
let activeColor = 0;
let activeAngle = 0;

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
  return photo?.product?.inStock ? dict('common.inStock') : dict('common.stockUnknown');
}

function modelText(model, key) {
  return dict(`models.${model.id}.${key}`);
}

function colorName(photo) {
  return dict(`colors.${photo?.colorKey || 'gray'}`);
}

function buildMessage(topicId = 'availability') {
  const { model, photo, price } = currentSelection();
  return dict('contact.message')({
    modelName: model ? modelText(model, 'title') : 'Station',
    colorName: colorName(photo),
    price: price ? money(price) : '-',
    availability: selectedStockText(photo),
  });
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
  contactCta.setAttribute('aria-label', `${dict('common.contact')} ${modelText(model, 'title')}`);
  topContact.setAttribute('aria-label', dict('nav.consultation'));
  contactPanel.setAttribute('aria-label', dict('contact.aria'));
  contactClose.setAttribute('aria-label', dict('common.close'));
  assistantClose.setAttribute('aria-label', dict('common.close'));
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
  return photo.photos[activeAngle] || photo.photos[0];
}

function photoAt(photo, index = 0) {
  return photo.photos[index] || photo.photos[0];
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
    panel.inert = false;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  });
}

function closeOverlays() {
  overlay.classList.remove('open');
  contactPanel.classList.remove('open');
  assistantPanel.classList.remove('open');
  contactPanel.inert = true;
  assistantPanel.inert = true;
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
  const scenarios = dict('assistant.scenarios');
  return [
    { id: 'home', modelIds: ['miniPro', 'midi', 'mini3', 'light2'], ...scenarios.home },
    { id: 'music', modelIds: ['midi', 'miniPro', 'street', 'light2'], ...scenarios.music },
    { id: 'child', modelIds: ['light2', 'mini3'], ...scenarios.child },
    { id: 'gift', modelIds: ['light2', 'mini3'], ...scenarios.gift },
    { id: 'compare', modelIds: ['miniPro', 'mini3', 'light2'], ...scenarios.compare },
    { id: 'budget', modelIds: [], ...scenarios.budget },
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
    <strong>${dict('assistant.recommend')} ${modelText(model, 'title')}</strong>
    <p>${scenario.reason}</p>
    <div class="assistant-result-actions">
      <button type="button" data-show-model="${modelIndex}">${dict('common.showModel')}</button>
      <button type="button" data-scenario="compare">${dict('common.compare')}</button>
      <button type="button" data-contact-topic="choose">${dict('common.contact')}</button>
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
    heroImage.alt = `${modelText(model, 'title')}, ${colorName(photo)}`;
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

function setAngleControls(photo) {
  const hasAngles = (photo?.photos?.length || 0) > 1;
  anglePrev.hidden = !hasAngles;
  angleNext.hidden = !hasAngles;
  heroImage.classList.toggle('has-angles', hasAngles);
}

function setActiveAngle(nextAngle) {
  const { model, photo } = currentSelection();
  if (!model || !photo || photo.photos.length < 2) return;
  activeAngle = (nextAngle + photo.photos.length) % photo.photos.length;
  renderHeroPhoto(photo, model);
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.title = dict('meta.title');
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = dict(node.dataset.i18n);
  });
  assistantPanel.setAttribute('aria-label', dict('assistant.kicker'));
  modelSwitcher.setAttribute('aria-label', dict('common.models'));
  colorGallery.setAttribute('aria-label', dict('common.colors'));
  detailsGrid.setAttribute('aria-label', dict('common.aboutModel'));
  languageSwitcher.setAttribute('aria-label', dict('nav.lang'));
}

function renderLanguageSwitcher() {
  languageSwitcher.innerHTML = LANGUAGES.map(lang => `
    <button class="lang-btn ${lang === currentLang ? 'active' : ''}" type="button" data-lang="${lang}" aria-pressed="${lang === currentLang}">
      ${lang.toUpperCase()}
    </button>
  `).join('');
}

function render() {
  const model = models[activeModel];
  const photo = model.photos[activeColor] || model.photos[0];
  const price = photo.price || model.price || 0;

  showroom.style.setProperty('--glow', model.glow);
  showroom.style.setProperty('--wash', model.wash);
  const title = document.getElementById('model-title');
  title.textContent = modelText(model, 'title');
  title.dataset.fullTitle = modelText(model, 'title');
  title.classList.toggle('split-title', currentLang !== 'ru');
  document.getElementById('model-line').textContent = modelText(model, 'line');
  document.getElementById('model-price').textContent = money(price);
  document.getElementById('details-title').textContent = modelText(model, 'title');
  document.getElementById('details-summary').textContent = modelText(model, 'description');
  renderHeroPhoto(photo, model);
  setAngleControls(photo);
  setContactLinks(model);

  modelSwitcher.innerHTML = models.map((item, index) => `
    <button class="model-btn ${index === activeModel ? 'active' : ''}" data-model="${index}" type="button" aria-pressed="${index === activeModel}">
      ${modelText(item, 'short')}
    </button>
  `).join('');

  colorGallery.innerHTML = model.photos.map((photoItem, index) => `
    <button class="thumb ${index === activeColor ? 'active' : ''}" data-color="${index}" type="button" aria-pressed="${index === activeColor}">
      <img src="${photoAt(photoItem, 0)}" alt="" width="76" height="86" loading="lazy" decoding="async" />
      <span><strong>${colorName(photoItem)}</strong><span>${dict('common.inStock')}</span></span>
    </button>
  `).join('');

  const sections = modelText(model, 'sections') || [];
  const sectionsHtml = sections.length ? `
    <div class="model-story">
      ${sections.map(section => `
        <article class="story-item">
          <h3>${section[0]}</h3>
          <p>${section[1]}</p>
        </article>
      `).join('')}
    </div>
  ` : '';

  detailsGrid.innerHTML = `
    ${sectionsHtml}
    <div class="detail-list">
      ${modelText(model, 'details').map((detail, index) => `
    <div class="detail-item"><span class="detail-icon">${detailIcon(index)}</span><span>${detail}</span></div>
      `).join('')}
    </div>
    <div class="fit-list" aria-label="${dict('common.fitFor')}">
      ${(modelText(model, 'fits') || []).map(fit => `
        <div class="fit-item"><span>${fit}</span></div>
      `).join('')}
    </div>
    <div class="compare-block" aria-label="${dict('sections.choose.title')}">
      <div class="compare-head">
        <h3>${dict('sections.choose.title')}</h3>
        <p>${dict('sections.choose.text')}</p>
      </div>
      <div class="compare-list">
        ${models.map((item, index) => `
          <button class="compare-card ${index === activeModel ? 'active' : ''}" type="button" data-compare-model="${index}" aria-pressed="${index === activeModel}">
            <span class="compare-badge">${modelText(item, 'badge') || dict('common.model')}</span>
            <strong>${modelText(item, 'short')}</strong>
            ${(modelText(item, 'compare') || []).map(text => `<span>${text}</span>`).join('')}
            <em>${money(item.price)}</em>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="trust-block" aria-label="${dict('sections.trust.title')}">
      <div class="compare-head">
        <h3>${dict('sections.trust.title')}</h3>
      </div>
      <div class="trust-list">
        ${dict('sections.trust.items').map(item => `<div><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join('')}
      </div>
    </div>
    <div class="final-cta" aria-label="${dict('sections.final.title')}">
      <div>
        <h3>${dict('sections.final.title')}</h3>
        <p>${dict('sections.final.text')}</p>
      </div>
      <div class="final-actions">
        <a href="${contactUrl('whatsapp', 'question')}" target="_blank" rel="noopener" aria-label="WhatsApp">WhatsApp</a>
        <a href="${contactUrl('telegram', 'question')}" target="_blank" rel="noopener" aria-label="Telegram">Telegram</a>
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
  activeAngle = 0;
}

async function loadCatalog() {
  try {
    setState(dict('state.loading'));
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
      setState(dict('state.empty'));
      return;
    }

    activeModel = 0;
    activeColor = 0;
    activeAngle = 0;
    applyUrlSelection();
    content.hidden = false;
    modelDetails.hidden = false;
    setState('');
    render();
  } catch (err) {
    console.error('Catalog load error:', err);
    content.hidden = true;
    modelDetails.hidden = true;
    setState(dict('state.error'));
  }
}

modelSwitcher.addEventListener('click', event => {
  const btn = event.target.closest('[data-model]');
  if (!btn) return;
  activeModel = Number(btn.dataset.model);
  activeColor = 0;
  activeAngle = 0;
  render();
});

colorGallery.addEventListener('click', event => {
  const btn = event.target.closest('[data-color]');
  if (!btn) return;
  activeColor = Number(btn.dataset.color);
  activeAngle = 0;
  render();
});

detailsGrid.addEventListener('click', event => {
  const btn = event.target.closest('[data-compare-model]');
  if (!btn) return;
  activeModel = Number(btn.dataset.compareModel);
  activeColor = 0;
  activeAngle = 0;
  render();
  showroom.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

contactCta.addEventListener('click', () => openContactPanel('availability'));
heroImage.addEventListener('click', () => setActiveAngle(activeAngle + 1));
anglePrev.addEventListener('click', event => {
  event.stopPropagation();
  setActiveAngle(activeAngle - 1);
});
angleNext.addEventListener('click', event => {
  event.stopPropagation();
  setActiveAngle(activeAngle + 1);
});
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
    activeAngle = 0;
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

languageSwitcher.addEventListener('click', event => {
  const btn = event.target.closest('[data-lang]');
  if (!btn) return;
  currentLang = btn.dataset.lang;
  localStorage.setItem('catalogLanguage', currentLang);
  applyStaticTranslations();
  renderLanguageSwitcher();
  if (models.length) render();
  if (contactPanel.classList.contains('open')) renderContactPanel('question');
  if (assistantPanel.classList.contains('open')) renderAssistant();
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

applyStaticTranslations();
renderLanguageSwitcher();
loadCatalog();

