const assert = require('assert');
const kb = require('../knowledge-base');

function makeReq(pathname) {
  return {
    path: pathname,
    protocol: 'https',
    get(name) {
      if (name === 'x-forwarded-host' || name === 'host') return 'heysmart.lv';
      if (name === 'x-forwarded-proto') return 'https';
      return '';
    },
  };
}

const slug = 'mini-3-ili-mini-3-pro-chto-vybrat';
const article = kb.findArticle('ru', slug);
assert.ok(article, 'Mini 3 vs Mini 3 Pro article is published');
assert.strictEqual(article.categoryId, 'comparisons');
assert.strictEqual(article.contentType, 'comparison');
assert.deepStrictEqual(article.relatedProducts, ['mini3', 'miniPro']);
assert.match(article.contentMarkdown, /12 Вт/);
assert.match(article.contentMarkdown, /18 Вт/);
assert.match(article.contentMarkdown, /Zigbee/);
assert.match(article.contentMarkdown, /Matter/);
assert.match(article.contentMarkdown, /\/ru\/yandex-station-mini-3\)/);
assert.match(article.contentMarkdown, /\/ru\/yandex-station-mini-3-pro\)/);

const html = kb.renderArticlePage(makeReq(`/ru/help/${slug}`), article);
assert.match(html, /<title>Яндекс Станция Мини 3 или Мини 3 Про: сравнение и что выбрать<\/title>/);
assert.match(html, /rel="canonical" href="https:\/\/heysmart\.lv\/ru\/help\/mini-3-ili-mini-3-pro-chto-vybrat"/);
assert.match(html, /<h1>Яндекс Станция Мини 3 или Мини 3 Про: что выбрать<\/h1>/);
assert.match(html, /Yandex Station Mini 3 Pro/);
assert.doesNotMatch(html, /<h1># /);

const sitemap = kb.renderSitemapXml('https://heysmart.lv');
assert.match(sitemap, /https:\/\/heysmart\.lv\/ru\/help\/mini-3-ili-mini-3-pro-chto-vybrat/);
assert.match(sitemap, /<lastmod>2026-09-06<\/lastmod>/);

console.log('mini3-comparison tests passed');
