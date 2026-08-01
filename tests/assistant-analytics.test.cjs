const assert = require('assert');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-analytics-test-'));
const port = 3197;
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
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw new Error('server exited early');
    try {
      const { res } = await request('/api/public/products');
      if (res.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('server did not start');
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

async function main() {
  ['products.json', 'transactions.json', 'andrey-returns.json', 'sub-accounts.json', 'host-subscriptions.json'].forEach(file => writeJson(file, []));
  fs.writeFileSync(path.join(tmp, 'assistant-questions.json'), '{bad json', 'utf8');

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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);

    const first = await request('/api/public/assistant-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: '<b>Mini?</b>',
        answer: '<img src=x onerror=alert(1)>Mini answer',
        locale: 'en',
        matched: true,
        matchedFaqId: 'faq-mini',
        confidence: 0.91,
        responseType: 'faq',
        modelId: 'miniPro',
        colorKey: 'blue',
        pageUrl: '/?model=miniPro&color=1&token=secret',
        sessionId: 'sess-1',
      }),
    });
    assert.strictEqual(first.res.status, 200);
    assert.ok(first.body.id, 'create returns generated id');

    const second = await request('/api/public/assistant-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Unknown thing', answer: 'Fallback', locale: 'en', matched: false, confidence: 0.2, sessionId: 'sess-1' }),
    });
    assert.strictEqual(second.res.status, 200);

    const invalidFeedback = await request(`/api/public/assistant-question/${first.body.id}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: 'bad' }),
    });
    assert.strictEqual(invalidFeedback.res.status, 400);

    const feedback = await request(`/api/public/assistant-question/${first.body.id}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: 'not_helpful' }),
    });
    assert.strictEqual(feedback.res.status, 200);

    const unauth = await request('/api/admin/assistant-questions');
    assert.strictEqual(unauth.res.status, 401);

    const token = await login();
    const list = await request('/api/admin/assistant-questions?locale=en&page=1&limit=1', { headers: auth(token) });
    assert.strictEqual(list.res.status, 200);
    assert.strictEqual(list.body.items.length, 1);
    assert.strictEqual(list.body.total, 2);
    assert.ok(list.body.summary.total >= 2);
    assert.ok(!list.body.items[0].answer.includes('<'), 'stored answer is sanitized');
    assert.strictEqual(list.body.items[0].pageUrl.includes('token='), false, 'sensitive URL params are removed');

    const unmatched = await request('/api/admin/assistant-questions?matched=false', { headers: auth(token) });
    assert.strictEqual(unmatched.res.status, 200);
    assert.strictEqual(unmatched.body.items.every(item => item.matched === false), true);

    const update = await request(`/api/admin/assistant-questions/${first.body.id}`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ reviewed: true, adminNote: '<script>x</script>note' }),
    });
    assert.strictEqual(update.res.status, 200);

    const now = Date.now();
    writeJson('assistant-questions.json', [
      { id: 'neg', question: 'negative', answer: 'bad', locale: 'en', matched: true, confidence: 0.9, feedback: 'not_helpful', reviewed: false, sessionId: 's1', normalizedQuestion: 'negative', createdAt: new Date(now - 60000).toISOString() },
      { id: 'unmatched', question: 'unmatched', answer: 'fallback', locale: 'en', matched: false, confidence: 0.9, reviewed: false, sessionId: 's2', normalizedQuestion: 'unmatched', createdAt: new Date(now - 50000).toISOString() },
      { id: 'low', question: 'low confidence', answer: 'maybe', locale: 'en', matched: true, confidence: 0.49, reviewed: false, sessionId: 's3', normalizedQuestion: 'low confidence', createdAt: new Date(now - 40000).toISOString() },
      { id: 'multi', question: 'multi reason', answer: 'no', locale: 'en', matched: false, confidence: 0.2, feedback: 'not_helpful', reviewed: false, sessionId: 's4', normalizedQuestion: 'multi reason', createdAt: new Date(now - 30000).toISOString() },
      { id: 'reviewed', question: 'reviewed bad', answer: 'no', locale: 'en', matched: false, confidence: 0.1, feedback: 'not_helpful', reviewed: true, sessionId: 's5', normalizedQuestion: 'reviewed bad', createdAt: new Date(now - 20000).toISOString() },
      { id: 'dup-a', question: 'duplicate', answer: 'a', locale: 'en', matched: false, confidence: 0.1, reviewed: false, sessionId: 's6', normalizedQuestion: 'duplicate', createdAt: new Date(now - 10000).toISOString() },
      { id: 'dup-b', question: 'duplicate', answer: 'b', locale: 'en', matched: false, confidence: 0.1, reviewed: false, sessionId: 's6', normalizedQuestion: 'duplicate', createdAt: new Date(now - 9000).toISOString() },
      { id: 'empty', question: '!!!', answer: 'empty', locale: 'en', matched: false, confidence: 0.1, reviewed: false, sessionId: 's7', normalizedQuestion: '', createdAt: new Date(now - 8000).toISOString() },
      { id: 'legacy', question: 'legacy record', answer: '', locale: 'en', sessionId: 's8', createdAt: new Date(now - 7000).toISOString() },
    ]);

    const queue = await request('/api/admin/assistant-questions?preset=needs_improvement&page=1&limit=20', { headers: auth(token) });
    assert.strictEqual(queue.res.status, 200);
    const queueIds = queue.body.items.map(item => item.id);
    assert.ok(queueIds.includes('unmatched'), 'unmatched question enters queue');
    assert.ok(queueIds.includes('low'), 'low confidence enters queue');
    assert.ok(queueIds.includes('neg'), 'negative feedback enters queue');
    assert.ok(queueIds.includes('legacy'), 'legacy records are handled safely');
    assert.ok(!queueIds.includes('reviewed'), 'reviewed item leaves active queue');
    assert.ok(!queueIds.includes('empty'), 'empty normalized question is excluded');
    assert.strictEqual(queueIds.filter(id => id === 'multi').length, 1, 'multi-condition record is returned once');
    assert.strictEqual(queueIds.filter(id => id.startsWith('dup-')).length, 1, 'same-session short-window duplicate is suppressed');
    assert.deepStrictEqual(queueIds.slice(0, 5), ['multi', 'neg', 'legacy', 'dup-a', 'unmatched'], 'priority sorting is applied');
    assert.strictEqual(queue.body.meta.lowConfidenceThreshold, 0.5);
    assert.ok(queue.body.items.find(item => item.id === 'multi').improvementReasons.includes('Negative feedback'));
    assert.ok(queue.body.items.find(item => item.id === 'multi').improvementReasons.includes('No FAQ match'));
    assert.ok(queue.body.items.find(item => item.id === 'multi').improvementReasons.includes('Low confidence'));
    assert.strictEqual(queue.body.summary.improvement.total, 6, 'summary counts unresolved improvement items');
    assert.strictEqual(queue.body.summary.improvement.negativeFeedback, 2);
    assert.ok(queue.body.summary.improvement.unmatched >= 4);
    assert.ok(queue.body.summary.improvement.lowConfidence >= 4);

    const reviewedQueue = await request('/api/admin/assistant-questions?preset=needs_improvement&reviewed=true', { headers: auth(token) });
    assert.strictEqual(reviewedQueue.res.status, 200);
    assert.deepStrictEqual(reviewedQueue.body.items.map(item => item.id), ['reviewed'], 'reviewed queue returns resolved items');

    const pagedQueue = await request('/api/admin/assistant-questions?preset=needs_improvement&page=2&limit=2', { headers: auth(token) });
    assert.strictEqual(pagedQueue.res.status, 200);
    assert.strictEqual(pagedQueue.body.items.length, 2, 'queue pagination works');

    const longQuestion = 'q'.repeat(600);
    await request('/api/public/assistant-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: longQuestion, answer: 'a'.repeat(2000), locale: 'en', sessionId: 'sess-2' }),
    });
    const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'assistant-questions.json'), 'utf8'));
    assert.ok(saved.some(item => item.sessionId === 'sess-2'), 'session grouping is stored');
    assert.ok(saved.every(item => String(item.question || '').length <= 300), 'question length is limited');
    assert.ok(saved.every(item => String(item.answer || '').length <= 1200), 'answer length is limited');

    for (let i = 0; i < 13; i++) {
      const hit = await request('/api/public/assistant-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `rate ${i}`, answer: 'a' }),
      });
      if (i === 12) assert.strictEqual(hit.res.status, 429, 'rate limit eventually applies');
    }

    console.log('assistant analytics regression passed');
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
