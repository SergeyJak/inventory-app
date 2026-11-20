const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { modelId, summarizeStock, pickModels } = require('../product-finder.js');

const item = (productType, sellPrice, inStock = true) => ({
  id: productType + '-' + sellPrice, productType, sellPrice, inStock,
});

assert.equal(modelId(item('Мини 3 Про', 170)), 'miniPro');
assert.equal(modelId(item('Mini 3 Pro', 170)), 'miniPro');
assert.equal(modelId(item('Мини 3', 140)), 'mini3');
assert.equal(modelId(item('Лайт 2', 100)), 'light2');
assert.equal(modelId(item('Street', 180)), 'street');
assert.equal(modelId(item('Unknown speaker', 100)), null);

const available = summarizeStock([
  item('Мини 3', 90, false),
  item('Мини 3', 140),
  item('Mini 3 Pro', 170),
  item('Light 2', 80, false),
  item('Light 2', 100),
  item('Midi', 230, false),
  item('Street', 185),
]);
assert.deepEqual(available.find(model => model.id === 'mini3'), { id: 'mini3', inStock: true, price: 140 });
assert.deepEqual(available.find(model => model.id === 'light2'), { id: 'light2', inStock: true, price: 100 });
assert.deepEqual(available.find(model => model.id === 'midi'), { id: 'midi', inStock: false, price: null });
assert.deepEqual(available.find(model => model.id === 'miniPro'), { id: 'miniPro', inStock: true, price: 170 });

assert.deepEqual(pickModels(available, { purpose: 'child', room: 'small', budget: '120' }).map(m => m.id), ['light2']);
assert.deepEqual(pickModels(available, { purpose: 'smart', room: 'medium', budget: '220' }).map(m => m.id), ['miniPro']);
assert.deepEqual(pickModels(available, { purpose: 'travel', room: 'outside', budget: '220' }).map(m => m.id), ['street']);
assert.deepEqual(pickModels(available, { purpose: 'travel', room: 'outside', budget: '120' }), []);
assert.deepEqual(pickModels(available, { purpose: 'music', room: 'large', budget: 'any' }).map(m => m.id), ['miniPro', 'mini3', 'light2']);

const unknownPrice = summarizeStock([item('Mini 3', 0)]);
assert.deepEqual(unknownPrice.find(m => m.id === 'mini3'), { id: 'mini3', inStock: true, price: null });
assert.deepEqual(pickModels(unknownPrice, { budget: '120' }), [], 'No invented price for a budget-specific recommendation');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
assert.match(read('catalog.html'), /id="smart-finder"/);
assert.match(read('catalog.html'), /product-finder\.js\?v=/);
assert.match(read('catalog.html'), /product-finder\.css\?v=/);
assert.match(read('catalog.js'), /heysmart:catalog-products/);
assert.match(read('server.js'), /'\/product-finder\.js', '\/i18n\.js'|\'\/product-finder\.css\', '\/product-finder\.js\'/);
console.log('Product finder stock, budget, scenario and storefront integration tests passed.');
