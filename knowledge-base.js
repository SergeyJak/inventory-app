const fs = require('fs');
const path = require('path');
const core = require('./knowledge-base-core');

const ARTICLE_ID = 'ru-mini3-vs-mini3-pro';

if (!core.ARTICLES.some(article => article.id === ARTICLE_ID)) {
  const sourcePath = path.join(__dirname, 'docs', 'articles', 'mini-3-vs-mini-3-pro.md');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const articleBody = source
    .split('\n---\n')[0]
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
    seoTitle: 'Яндекс Станция Мини 3 или Мини 3 Про: сравнение и что выбрать',
    seoDescription: 'Сравниваем Яндекс Станцию Mini 3 и Mini 3 Pro: 12 или 18 Вт, Zigbee, Matter, аккумулятор, умный дом и какую модель выбрать в Латвии.',
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
    updatedAt: '2026-09-06',
    publishedAt: '2026-09-06',
    lastUpdated: '2026-09-06',
    changeSummary: 'Published Mini 3 vs Mini 3 Pro comparison and linked it to both product pages.',
    ideaSource: 'seo-cluster',
    measurementGoal: 'Capture Mini 3 vs Mini 3 Pro comparison intent and strengthen internal links to both product pages.',
    sourceQuality: 'official-product-facts',
  });
}

module.exports = core;
