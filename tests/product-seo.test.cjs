const assert = require('node:assert/strict');
const pages = require('../product-pages');

function offer(modelId, products) {
  const model = pages.findById(modelId);
  return pages.pageOptions(model, 'ru', products).structuredData.offers;
}

const product = (id, productType, sellPrice, inStock) => ({
  id, productType, label: productType, color: 'Чёрный', sellPrice, inStock,
});

assert.equal(
  offer('mini3', [
    product('old', 'Мини 3', 140, false),
    product('live', 'Мини 3', 150, true),
  ]).price,
  '150',
  'Sold-out prices must not appear in the offer'
);

const aggregate = offer('mini3', [
  product('a', 'Мини 3', 150, true),
  product('b', 'Мини 3', 160, true),
  product('old', 'Мини 3', 100, false),
]);
assert.equal(aggregate['@type'], 'AggregateOffer');
assert.equal(aggregate.lowPrice, '150');
assert.equal(aggregate.highPrice, '160');
assert.equal(aggregate.offerCount, 2);

assert.equal(offer('mini3', [
  product('pro', 'Мини 3 Про', 170, true),
]), undefined, 'Mini 3 Pro must not leak into Mini 3 rich results');

assert.equal(offer('mini3', [
  product('old', 'Мини 3', 45, false),
]), undefined, 'Sold-out historical price must never appear in Google rich results');

assert.equal(offer('mini3', [
  product('invalid', 'Мини 3', 0, true),
]), undefined, 'Zero-priced variant is not a valid offer');

for (const color of ['Фиолетовый', 'Лиловый', 'Purple', 'Lilac']) {
  const page = pages.pageOptions(pages.findById('mini3'), 'ru', [
    { id: 'mini3-lilac', productType: 'Мини 3', color, sellPrice: 155, inStock: true },
  ]);
  assert.equal(page.initial.color.key, 'violet', `Mini 3 color ${color} resolves to violet`);
  assert.equal(page.initial.price, 155, 'Violet offer price comes from inventory');
  assert.ok(page.structuredData.image.some(url => url.endsWith('/images/catalog/mini-3/violet/01.png')));
  assert.equal(page.structuredData.offers.price, '155');
}

console.log('Product SEO structured data checks passed');

// Comparison snippet stays targeted to model differences and purchasing in Latvia.
const knowledgeBase = require('../knowledge-base');
const comparison = knowledgeBase.ARTICLES.find(article => article.id === 'ru-mini3-vs-mini3-pro');
assert.ok(comparison, 'Mini 3 comparison article exists');
assert.match(comparison.seoTitle, /Мини 3.*Мини 3 Про/);
assert.match(comparison.seoTitle, /Латвии/);
assert.match(comparison.seoDescription, /12 и 18 Вт/);
assert.match(comparison.seoDescription, /Риге/);
assert.deepEqual(comparison.relatedProducts, ['mini3', 'miniPro']);
