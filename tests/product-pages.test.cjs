const assert = require('assert');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const vm = require('vm');
const productPages = require('../product-pages');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'product-pages-test-'));
const port = 3211;
const base = `http://127.0.0.1:${port}`;
const headers = { 'x-forwarded-host': 'heysmart.lv' };
const routes = [
  ['ru', 'yandex-station-lite-2'], ['en', 'yandex-station-lite-2'],
  ['ru', 'yandex-station-mini-3'], ['en', 'yandex-station-mini-3'],
  ['ru', 'yandex-station-mini-3-pro'], ['en', 'yandex-station-mini-3-pro'],
  ['ru', 'yandex-station-street'], ['en', 'yandex-station-street'],
];
function write(file, value) { fs.writeFileSync(path.join(temp, file), JSON.stringify(value), 'utf8'); }
async function request(url) { const res = await fetch(base + url, { headers, redirect: 'manual' }); return { res, text: await res.text() }; }
async function wait(child) {
  let stderr = '';
  let lastError = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(`server stopped: ${stderr}`);
    try { if ((await request('/api/public/products')).res.status < 500) return; }
    catch (error) { lastError = error.cause?.code || error.message; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${lastError}; ${stderr}`);
}
async function main() {
  for (const file of ['transactions.json', 'andrey-returns.json', 'sub-accounts.json', 'host-subscriptions.json', 'assistant-questions.json', 'assistant-improvement-reports.json', 'visitor-analytics-events.json']) write(file, []);
  write('products.json', [
    { id: 'lite', productType: 'Лайт 2', color: 'Голубой', sellPrice: 100, lots: [{ qty: 1 }] },
    { id: 'mini', productType: 'Мини 3', color: 'Серый', sellPrice: 140, lots: [{ qty: 1 }] },
    { id: 'pro', productType: 'Мини 3 Про', color: 'Зелёный', sellPrice: 170, lots: [{ qty: 1 }] },
    { id: 'pro-gray', productType: 'Мини 3 Про', color: 'Серый', sellPrice: 180, lots: [{ qty: 2 }] },
    { id: 'street', productType: 'Street', color: 'Зелёный', sellPrice: 200, lots: [{ qty: 0 }] },
  ]);
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: temp, MONGODB_URI: '', JWT_SECRET: 'test', ADMIN_HASH: bcrypt.hashSync('a', 4), ANDREY_HASH: bcrypt.hashSync('b', 4) }, stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    await wait(child);
    for (const [locale, slug] of routes) {
      const { res, text } = await request(`/${locale}/${slug}`);
      assert.strictEqual(res.status, 200, `${locale}/${slug} is available`);
      assert.match(text, new RegExp(`<html lang="${locale}">`));
      assert.match(text, new RegExp(`rel="canonical" href="https://heysmart\\.lv/${locale}/${slug}"`));
      assert.match(text, /hreflang="ru"/); assert.match(text, /hreflang="en"/);
      assert.doesNotMatch(text, /hreflang="(?:lv|x-default)"/);
      const model = productPages.findBySlug(slug);
      const copy = model.copy[locale];
      const canonical = `https://heysmart.lv/${locale}/${slug}`;
      for (const lang of ['ru', 'en']) assert.ok(text.includes(`hreflang="${lang}" href="https://heysmart.lv/${lang}/${slug}"`));
      assert.ok(text.includes(`<title>${copy.title}</title>`));
      assert.ok(text.includes(`name="description" content="${copy.description}"`));
      assert.ok(text.includes(`<h1 class="sr-only">${copy.name}</h1>`));
      assert.ok(text.includes(`<h2 id="model-title">${copy.name}</h2>`));
      assert.ok(text.includes(`id="model-line">${copy.intro}</p>`));
      for (const id of ['catalog-content', 'model-switcher', 'color-gallery', 'model-details', 'assistant-panel', 'contact-panel']) assert.ok(text.includes(`id="${id}"`));
      assert.doesNotMatch(text, /class="product-page"|product-image-link|product-gallery|__CATALOG_/);
      const boot = JSON.parse(text.match(/window\.catalogInitialData = ([\s\S]*?);\s*<\/script>/)[1]);
      assert.strictEqual(boot.route.modelId, model.id);
      assert.strictEqual(boot.initial.model.id, model.id);
      assert.strictEqual(boot.route.slug, slug);
      const schema = JSON.parse(text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.strictEqual(schema['@type'], 'Product');
      assert.strictEqual(schema.name, copy.name);
      assert.strictEqual(schema.url, canonical);
      assert.deepStrictEqual(schema.brand, { '@type': 'Brand', name: 'Yandex' });
      assert.doesNotMatch(JSON.stringify(schema), /"(?:gtin\d*|ean|upc|mpn|aggregateRating|review)":/i);
      assert.ok(schema.image.every(image => Object.values(model.images).flat().some(asset => image.endsWith(asset))));
      assert.ok(text.includes(`id="hero-image" src="/${boot.initial.color.image}" alt="${copy.name},`));
      assert.strictEqual(schema.offers.availability, `https://schema.org/${model.id === 'street' ? 'OutOfStock' : 'InStock'}`);
      if (model.id === 'miniPro') {
        assert.strictEqual(schema.offers.lowPrice, '170');
        assert.strictEqual(schema.offers.highPrice, '180');
        assert.strictEqual(schema.sku, 'pro, pro-gray');
      } else if (model.id !== 'street') {
        assert.strictEqual(schema.offers.price, model.id === 'light2' ? '100' : '140');
        assert.strictEqual(schema.sku, model.id === 'light2' ? 'lite' : 'mini');
      } else assert.ok(!('price' in schema.offers), 'unavailable inventory must not invent a zero price');
      if (boot.initial.price) assert.ok(text.includes(`id="model-price">${boot.initial.price} €</div>`));
      const other = locale === 'ru' ? 'en' : 'ru';
      assert.ok(text.includes(`class="lang-btn" href="/${other}/${slug}"`));
      for (const match of text.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        const value = match[1];
        if (/\.(?:js|css|webp|png)(?:\?|$)/.test(value)) assert.match(value, /^(?:\/|https:\/\/)/, 'assets resolve from nested routes');
      }
      if ((locale === 'ru' && model.id === 'miniPro') || (locale === 'en' && model.id === 'light2')) console.log(`HTML checked: /${locale}/${slug}; title, H1, intro, price, stock, image, boot, schema, full catalog`);
    }
    const outOfStock = await request('/ru/yandex-station-street');
    assert.match(outOfStock.text, /Сейчас нет в наличии/); assert.match(outOfStock.text, /OutOfStock/);
    const unknown = await request('/ru/yandex-station-nope');
    assert.strictEqual(unknown.res.status, 404); assert.match(unknown.text, /noindex/);
    const knownRedirect = await request('/en?model=mini3&color=0');
    assert.strictEqual(knownRedirect.res.status, 301); assert.strictEqual(knownRedirect.res.headers.get('location'), '/en/yandex-station-mini-3');
    const unknownQuery = await request('/ru?model=midi');
    assert.strictEqual(unknownQuery.res.status, 200);
    const sitemap = await request('/sitemap.xml');
    assert.match(sitemap.text, /yandex-station-street/); assert.doesNotMatch(sitemap.text, /\?model=/);
    const catalog = await request('/ru');
    assert.match(catalog.text, /<h3><a href="\/ru\/yandex-station-lite-2">Lite 2<\/a><\/h3>/); assert.doesNotMatch(catalog.text, /catalog-product-links|"@type":"Product"/);
    assert.match(catalog.text, /catalog\.js\?v=20260906-product-catalog/, 'catalog serves the updated JavaScript asset URL');
    const liteRu = await request('/ru/yandex-station-lite-2');
    for (const [locale, slug] of routes) assert.ok(sitemap.text.includes(`<loc>https://heysmart.lv/${locale}/${slug}</loc>`));
    for (const locale of ['ru', 'en']) {
      const page = await request(`/${locale}`);
      assert.ok(page.text.includes(`rel="canonical" href="https://heysmart.lv/${locale}"`));
      assert.ok(page.text.includes('"initial":{"model":{"id":"light2"'));
      assert.doesNotMatch(page.text, /"route":|"@type":"Product"/);
    }
    const root = await request('/');
    assert.match(root.text, /rel="canonical" href="https:\/\/heysmart.lv\/"/);
    assert.strictEqual((await request('/lv/yandex-station-lite-2')).res.status, 404);
    for (const asset of ['/catalog.css', '/catalog.js', '/i18n.js', '/assistant-engine.js', '/images/catalog/mini-pro/green/01.webp', '/images/catalog/light-2/blue/01.webp']) {
      assert.strictEqual((await request(asset)).res.status, 200, `nested catalog asset: ${asset}`);
    }
    assert.doesNotMatch(sitemap.text, /#model=/);
    assert.doesNotMatch(liteRu.text.match(/<link[^>]+rel="canonical"[^>]*>/)?.[0] || '', /#model=/);
    const catalogScript = fs.readFileSync(path.join(__dirname, '..', 'catalog.js'), 'utf8');
    assert.match(catalogScript, /window\.location\.hash/);
    assert.match(catalogScript, /hasAppliedInitialUrlSelection/);
    assert.match(catalogScript, /if \(!hasAppliedInitialUrlSelection\)/);
    assert.match(catalogScript, /function catalogLocaleHref\(locale\)/);
    assert.match(catalogScript, /#model=\$\{encodeURIComponent\(model\.id\)\}&color=\$\{encodeURIComponent\(photo\.colorKey\)\}/);
    assert.match(catalogScript, /href="\$\{catalogLocaleHref\(lang\)\}" hreflang="\$\{lang\}"/);
    assert.match(catalogScript, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
    assert.doesNotMatch(catalogScript, /history\.(?:pushState|replaceState)/);
    assert.match(catalogScript, /if \(!window\.catalogInitialData\?\.route\) document\.title = dict\('meta.title'\)/);
    testClientSelection(catalogScript);
    console.log('product pages regression passed');
  } finally { child.kill(); fs.rmSync(temp, { recursive: true, force: true }); }
}
function testClientSelection(script) {
  // Execute the real selection/build functions with a small DOM boundary.
  const source = name => script.slice(script.indexOf(`function ${name}(`), script.indexOf('\nfunction ', script.indexOf(`function ${name}(`) + 1));
  const modelDefinitions = script.slice(script.indexOf('const PHOTO_MODELS ='), script.indexOf('\nlet ', script.indexOf('const PHOTO_MODELS =')));
  const context = vm.createContext({ URLSearchParams, window: { location: { search: '', hash: '' }, requestAnimationFrame: fn => fn() }, scrolls: 0 });
  vm.runInContext(`${modelDefinitions}\nlet models = []; let activeModel = 0; let activeColor = 0; let activeAngle = 0; let hasAppliedInitialUrlSelection = false; let hasScrolledToHashSelection = false;
    const content = {}, modelDetails = {}, modelSwitcher = {}, colorGallery = {};
    const showroom = { scrollIntoView(options) { if (options.behavior === 'smooth') scrolls++; } };
    function render() {} function setState() {} function dict() {}
    ${['normalize', 'matchesModel', 'matchesPhoto', 'buildModels', 'currentSelection', 'applyUrlSelection', 'showCatalog', 'catalogLocaleHref', 'pickModel'].map(source).join('\n')}`, context);
  const run = code => vm.runInContext(code, context);
  context.inventory = productPages.MODELS.map(model => ({ id: model.id, productType: model.aliases[0], color: Object.keys(model.images)[0], sellPrice: 123, inStock: true }));
  for (const model of productPages.MODELS) {
    context.window.catalogInitialData = { route: { modelId: model.id, slug: model.slug }, initial: { color: { key: Object.keys(model.images)[0] } } };
    run('hasAppliedInitialUrlSelection = false; showCatalog(buildModels([]));');
    assert.strictEqual(run('currentSelection().model.id'), model.id, 'empty stock retains route model on first render');
    assert.strictEqual(run('currentSelection().model.unavailable'), true);
    assert.strictEqual(context.scrolls, 0, 'direct product routes never scroll');
    assert.strictEqual(run("catalogLocaleHref('en')"), `/en/${model.slug}`);
    run('hasAppliedInitialUrlSelection = false; showCatalog(buildModels(inventory));');
    assert.strictEqual(run('currentSelection().model.id'), model.id, 'stocked route selects its model on first render');
    assert.strictEqual(run('currentSelection().photo.product.id'), model.id);
    assert.strictEqual(run('currentSelection().price'), 123);
    assert.strictEqual(context.scrolls, 0);
  }
  context.window.catalogInitialData = { route: { modelId: 'miniPro', slug: 'yandex-station-mini-3-pro' }, initial: { color: { key: 'gray' } } };
  run(`hasAppliedInitialUrlSelection = false; showCatalog(buildModels([
    { id: 'lite', productType: 'Lite 2', color: 'blue', sellPrice: 101, inStock: true },
    { id: 'pro', productType: 'Mini 3 Pro', color: 'gray', sellPrice: 179, inStock: true }
  ]));`);
  assert.strictEqual(run('currentSelection().model.id'), 'miniPro');
  assert.strictEqual(run('currentSelection().photo.colorKey'), 'gray');
  assert.strictEqual(run('currentSelection().price'), 179);
  context.window.location.hash = '#model=light2&color=blue';
  context.window.location.search = '?model=light2';
  run('hasAppliedInitialUrlSelection = false; showCatalog(models);');
  assert.strictEqual(run('currentSelection().model.id'), 'miniPro', 'explicit route takes precedence over query and hash');
  assert.strictEqual(context.scrolls, 0);
  context.window.location.search = '';
  run('activeModel = 0; showCatalog(models);');
  assert.strictEqual(run('currentSelection().model.id'), 'light2', 'refresh preserves user selection');
  assert.strictEqual(run("catalogLocaleHref('en')"), '/en/yandex-station-mini-3-pro', 'language follows route after model switch');
  delete context.window.catalogInitialData;
  context.window.location.hash = '#model=miniPro&color=gray';
  run('hasAppliedInitialUrlSelection = false; showCatalog(models);');
  assert.strictEqual(run('currentSelection().model.id'), 'miniPro');
  assert.strictEqual(run('currentSelection().photo.colorKey'), 'gray');
  assert.strictEqual(context.scrolls, 1);
  assert.strictEqual(run("catalogLocaleHref('en')"), '/en#model=miniPro&color=gray');
  run('activeModel = 0; showCatalog(models);');
  assert.strictEqual(run('currentSelection().model.id'), 'light2');
  assert.strictEqual(context.scrolls, 1, 'refresh must not reapply hash or scroll');
  console.log('client selection checks passed: routes, stock, refresh, language, hash and scroll');
}
main().catch(error => { console.error(error); process.exit(1); });
