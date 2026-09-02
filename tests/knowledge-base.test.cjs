const assert = require('assert');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-base-test-'));
const port = 3207;
const base = `http://127.0.0.1:${port}`;

function writeJson(file, value) {
  fs.writeFileSync(path.join(tmp, file), JSON.stringify(value, null, 2), 'utf8');
}

async function request(pathname, options = {}) {
  const res = await fetch(base + pathname, { redirect: 'manual', ...options });
  const text = await res.text();
  return { res, text };
}

async function waitForServer(child) {
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${stderr}`);
    try {
      const { res } = await request('/api/public/products');
      if (res.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`server did not start: ${stderr}`);
}

function extractJsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
}

async function main() {
  const catalogScript = fs.readFileSync(path.join(__dirname, '..', 'catalog.js'), 'utf8');
  assert.ok(
    catalogScript.indexOf('if (forcedPageLocale) return forcedPageLocale;') < catalogScript.indexOf("localStorage.getItem('catalogLanguage')"),
    'URL-forced locale takes precedence over saved catalog language'
  );
  assert.match(catalogScript, /const availableLanguages = forcedPageLocale \? \[forcedPageLocale\] : LANGUAGES;/, 'forced catalog locale exposes no alternate language controls');

  ['products.json', 'transactions.json', 'andrey-returns.json', 'sub-accounts.json', 'host-subscriptions.json', 'assistant-questions.json', 'assistant-improvement-reports.json', 'visitor-analytics-events.json'].forEach(file => writeJson(file, []));

  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: tmp,
      MONGODB_URI: '',
      JWT_SECRET: 'test-secret',
      ADMIN_HASH: bcrypt.hashSync('admin-pass', 4),
      ANDREY_HASH: bcrypt.hashSync('viewer-pass', 4),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);

    const catalogRequest = { headers: { 'x-forwarded-host': 'heysmart.lv' } };
    const rootCatalog = await request('/', catalogRequest);
    assert.strictEqual(rootCatalog.res.status, 200, 'root catalog returns 200');
    assert.match(rootCatalog.text, /rel="canonical" href="https:\/\/heysmart\.lv\/"/, 'root keeps its existing canonical');

    const russianCatalog = await request('/ru', catalogRequest);
    assert.strictEqual(russianCatalog.res.status, 200, 'Russian catalog returns 200');
    assert.match(russianCatalog.text, /<html lang="ru">/, 'Russian catalog has a Russian document language');
    assert.match(russianCatalog.text, /<title>Умные колонки с Алисой в Риге и Латвии \| HeySmart<\/title>/, 'Russian catalog has a Russian title');
    assert.match(russianCatalog.text, /<h1[^>]*>Яндекс Станции с Алисой в Латвии<\/h1>/, 'Russian catalog has a Russian SSR H1');
    assert.match(russianCatalog.text, /rel="canonical" href="https:\/\/heysmart\.lv\/ru"/, 'Russian catalog self-canonicalizes');
    assert.match(russianCatalog.text, /hreflang="ru" href="https:\/\/heysmart\.lv\/ru"/, 'Russian catalog exposes RU hreflang');
    assert.match(russianCatalog.text, /hreflang="x-default" href="https:\/\/heysmart\.lv\/ru"/, 'Russian catalog exposes x-default hreflang');
    assert.match(russianCatalog.text, /window\.catalogPageLocale = "ru"/, 'Russian catalog forces RU before catalog JavaScript loads');
    const ruSchemas = extractJsonLd(russianCatalog.text);
    assert.strictEqual(ruSchemas.length, 1, 'Russian catalog has one structured data block');
    assert.strictEqual(ruSchemas[0]['@graph'].some(item => item['@type'] === 'ItemList' || item['@type'] === 'Product'), false, 'Russian catalog does not claim query URLs are product pages');

    const help = await request('/ru/help');
    assert.strictEqual(help.res.status, 200, 'help index returns 200');
    assert.match(help.text, /База знаний HeySmart/);
    assert.match(help.text, /Работает ли Алиса в Латвии/);

    const lvHelp = await request('/lv/help');
    assert.strictEqual(lvHelp.res.status, 200, 'missing article translations do not break localized help index');
    assert.match(lvHelp.text, /class="empty-state"/, 'localized help gracefully handles no LV articles');
    assert.match(lvHelp.text, /meta name="robots" content="noindex,follow"/, 'empty localized help index is noindex');

    const category = await request('/ru/help/category/gid-pokupatelya');
    assert.strictEqual(category.res.status, 200, 'category route returns 200');
    assert.match(category.text, /Гид покупателя/);
    assert.match(category.text, /Какую Яндекс Станцию выбрать для дома/);

    const article = await request('/ru/help/rabotaet-li-alisa-v-latvii');
    assert.strictEqual(article.res.status, 200, 'article route returns 200');
    assert.match(article.text, /<h1>Работает ли Алиса в Латвии\?<\/h1>/, 'article has one H1 with seed title');
    assert.strictEqual((article.text.match(/<h1>/g) || []).length, 1, 'article renders exactly one H1');
    assert.match(article.text, /rel="canonical" href="http:\/\/127\.0\.0\.1:3207\/ru\/help\/rabotaet-li-alisa-v-latvii"/, 'article self-canonicalizes');
    assert.match(article.text, /hreflang="ru"/, 'article exposes RU hreflang');
    assert.match(article.text, /hreflang="x-default"/, 'article exposes x-default hreflang');
    assert.doesNotMatch(article.text, /hreflang="lv"/, 'missing LV translation is not emitted');
    assert.doesNotMatch(article.text, /hreflang="en"/, 'missing EN translation is not emitted');
    assert.match(article.text, /Связанные статьи/, 'related articles render');
    assert.match(article.text, /Связанные товары/, 'related products render');
    assert.match(article.text, /Yandex Station/, 'related product labels render');

    const schemas = extractJsonLd(article.text);
    assert.ok(schemas.some(item => item['@type'] === 'Article'), 'Article structured data is present');
    assert.ok(schemas.some(item => item['@type'] === 'BreadcrumbList'), 'Breadcrumb structured data is present');
    assert.ok(schemas.some(item => item['@type'] === 'FAQPage'), 'FAQ structured data is present when FAQ exists');

    const unknown = await request('/ru/help/no-such-article');
    assert.strictEqual(unknown.res.status, 404, 'unknown article returns 404');

    const missingTranslation = await request('/lv/help/rabotaet-li-alisa-v-latvii');
    assert.strictEqual(missingTranslation.res.status, 404, 'missing translation returns 404 instead of redirecting');

    const redirect = await request('/ru/help/alisa-v-latvii');
    assert.strictEqual(redirect.res.status, 301, 'previous slug redirects permanently');
    assert.strictEqual(redirect.res.headers.get('location'), '/ru/help/rabotaet-li-alisa-v-latvii');

    const draft = await request('/ru/help/unpublished-kb-test');
    assert.strictEqual(draft.res.status, 404, 'unpublished article is excluded from public route');

    const sitemap = await request('/sitemap.xml');
    assert.strictEqual(sitemap.res.status, 200, 'sitemap returns 200');
    assert.match(sitemap.text, /https:\/\/heysmart\.lv\/ru\/help\/rabotaet-li-alisa-v-latvii/, 'sitemap includes published KB article');
    assert.match(sitemap.text, /https:\/\/heysmart\.lv\/ru<\/loc>/, 'sitemap includes the Russian catalog URL');
    assert.match(sitemap.text, /https:\/\/heysmart\.lv\/ru\/help\/category\/gid-pokupatelya/, 'sitemap includes KB category');
    assert.doesNotMatch(sitemap.text, /unpublished-kb-test/, 'sitemap excludes unpublished article');

    const seedArticles = [
      '/ru/help/rabotaet-li-alisa-v-latvii',
      '/ru/help/nuzhna-li-podpiska-yandex-plus',
      '/ru/help/kakuyu-yandex-stanciyu-vybrat-dlya-doma',
      '/ru/help/kakaya-yandex-stanciya-luchshe-dlya-rebenka',
      '/ru/help/mini-3-ili-midi-chto-vybrat',
    ];
    for (const url of seedArticles) {
      const hit = await request(url);
      assert.strictEqual(hit.res.status, 200, `${url} renders`);
      assert.match(hit.text, /<article>/, `${url} renders article body`);
    }

    console.log('knowledge base regression passed');
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
