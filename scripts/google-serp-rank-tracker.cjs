'use strict';
// Run: DATAFORSEO_LOGIN=... DATAFORSEO_PASSWORD=... node scripts/google-serp-rank-tracker.cjs
// Preview without API credentials: node scripts/google-serp-rank-tracker.cjs --dry-run
const fs = require('node:fs');
const path = require('node:path');
const ruQueries = [
  'яндекс алиса колонка', 'алиса рига купить', 'купить алису в риге',
  'колонка алиса купить рига', 'колонка алиса купить в риге',
  'купить колонку алиса в риге', 'алиса купить латвия',
  'яндекс станция рига', 'яндекс станция латвия',
  'купить яндекс станцию в латвии', 'купить яндекс станцию рига',
  'умная колонка алиса рига', 'умная колонка алиса латвия',
  'умная колонка с алисой купить', 'колонка с алисой цена',
  'яндекс колонка купить', 'яндекс колонка рига',
  'яндекс алиса купить', 'станция алиса купить',
  'где купить алису в риге', 'алиса с доставкой по латвии',
  'алиса колонка в наличии рига', 'колонка алиса для детей',
  'колонка алиса в подарок', 'алиса с часами купить',
  'яндекс станция с дисплеем', 'алиса для умного дома zigbee',
  'яндекс станция настройка в латвии',
  'алиса мини 3 купить', 'алиса мини 3 рига',
  'яндекс станция мини 3 купить рига', 'яндекс мини 3 цена',
  'яндекс мини 3 латвия', 'мини 3 с алисой купить',
  'алиса мини 3 про купить', 'алиса мини 3 про латвия',
  'яндекс станция мини 3 про рига', 'мини 3 про zigbee',
  'мини 3 или мини 3 про', 'станция мини 3 про цена',
  'яндекс станция лайт 2 купить рига', 'алиса лайт 2 купить',
  'лайт 2 с часами', 'станция лайт 2 латвия',
  'яндекс станция лайт 2 цена', 'алиса лайт2 купить',
  'яндекс станция стрит рига', 'алиса стрит купить',
  'яндекс станция стрит латвия', 'портативная колонка алиса купить',
  'яндекс станция миди рига', 'яндекс станция миди купить латвия',
  'колонка яндекс отзывы', 'какую колонку с алисой купить',
  'яндекс станция европа', 'яндекс станция рига цена',
  'алиса рига доставка', 'купить алису латвия цена',
  'алиса рига', 'алиса колонка латвия',
];
const enQueries = [
  'yandex alice speaker', 'yandex alice smart speaker',
  'buy yandex station riga', 'yandex station riga buy',
  'yandex station latvia', 'buy yandex station latvia',
  'alice smart speaker latvia', 'buy alice smart speaker latvia',
  'yandex alice riga', 'yandex smart speaker riga',
  'yandex station price latvia', 'yandex station delivery latvia',
  'yandex station europe', 'buy yandex station europe',
  'yandex station mini 3 riga', 'buy yandex mini 3 latvia',
  'yandex mini 3 price', 'yandex station mini 3 pro latvia',
  'buy yandex mini 3 pro riga', 'yandex mini 3 pro zigbee',
  'yandex station lite 2 riga', 'buy yandex lite 2 latvia',
  'yandex station light 2 clock', 'yandex station street latvia',
  'buy yandex station street riga', 'yandex station midi latvia',
  'alice speaker for kids', 'yandex station setup latvia',
  'yandex speaker in stock riga', 'yandex station mini 3 vs pro',
];
const languages = [
  { language_code: 'ru', keywords: ruQueries },
  { language_code: 'en', keywords: enQueries },
];
const dryRun = process.argv.includes('--dry-run');
const maxChecks = Number(process.env.SERP_MAX_CHECKS || 40);
if (!Number.isInteger(maxChecks) || maxChecks < 1 || maxChecks > 500) throw new Error('SERP_MAX_CHECKS must be 1..500');
const login = process.env.DATAFORSEO_LOGIN;
const password = process.env.DATAFORSEO_PASSWORD;
const endpoint = 'https://api.dataforseo.com/v3/serp/google/organic/live/regular';
const timestamp = new Date().toISOString();
async function check(keyword, language_code, device) {
  const body = [{ keyword, location_name: 'Riga,Latvia', language_code, device, os: device === 'mobile' ? 'android' : 'windows', depth: 20 }];
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(login + ':' + password).toString('base64'), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('DataForSEO HTTP ' + response.status);
  const payload = await response.json();
  const task = payload.tasks?.[0];
  if (task?.status_code !== 20000) throw new Error('DataForSEO: ' + (task?.status_message || payload.status_message));
  const items = task.result?.[0]?.items || [];
  const organic = items.filter(item => item.type === 'organic');
  const ours = organic.filter(item => {
    try { const host = new URL(item.url).hostname.toLowerCase(); return host === 'heysmart.lv' || host.endsWith('.heysmart.lv'); } catch { return false; }
  });
  return {
    keyword, language_code, device, checked_at: timestamp,
    rank: ours.length ? Math.min(...ours.map(item => item.rank_group ?? item.rank_absolute)) : null,
    url: ours[0]?.url ?? null,
    top_competitors: organic.filter(item => !ours.includes(item)).slice(0, 3).map(item => ({ rank: item.rank_group, domain: item.domain, url: item.url })),
    checked_depth: 20,
  };
}
async function main() {
  const allJobs = languages.flatMap(({ language_code, keywords }) => keywords.flatMap(keyword => ['mobile', 'desktop'].map(device => ({ keyword, language_code, device }))));
  // Keep the core buyer queries first; cap paid API requests until budget is approved.
  const planned = allJobs.slice(0, maxChecks);
  if (dryRun) { console.log(JSON.stringify({ mode: 'dry-run', checks: planned.length, planned }, null, 2)); return; }
  if (!login || !password) throw new Error('Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in Railway environment variables');
  const results = [];
  for (const job of planned) {
    try { results.push(await check(job.keyword, job.language_code, job.device)); }
    catch (error) { results.push({ ...job, checked_at: timestamp, error: error.message }); }
  }
  const dir = process.env.SERP_OUTPUT_DIR || path.join(process.cwd(), 'serp-reports');
  fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, 'serp-' + timestamp.replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(filename, JSON.stringify({ checked_at: timestamp, provider: 'DataForSEO Google Organic SERP', location: 'Riga,Latvia', results }, null, 2));
  const historyFile = path.join(dir, 'history.jsonl');
  fs.appendFileSync(historyFile, JSON.stringify({ checked_at: timestamp, results }) + '\\n');
  console.log(JSON.stringify({ file: filename, history: historyFile, available_queries: allJobs.length, total: results.length, found: results.filter(r => r.rank !== null && r.rank !== undefined).length, errors: results.filter(r => r.error).length }));
  if (results.some(r => r.error)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
