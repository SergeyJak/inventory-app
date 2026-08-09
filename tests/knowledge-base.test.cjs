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
