const assert = require('assert');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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
async function wait(child) { for (let i = 0; i < 40; i++) { if (child.exitCode !== null) throw new Error('server stopped'); try { if ((await request('/api/public/products')).res.status < 500) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('server did not start'); }
async function main() {
  for (const file of ['transactions.json', 'andrey-returns.json', 'sub-accounts.json', 'host-subscriptions.json', 'assistant-questions.json', 'assistant-improvement-reports.json', 'visitor-analytics-events.json']) write(file, []);
  write('products.json', [
    { id: 'lite', productType: 'Лайт 2', color: 'Голубой', sellPrice: 100, lots: [{ qty: 1 }] },
    { id: 'mini', productType: 'Мини 3', color: 'Серый', sellPrice: 140, lots: [{ qty: 1 }] },
    { id: 'pro', productType: 'Мини Про', color: 'Зелёный', sellPrice: 170, lots: [{ qty: 1 }] },
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
      assert.match(text, /<h1>/); assert.match(text, /"@type":"Product"/);
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
    const liteRu = await request('/ru/yandex-station-lite-2');
    const liteEn = await request('/en/yandex-station-lite-2');
    assert.match(liteRu.text, /class="product-image-link" href="\/ru#model=light2&color=blue"/);
    assert.match(liteEn.text, /class="product-image-link" href="\/en#model=light2&color=blue"/);
    assert.doesNotMatch(sitemap.text, /#model=/);
    assert.doesNotMatch(liteRu.text.match(/<link[^>]+rel="canonical"[^>]*>/)?.[0] || '', /#model=/);
    const catalogScript = fs.readFileSync(path.join(__dirname, '..', 'catalog.js'), 'utf8');
    assert.match(catalogScript, /window\.location\.hash/);
    assert.match(catalogScript, /hasAppliedInitialUrlSelection/);
    assert.match(catalogScript, /if \(!hasAppliedInitialUrlSelection\)/);
    assert.match(catalogScript, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
    console.log('product pages regression passed');
  } finally { child.kill(); fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exit(1); });
