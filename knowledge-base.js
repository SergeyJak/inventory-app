const fs = require('fs');
const path = require('path');
const core = require('./knowledge-base-core');

const ARTICLE_ID = 'ru-mini3-vs-mini3-pro';

if (!core.ARTICLES.some(article => article.id === ARTICLE_ID)) {
  const sourcePath = path.join(__dirname, 'docs', 'articles', 'mini-3-vs-mini-3-pro.md');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const articleBody = source
    .split('\n---\n')[0]
    .split('\n## FAQ\n')[0]
    .replace(/^# .+\n+/, '')
    .trim();

  core.ARTICLES.push({
    id: ARTICLE_ID,
    translationGroupId: 'mini-3-vs-mini-3-pro',
    locale: 'ru',
    slug: 'mini-3-ili-mini-3-pro-chto-vybrat',
    categoryId: 'comparisons',
    status: 'published',
    contentType: 'comparison',
    previousSlugs: [],
    title: 'Яндекс Станция Мини 3 или Мини 3 Про: что выбрать',
    excerpt: 'Сравнение Mini 3 и Mini 3 Pro: звук, Zigbee, Matter, дополнительные модули и выбор модели для дома в Латвии.',
    summary: 'Mini 3 проще и дешевле, а Mini 3 Pro мощнее, поддерживает Zigbee и Matter и позволяет подключать дополнительные модули.',
    content: [],
    contentMarkdown: articleBody,
    faq: [
      { question: 'Что мощнее: Mini 3 или Mini 3 Pro?', answer: 'Mini 3 Pro: 18 Вт против 12 Вт у Mini 3.' },
      { question: 'Есть ли Zigbee в Mini 3?', answer: 'Нет. Zigbee и Matter поддерживает Mini 3 Pro.' },
      { question: 'Есть ли аккумулятор внутри Mini 3 Pro?', answer: 'Нет. Для Mini 3 Pro существует отдельный портативный аккумуляторный модуль.' },
      { question: 'Можно ли соединить Mini 3 и Mini 3 Pro в стереопару?', answer: 'Нет. Для стереопары нужны две совместимые колонки одного типа: две Mini 3 или две Mini 3 Pro.' },
      { question: 'Что лучше купить для первой Алисы?', answer: 'Если не нужны Zigbee, Matter и дополнительные модули, Mini 3 обычно достаточно. Если важнее более мощный звук и умный дом, стоит смотреть Mini 3 Pro.' },
    ],
    tags: ['mini3', 'miniPro', 'comparison', 'alice', 'latvia'],
    seoTitle: 'Мини 3 или Мини 3 Про: 12/18 Вт, Zigbee, цена | HeySmart',
    seoDescription: 'Чем отличаются Яндекс Станции Мини 3 и Мини 3 Про? Сравните 12 и 18 Вт, Zigbee, Matter и модули. Выберите модель, проверьте цены и наличие в Риге.',
    canonicalUrl: '',
    robots: 'index,follow',
    focusKeyword: 'мини 3 или мини 3 про',
    searchIntent: 'comparison',
    relatedProducts: ['mini3', 'miniPro'],
    relatedArticles: ['alice-latvia', 'choose-station-home'],
    sourceQuestions: ['mini-3-vs-mini-3-pro'],
    author: 'HeySmart',
    reviewer: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'approved',
    lastReviewedAt: '2026-09-06',
    createdAt: '2026-09-06',
    updatedAt: '2026-11-21',
    publishedAt: '2026-09-06',
    lastUpdated: '2026-11-21',
    changeSummary: 'Refreshed the search snippet and quick comparison links after Search Console CTR review.',
    ideaSource: 'seo-cluster',
    measurementGoal: 'Capture Mini 3 vs Mini 3 Pro comparison intent and strengthen internal links to both product pages.',
    sourceQuality: 'official-product-facts',
  });
}


const EUROPE_DELIVERY_GROUP = 'europe-delivery';
const EUROPE_DELIVERY_ARTICLES = [
  {
    id: 'ru-europe-delivery',
    locale: 'ru',
    slug: 'dostavka-yandex-stancii-po-evrope',
    title: 'Доставка Яндекс Станции с Алисой по Европе из Латвии',
    excerpt: 'Как заказать колонку с Алисой из Риги с доставкой в Финляндию, Данию, Бельгию и другие страны: расчёт, сроки, настройка.',
    summary: 'HeySmart помогает подобрать Яндекс Станцию и по запросу уточняет международную курьерскую доставку из Риги. Стоимость, сроки и возможность отправки согласуются индивидуально.',
    seoTitle: 'Купить Яндекс Станцию с доставкой по Европе | HeySmart',
    seoDescription: 'Яндекс Станции с Алисой из Риги: запросите расчёт доставки в Финляндию, Данию, Бельгию и другие страны Европы. Актуальное наличие и условия заказа.',
    focusKeyword: 'купить яндекс станцию в европе',
    source: 'delivery-europe-ru.md',
    relatedArticles: ['alice-latvia', 'choose-station-home', 'yandex-plus-subscription'],
  },
  {
    id: 'en-europe-delivery',
    locale: 'en',
    slug: 'yandex-station-delivery-europe',
    title: 'Buy a Yandex Station with Alice: delivery in Europe',
    excerpt: 'How to request Yandex Station delivery from Riga, Latvia, to Finland, Denmark, Belgium and other European destinations.',
    summary: 'HeySmart is based in Riga, Latvia. Ask us about a Yandex Station and a courier shipping quote for your European destination. Availability, cost and timing are confirmed individually.',
    seoTitle: 'Buy Yandex Station with Alice in Europe | HeySmart',
    seoDescription: 'Explore Yandex Station speakers with Alice and ask HeySmart in Riga for an individual delivery quote to Finland, Denmark, Belgium or other European destinations.',
    focusKeyword: 'buy yandex station europe',
    source: 'delivery-europe-en.md',
    relatedArticles: [],
  },
];

for (const guide of EUROPE_DELIVERY_ARTICLES) {
  if (core.ARTICLES.some(article => article.id === guide.id)) continue;
  const contentMarkdown = fs.readFileSync(path.join(__dirname, 'docs', 'articles', guide.source), 'utf8').trim();
  core.ARTICLES.push({
    id: guide.id,
    translationGroupId: EUROPE_DELIVERY_GROUP,
    locale: guide.locale,
    slug: guide.slug,
    categoryId: 'buying-guide',
    status: 'published',
    contentType: 'guide',
    previousSlugs: [],
    title: guide.title,
    excerpt: guide.excerpt,
    summary: guide.summary,
    content: [],
    contentMarkdown,
    faq: [],
    tags: ['delivery', 'shipping', 'europe', 'yandex-station'],
    seoTitle: guide.seoTitle,
    seoDescription: guide.seoDescription,
    canonicalUrl: '',
    robots: 'index,follow',
    focusKeyword: guide.focusKeyword,
    searchIntent: 'commercial',
    relatedProducts: ['light2', 'mini3', 'miniPro', 'street'],
    relatedArticles: guide.relatedArticles,
    sourceQuestions: ['europe-shipping-from-riga'],
    author: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'not-reviewed',
    createdAt: '2026-11-20',
    updatedAt: '2026-11-20',
    publishedAt: '2026-11-20',
    lastUpdated: '2026-11-20',
    changeSummary: 'Added Europe delivery guide based on current quote-on-request service.',
    ideaSource: 'customer-delivery-inquiries',
    measurementGoal: 'Answer Europe delivery questions and connect commercial searchers to stocked products.',
    sourceQuality: 'internal-policy',
  });
}

module.exports = core;
