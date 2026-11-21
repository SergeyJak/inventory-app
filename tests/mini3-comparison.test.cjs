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
assert.match(article.contentMarkdown, /^\| Matter over Wi-Fi \| Да \| Да \|$/m);
assert.match(article.contentMarkdown, /^\| Zigbee \| Нет \| Да \|$/m);
assert.match(article.contentMarkdown, /\/ru\/yandex-station-mini-3\)/);
assert.match(article.contentMarkdown, /\/ru\/yandex-station-mini-3-pro\)/);
assert.doesNotMatch(article.contentMarkdown, /^# /m, 'runtime content does not contain a second H1');
assert.doesNotMatch(article.contentMarkdown, /^## FAQ$/m, 'runtime content leaves FAQ rendering to KB metadata');

const html = kb.renderArticlePage(makeReq(`/ru/help/${slug}`), article);
assert.ok(html.includes(`<title>${article.seoTitle}</title>`), 'HTML title matches article SEO metadata');
assert.match(html, /rel="canonical" href="https:\/\/heysmart\.lv\/ru\/help\/mini-3-ili-mini-3-pro-chto-vybrat"/);
assert.match(html, /<h1>Яндекс Станция Мини 3 или Мини 3 Про: что выбрать<\/h1>/);
assert.match(html, /Yandex Station Mini 3 Pro/);
assert.strictEqual((html.match(/<div class="faq-card"><h3>Что мощнее: Mini 3 или Mini 3 Pro\?<\/h3>/g) || []).length, 1, 'visible FAQ question renders once');
assert.strictEqual((html.match(/"@type":"FAQPage"/g) || []).length, 1, 'FAQ structured data renders once');

const decision = html.match(/<h2>Какую выбрать за 20 секунд<\/h2>([\s\S]*?)<h2>/);
assert.ok(decision, 'Quick decision section is present');
assert.match(decision[1], /<a\b[^>]* href="\/ru\/yandex-station-mini-3"[^>]*>Цена и наличие Яндекс Станции Мини 3<\/a>/);
assert.match(decision[1], /<a\b[^>]* href="\/ru\/yandex-station-mini-3-pro"[^>]*>Цена и наличие Яндекс Станции Мини 3 Про<\/a>/);
assert.ok(decision.index + decision[0].length <= html.indexOf('<table>'), 'Price links precede the comparison table');

const sitemap = kb.renderSitemapXml('https://heysmart.lv');
const urls = sitemap.match(/<url>[\s\S]*?<\/url>/g) || [];
const comparisonUrl = urls.find(url => url.includes(`<loc>https://heysmart.lv/ru/help/${slug}</loc>`));
assert.ok(comparisonUrl, 'Comparison article is in the sitemap');
assert.match(comparisonUrl, /<lastmod>2026-11-21<\/lastmod>/);

console.log('mini3-comparison tests passed');
