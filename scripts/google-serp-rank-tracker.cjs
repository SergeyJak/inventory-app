'use strict';
// Run: DATAFORSEO_LOGIN=... DATAFORSEO_PASSWORD=... node scripts/google-serp-rank-tracker.cjs
// Preview without API credentials: node scripts/google-serp-rank-tracker.cjs --dry-run
const fs = require('node:fs');
const path = require('node:path');
const queries = [
  'алиса рига купить', 'купить алису в риге', 'колонка алиса купить рига',
  'яндекс станция рига', 'алиса купить латвия', 'умная колонка алиса рига',
  'яндекс станция мини 3 купить рига', 'алиса мини 3 про латвия',
  'яндекс станция лайт 2 купить рига', 'яндекс станция стрит рига',
  'yandex station riga buy', 'buy alice smart speaker latvia',
  'yandex station mini 3 riga', 'yandex station mini 3 pro latvia',
  'yandex station lite 2 riga', 'yandex station street latvia',
];
const languages = [
  { language_code: 'ru', keywords: queries.filter(q => /[а-яё]/i.test(q)) },
  { language_code: 'en', keywords: queries.filter(q => !/[а-яё]/i.test(q)) },
];
const dryRun = process.argv.includes('--dry-run');
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
  const planned = languages.flatMap(({ language_code, keywords }) => keywords.flatMap(keyword => ['mobile', 'desktop'].map(device => ({ keyword, language_code, device }))));
  if (dryRun) { console.log(JSON.stringify({ mode: 'dry-run', checks: planned.length, planned }, null, 2)); return; }
  if (!login || !password) throw new Error('Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in Railway environment variables');
  const results = [];
  for (const job of planned) {
    try { results.push(await check(job.keyword, job.language_code, job.device)); }
    catch (error) { results.push({ ...job, checked_at: timestamp, error: error.message }); }
  }
  const dir = process.env.SERP_OUTPUT_DIR || path.join(process.cwd(), 'serp-reports');
  fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, 'serp-' + timestamp.slice(0, 10) + '.json');
  fs.writeFileSync(filename, JSON.stringify({ checked_at: timestamp, provider: 'DataForSEO Google Organic SERP', location: 'Riga,Latvia', results }, null, 2));
  console.log(JSON.stringify({ file: filename, total: results.length, found: results.filter(r => r.rank !== null && r.rank !== undefined).length, errors: results.filter(r => r.error).length }));
  if (results.some(r => r.error)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
