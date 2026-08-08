const assert = require('assert');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-analytics-test-'));
const port = 3199;
const base = `http://127.0.0.1:${port}`;
const adminPassword = 'admin-pass';

function writeJson(file, value) {
  fs.writeFileSync(path.join(tmp, file), JSON.stringify(value, null, 2), 'utf8');
}

async function request(pathname, options = {}) {
  const res = await fetch(base + pathname, options);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { res, body };
}

async function waitForServer(child) {
  let lastError = '';
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw new Error('server exited early');
    try {
      const { res } = await request('/api/public/products');
      if (res.status < 500) return;
    } catch (err) {
      lastError = err.message;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('server did not start' + (lastError ? `: ${lastError}` : ''));
}

async function login() {
  const { res, body } = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: adminPassword }),
  });
  assert.strictEqual(res.status, 200);
  return body.token;
}

function auth(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function event(body, headers = {}) {
  const requestHeaders = { 'Content-Type': 'application/json', ...headers };
  if (!requestHeaders['User-Agent'] && !requestHeaders['user-agent']) requestHeaders['User-Agent'] = 'Mozilla/5.0 Chrome/120';
  return request('/api/public/analytics/event', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      visitorId: 'visitor_a',
      sessionId: 'session_a',
      eventType: 'page_view',
      page: 'https://heysmart.lv/catalog.html',
      locale: 'ru',
      ...body,
    }),
  });
}

function storedEvents() {
  return JSON.parse(fs.readFileSync(path.join(tmp, 'visitor-analytics-events.json'), 'utf8'));
}

async function tick() {
  await new Promise(resolve => setTimeout(resolve, 5));
}

