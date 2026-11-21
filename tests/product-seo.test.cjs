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
  assert.ok(page.structuredData.image.some(url => url.endsWith('/images/catalog/mini-3/violet/02.jpg')));
  assert.equal(page.structuredData.offers.price, '155');
}


// A direct color URL must render the currently stocked variant from the server,
// even if a visitor has an older catalog JavaScript cached.
const stockedMini3 = [
  { id: 'mini3-gray', productType: 'Мини 3', color: 'Серый', sellPrice: 150, inStock: true },
  { id: 'mini3-violet', productType: 'Мини 3', color: 'Фиолетовый', sellPrice: 140, inStock: true },
];
const violetPage = pages.pageOptions(pages.findById('mini3'), 'ru', stockedMini3, 'violet');
assert.equal(violetPage.initial.color.key, 'violet');
assert.equal(violetPage.initial.price, 140);
assert.equal(violetPage.initial.product.id, 'mini3-violet');
assert.equal(violetPage.structuredData.offers.lowPrice, '140');
assert.ok(violetPage.initial.color.image.endsWith('/mini-3/violet/02.jpg'));

const streetPage = pages.pageOptions(pages.findById('street'), 'ru', [
  { id: 'street-black', productType: 'Street', color: 'Чёрный', sellPrice: 180, inStock: true },
  { id: 'street-green', productType: 'Street', color: 'Зелёный', sellPrice: 180, inStock: true },
], 'black');
assert.equal(streetPage.initial.color.key, 'black');
assert.equal(streetPage.initial.product.id, 'street-black');
assert.equal(streetPage.initial.price, 180);
assert.ok(streetPage.initial.color.image.endsWith('/street/black/02.png'));

// Actual warehouse naming: Mini Pro / Голубой must resolve to blue Mini 3 Pro.
const blueMiniPro = pages.pageOptions(pages.findById('miniPro'), 'ru', [
  { id: 'mini-pro-blue', productType: 'Мини Про', color: 'Голубой', sellPrice: 180, inStock: true },
], 'blue');
assert.equal(blueMiniPro.initial.product.id, 'mini-pro-blue');
assert.equal(blueMiniPro.initial.color.key, 'blue');
assert.equal(blueMiniPro.initial.price, 180);
assert.ok(blueMiniPro.initial.color.image.endsWith('/mini-pro/blue/01.webp'));
assert.equal(blueMiniPro.structuredData.offers.price, '180');


// Commercial search snippets must reflect verified in-stock prices, never stale sold-out values.
const miniSnippet = pages.pageOptions(pages.findById('mini3'), 'ru', [
  { id: 'current-mini3', productType: 'Мини 3', color: 'Серый', sellPrice: 150, inStock: true },
  { id: 'old-mini3', productType: 'Мини 3', color: 'Чёрный', sellPrice: 70, inStock: false },
]);
assert.match(miniSnippet.copy.description, /от 150 €/);
assert.doesNotMatch(miniSnippet.copy.description, /70 €/);
assert.match(miniSnippet.copy.title, /Алиса Мини 3.*Яндекс Станция/);
const proSnippet = pages.pageOptions(pages.findById('miniPro'), 'en', [
  { id: 'current-pro', productType: 'Мини 3 Про', color: 'Голубой', sellPrice: 180, inStock: true },
]);
assert.match(proSnippet.copy.description, /from €180/);
assert.match(proSnippet.copy.description, /Zigbee and Matter/);
for (const [modelId, type] of [['mini3', 'Мини 3'], ['miniPro', 'Мини 3 Про']]) {
  const gray = { ...product('gray', type, 150, true), color: 'Серый' };
  const other = { ...product('other', type, 100, true), color: modelId === 'mini3' ? 'Фиолетовый' : 'Голубой' };
  for (const locale of ['ru', 'en']) {
    const description = products => pages.pageOptions(pages.findById(modelId), locale, products).copy.description;
    const sold = { ...other, inStock: false };
    const unavailable = description([sold]);
    assert.match(unavailable, locale === 'ru' ? /уточните цену и наличие/ : /Ask about current price and availability/);
    const colours = /цвет|colou?r/i;
    assert.doesNotMatch(unavailable, colours);
    assert.doesNotMatch(unavailable, /€/);
    assert.doesNotMatch(description([gray, { ...gray, id: 'second-gray' }, sold]), colours);
    assert.doesNotMatch(description([other, { ...gray, color: '' }]), colours);
    assert.match(description([gray, other]), colours);
  }
}

console.log('Product SEO structured data checks passed');

// Comparison snippet leads with measurable differences while preserving Riga intent in the description.
const knowledgeBase = require('../knowledge-base');
const comparison = knowledgeBase.ARTICLES.find(article => article.id === 'ru-mini3-vs-mini3-pro');
assert.ok(comparison, 'Mini 3 comparison article exists');
assert.match(comparison.seoTitle, /Мини 3.*Мини 3 Про/);
assert.match(comparison.seoTitle, /12\/18 Вт, Zigbee/);
assert.match(comparison.seoDescription, /12 и 18 Вт/);
assert.match(comparison.seoDescription, /Риге/);
assert.deepEqual(comparison.relatedProducts, ['mini3', 'miniPro']);