async function main() {
  ['products.json', 'transactions.json', 'andrey-returns.json', 'sub-accounts.json', 'host-subscriptions.json', 'assistant-questions.json', 'assistant-improvement-reports.json', 'visitor-analytics-events.json'].forEach(file => writeJson(file, []));
  writeJson('visitor-analytics-events.json', [
    { id: 'old', visitorId: 'old_v', sessionId: 'old_s', eventType: 'page_view', timestamp: '2020-01-01T00:00:00.000Z', ip: '1.1.1.1', bot: false },
  ]);

  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: tmp,
      MONGODB_URI: '',
      JWT_SECRET: 'test-secret',
      ADMIN_HASH: bcrypt.hashSync(adminPassword, 4),
      ANDREY_HASH: bcrypt.hashSync('viewer-pass', 4),
      ANALYTICS_RETENTION_DAYS: '90',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childOutput = '';
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });

  try {
    try {
      await waitForServer(child);
    } catch (err) {
      throw new Error(`${err.message}\n${childOutput}`);
    }
    assert.strictEqual((await request('/api/admin/analytics/visitors')).res.status, 401);
    assert.strictEqual((await request('/api/admin/analytics/visitors/visitor_a')).res.status, 401);
    assert.strictEqual((await request('/api/public/analytics/visitors')).res.status, 404);

    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_no_xff', sessionId: 'ip_no_xff_s' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_no_xff').ip === '127.0.0.1');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_cf_production', sessionId: 'ip_cf_production_s' }, { 'CF-Connecting-IP': '82.193.66.136', 'X-Real-IP': '82.193.66.136', 'X-Forwarded-For': '162.158.48.163, 152.233.43.33', 'CF-Ray': 'a27f3817eecd340e-RIX' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_cf_production').ip === '82.193.66.136');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_cf_v6', sessionId: 'ip_cf_v6_s' }, { 'CF-Connecting-IP': '2001:db8::123', 'X-Forwarded-For': '162.158.1.10, 152.233.43.33', 'CF-Ray': 'a27f3817eecd340e-RIX' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_cf_v6').ip === '2001:db8::123');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_cf_mapped', sessionId: 'ip_cf_mapped_s' }, { 'CF-Connecting-IP': '::ffff:198.51.100.23', 'X-Forwarded-For': '162.158.1.10, 152.233.43.33', 'CF-Ray': 'a27f3817eecd340e-RIX' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_cf_mapped').ip === '198.51.100.23');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_cf_forged_direct', sessionId: 'ip_cf_forged_direct_s' }, { 'CF-Connecting-IP': '198.51.100.250' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_cf_forged_direct').ip !== '198.51.100.250');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_cf_malformed', sessionId: 'ip_cf_malformed_s' }, { 'CF-Connecting-IP': 'not-an-ip', 'X-Real-IP': '198.51.100.24', 'CF-Ray': 'a27f3817eecd340e-RIX' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_cf_malformed').ip === '198.51.100.24');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_forged_single', sessionId: 'ip_forged_single_s' }, { 'X-Forwarded-For': '198.51.100.99' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_forged_single').ip === '198.51.100.99');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_proxy_chain', sessionId: 'ip_proxy_chain_s' }, { 'X-Forwarded-For': '198.51.100.11, 100.64.0.8' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_proxy_chain').ip === '198.51.100.11');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_railway_real', sessionId: 'ip_railway_real_s' }, { 'X-Real-IP': '203.0.113.77', 'X-Forwarded-For': '198.51.100.99, 100.64.0.8' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_railway_real').ip === '203.0.113.77');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_v4_mapped', sessionId: 'ip_v4_mapped_s' }, { 'X-Forwarded-For': '::ffff:203.0.113.44' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_v4_mapped').ip === '203.0.113.44');
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'ip_unknown', sessionId: 'ip_unknown_s' }, { 'X-Real-IP': 'bad-ip', 'X-Forwarded-For': 'also-bad' })).res.status, 204);
    assert(storedEvents().find(item => item.visitorId === 'ip_unknown').ip === 'unknown');

    const flowEvents = [
      { eventType: 'page_view' },
      { eventType: 'model_view', modelId: 'mini3' },
      { eventType: 'color_change', modelId: 'mini3', color: 'black' },
      { eventType: 'assistant_open' },
      { eventType: 'assistant_question', metadata: { matched: false, intent: 'product_selection', text: 'must not be stored', email: 'x@example.com', phone: '+37120000000', authToken: 'secret' } },
      { eventType: 'assistant_recommendation', modelId: 'mini3', color: 'black' },
      { eventType: 'whatsapp_click', metadata: { channel: 'whatsapp' } },
    ];
    for (const item of flowEvents) {
      assert.strictEqual((await event({ visitorId: 'flow_v', sessionId: 'flow_s1', ...item }, { 'X-Forwarded-For': '203.0.113.10' })).res.status, 204);
      await tick();
    }

    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'flow_v', sessionId: 'flow_s2' }, { 'X-Forwarded-For': '203.0.113.10' })).res.status, 204);
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'same_ip_other_visitor', sessionId: 'same_ip_s' }, { 'X-Forwarded-For': '203.0.113.10' })).res.status, 204);
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'flow_v', sessionId: 'flow_s3' }, { 'X-Forwarded-For': '2001:db8::2' })).res.status, 204);

    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'visitor_a', sessionId: 's1', modelId: 'mini3' }, { 'X-Forwarded-For': '203.0.113.10' })).res.status, 204);
    assert.strictEqual((await event({ eventType: 'assistant_question', visitorId: 'visitor_a', sessionId: 's1', metadata: { text: 'must not matter' } }, { 'X-Forwarded-For': '203.0.113.10' })).res.status, 204);
    assert.strictEqual((await event({ eventType: 'whatsapp_click', visitorId: 'visitor_a', sessionId: 's2' }, { 'X-Forwarded-For': '2001:db8::2' })).res.status, 204);
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'visitor_b', sessionId: 's3' }, { 'X-Forwarded-For': '203.0.113.10' })).res.status, 204);
    assert.strictEqual((await event({ eventType: 'page_view', visitorId: 'bot_v', sessionId: 'bot_s' }, { 'user-agent': 'Googlebot/2.1' })).res.status, 204);
    assert.strictEqual((await event({ eventType: 'bad_type' })).res.status, 400);
    assert.strictEqual((await event({ eventType: 'model_view', visitorId: 'visitor_a', sessionId: 's1', metadata: { huge: 'x'.repeat(3000) } })).res.status, 204);
    const detailVisitorId = 'detail_safe-visitor_1';
    const detailBaseTime = Date.now() - 10_000;
    const detailEvents = [
      { id: 'detail_1', visitorId: detailVisitorId, sessionId: 'detail_s1', eventType: 'page_view', timestamp: new Date(detailBaseTime).toISOString(), ip: '198.51.100.1', page: 'https://heysmart.lv/', locale: 'ru', bot: false },
      { id: 'detail_2', visitorId: detailVisitorId, sessionId: 'detail_s1', eventType: 'model_view', timestamp: new Date(detailBaseTime + 1000).toISOString(), ip: '198.51.100.1', bot: false },
      { id: 'detail_3', visitorId: detailVisitorId, sessionId: 'detail_s1', eventType: 'assistant_open', timestamp: new Date(detailBaseTime + 2000).toISOString(), ip: '2001:db8::4', metadata: null, bot: false },
      { id: 'detail_4', visitorId: detailVisitorId, eventType: 'whatsapp_click', timestamp: new Date(detailBaseTime + 3000).toISOString(), ip: '2001:db8::4', bot: false },
    ];
    writeJson('visitor-analytics-events.json', [...storedEvents(), ...detailEvents]);

    const token = await login();
    const list = await request('/api/admin/analytics/visitors?limit=10', { headers: auth(token) });
    assert.strictEqual(list.res.status, 200);
    assert.strictEqual(list.body.summary.uniqueVisitors, 16);
    assert.strictEqual(list.body.summary.returningVisitors, 3);
    assert.strictEqual(list.body.summary.assistantUsers, 2);
    assert.strictEqual(list.body.summary.contactClicks, 3);
    assert.strictEqual(list.body.summary.pageViews, 18);
    const flowVisitor = list.body.items.find(row => row.visitorId === 'flow_v');
    assert(flowVisitor);
    assert.strictEqual(flowVisitor.sessionCount, 3);
    assert.strictEqual(flowVisitor.assistantQuestionCount, 1);
    assert.strictEqual(flowVisitor.contactClickCount, 1);
    assert(flowVisitor.ips.includes('203.0.113.10'));
    assert(flowVisitor.ips.includes('2001:db8::2'));
    assert(list.body.items.some(row => row.visitorId === 'same_ip_other_visitor'));
    const visitorA = list.body.items.find(row => row.visitorId === 'visitor_a');
    assert(visitorA);
    assert.strictEqual(visitorA.sessionCount, 2);
    assert(visitorA.ips.includes('203.0.113.10'));
    assert(visitorA.ips.includes('2001:db8::2'));

    const withBots = await request('/api/admin/analytics/visitors?includeBots=true', { headers: auth(token) });
    assert.strictEqual(withBots.body.summary.uniqueVisitors, 17);

    const detail = await request('/api/admin/analytics/visitors/visitor_a', { headers: auth(token) });
    assert.strictEqual(detail.res.status, 200);
    assert.strictEqual(detail.body.sessionCount, 2);
    assert(detail.body.sessions.some(session => session.events.some(item => item.label === 'Asked assistant')));
    assert(!JSON.stringify(detail.body).includes('Mozilla/5.0'));

    const flowDetail = await request('/api/admin/analytics/visitors/flow_v', { headers: auth(token) });
    assert.strictEqual(flowDetail.res.status, 200);
    assert.strictEqual(flowDetail.body.sessionCount, 3);
    const flowTimeline = flowDetail.body.sessions.find(session => session.sessionId === 'flow_s1').events.map(item => item.eventType);
    assert.deepStrictEqual(flowTimeline, flowEvents.map(item => item.eventType));
    const timelineDetail = await request(`/api/admin/analytics/visitors/${encodeURIComponent(detailVisitorId)}`, { headers: auth(token) });
    assert.strictEqual(timelineDetail.res.status, 200);
    assert.strictEqual(timelineDetail.body.visitorId, detailVisitorId);
    assert.deepStrictEqual(timelineDetail.body.ips, ['198.51.100.1', '2001:db8::4']);
    assert.strictEqual(timelineDetail.body.sessionCount, 2);
    assert(timelineDetail.body.sessions.some(session => session.sessionId === 'unknown-session'));
    const detailTimeline = timelineDetail.body.sessions.flatMap(session => session.events);
    assert.deepStrictEqual(detailTimeline.map(item => item.eventType), ['page_view', 'model_view', 'assistant_open', 'whatsapp_click']);
    assert.deepStrictEqual(detailTimeline.map(item => item.label), ['Page opened', 'Viewed', 'Opened assistant', 'Clicked WhatsApp']);
    assert(detailTimeline.every(item => Object.prototype.hasOwnProperty.call(item, 'timestamp') && Object.prototype.hasOwnProperty.call(item, 'label')));
    const unknownDetail = await request('/api/admin/analytics/visitors/unknown_visitor', { headers: auth(token) });
    assert.strictEqual(unknownDetail.res.status, 404);
    assert.strictEqual(unknownDetail.res.headers.get('content-type').includes('application/json'), true);
    assert.strictEqual(unknownDetail.body.error, 'Visitor not found');
    const malformedDetail = await request('/api/admin/analytics/visitors/%3Cbad%3E', { headers: auth(token) });
    assert.strictEqual(malformedDetail.res.status, 400);
    assert.strictEqual(malformedDetail.res.headers.get('content-type').includes('application/json'), true);
    assert.strictEqual(malformedDetail.body.error, 'Invalid visitorId');

    const stored = storedEvents();
    assert(!stored.some(item => item.visitorId === 'old_v'));
    assert(stored.some(item => item.metadata && Object.keys(item.metadata).length === 0));
    assert(!JSON.stringify(stored.filter(item => item.visitorId === 'flow_v')).includes('must not be stored'));
    assert(!JSON.stringify(stored).includes('x@example.com'));
    assert(!JSON.stringify(stored).includes('+37120000000'));
    assert(!JSON.stringify(stored).includes('secret'));

    for (let i = 0; i < 95; i++) await event({ visitorId: `rate_${i}`, sessionId: `rate_${i}` });
    const limited = await event({ visitorId: 'rate_last', sessionId: 'rate_last' });
    assert.strictEqual(limited.res.status, 429);

    console.log('visitor analytics regression passed');
  } finally {
    child.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
