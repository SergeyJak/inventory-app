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
      NODE_ENV: 'test',
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
        intent: 'faq_question',
        modelId: 'miniPro',
        colorKey: 'blue',
        pageUrl: '/?model=miniPro&color=1&token=secret',
        sessionId: 'sess-1',
        messageId: 'msg-1',
        assistantAnswer: 'Mini answer exact',
        sessionContext: { intent: 'faq_question', recommendationShown: false, followupAsked: false, selectedScenario: '', preferences: {} },
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
    assert.match(unauth.res.headers.get('content-type') || '', /application\/json/);

    const unknownApi = await request('/api/admin/assistant-questions-typo');
    assert.strictEqual(unknownApi.res.status, 404);
    assert.match(unknownApi.res.headers.get('content-type') || '', /application\/json/, 'unknown API routes return JSON, not HTML');

    const token = await login();
    const list = await request('/api/admin/assistant-questions?locale=en&page=1&limit=10', { headers: auth(token) });
    assert.strictEqual(list.res.status, 200);
    assert.ok(list.body.items.length >= 1);
    assert.strictEqual(list.body.total, 2);
    assert.ok(list.body.summary.total >= 2);
    assert.ok(!list.body.items[0].answer.includes('<'), 'stored answer is sanitized');
    const persisted = list.body.items.find(item => item.messageId === 'msg-1');
    assert.ok(persisted, 'messageId is stored');
    assert.ok(persisted.sessionId, 'sessionId is persisted');
    assert.ok(persisted.timestamp, 'timestamp is persisted');
    assert.strictEqual(persisted.role, 'assistant', 'role is persisted');
    assert.strictEqual(persisted.question, 'Mini?', 'question is persisted sanitized');
    assert.strictEqual(persisted.assistantAnswer, 'Mini answer exact', 'assistantAnswer is persisted exactly after generation');
    assert.strictEqual(persisted.intent, 'faq_question', 'intent is persisted');
    assert.strictEqual(persisted.responseType, 'faq', 'responseType is persisted');
    assert.strictEqual(persisted.matched, true, 'matched is persisted');
    assert.strictEqual(persisted.matchedFaqId, 'faq-mini', 'matchedFaqId is persisted');
    assert.strictEqual(persisted.confidence, 0.91, 'confidence is persisted');
    assert.ok(persisted.sessionContext && typeof persisted.sessionContext === 'object', 'sanitized session context is persisted');
    assert.strictEqual(list.body.items[0].pageUrl.includes('token='), false, 'sensitive URL params are removed');

    const unmatched = await request('/api/admin/assistant-questions?matched=false', { headers: auth(token) });
    assert.strictEqual(unmatched.res.status, 200);
    assert.strictEqual(unmatched.body.items.every(item => item.matched === false), true);

    const matchedFromFaq = await request('/api/public/assistant-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'FAQ id but no matched flag', answer: 'Answer', locale: 'en', matched: false, matchedFaqId: 'faq-derived', confidence: 0.8, sessionId: 'sess-derived' }),
    });
    assert.strictEqual(matchedFromFaq.res.status, 200);
    const derivedList = await request('/api/admin/assistant-questions?faqId=faq-derived', { headers: auth(token) });
    assert.strictEqual(derivedList.res.status, 200);
    assert.strictEqual(derivedList.body.items[0].matched, true, 'matchedFaqId derives matched=true');

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
      { id: 'legacy-faq', question: 'legacy faq record', answer: '', locale: 'en', matchedFaqId: 'faq-legacy', sessionId: 's9', normalizedQuestion: 'legacy faq record', createdAt: new Date(now - 6000).toISOString() },
    ]);

    const queue = await request('/api/admin/assistant-questions?preset=needs_improvement&page=1&limit=20', { headers: auth(token) });
    assert.strictEqual(queue.res.status, 200);
    const queueIds = queue.body.items.map(item => item.id);
    assert.ok(queueIds.includes('unmatched'), 'unmatched question enters queue');
    assert.ok(queueIds.includes('low'), 'low confidence enters queue');
    assert.ok(queueIds.includes('neg'), 'negative feedback enters queue');
    assert.ok(queueIds.includes('legacy'), 'legacy records are handled safely');
    assert.ok(!queueIds.includes('legacy-faq'), 'legacy records with matchedFaqId are treated as matched');
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
    assert.ok(queue.body.summary.improvement.lowConfidence >= 3);

    const reviewedQueue = await request('/api/admin/assistant-questions?preset=needs_improvement&reviewed=true', { headers: auth(token) });
    assert.strictEqual(reviewedQueue.res.status, 200);
    assert.deepStrictEqual(reviewedQueue.body.items.map(item => item.id), ['reviewed'], 'reviewed queue returns resolved items');

    const pagedQueue = await request('/api/admin/assistant-questions?preset=needs_improvement&page=2&limit=2', { headers: auth(token) });
    assert.strictEqual(pagedQueue.res.status, 200);
    assert.strictEqual(pagedQueue.body.items.length, 2, 'queue pagination works');

    const day = 24 * 60 * 60 * 1000;
    writeJson('assistant-questions.json', [
      { id: 'r1', question: 'Delivery to Riga?', answer: 'Delivery answer', locale: 'en', matched: false, confidence: 0.2, sessionId: 'ra', normalizedQuestion: 'delivery to riga', createdAt: new Date(now - day).toISOString() },
      { id: 'r2', question: 'Delivery to Riga? +371 22222222 test@example.com', answer: 'Delivery answer', locale: 'en', matched: false, confidence: 0.3, feedback: 'not_helpful', sessionId: 'rb', normalizedQuestion: 'delivery to riga', createdAt: new Date(now - day + 1000).toISOString() },
      { id: 'r3', question: 'Setup help', answer: 'Setup answer', locale: 'en', matched: true, matchedFaqId: 'setup', confidence: 0.4, feedback: 'not_helpful', sessionId: 'rc', normalizedQuestion: 'setup help', createdAt: new Date(now - 2 * day).toISOString() },
      { id: 'r4', question: 'Setup help again', answer: 'Setup answer', locale: 'en', matched: true, matchedFaqId: 'setup', confidence: 0.45, feedback: 'helpful', sessionId: 'rd', normalizedQuestion: 'setup help again', createdAt: new Date(now - 2 * day + 1000).toISOString() },
      { id: 'c1', messageId: 'c1', question: 'For home', assistantAnswer: 'What matters most?', answer: 'What matters most?', locale: 'en', matched: true, confidence: 0.8, intent: 'product_selection', responseType: 'clarify', sessionId: 'conv-a', normalizedQuestion: 'for home', sessionContext: { followupAsked: true, recommendationShown: false }, createdAt: new Date(now - day + 2000).toISOString() },
      { id: 'c2', messageId: 'c2', question: 'For music', assistantAnswer: 'Recommended Mini Pro', answer: 'Recommended Mini Pro', locale: 'en', matched: true, confidence: 0.9, intent: 'music_use_case', responseType: 'recommendation', modelId: 'miniPro', sessionId: 'conv-a', normalizedQuestion: 'for music', sessionContext: { followupAsked: true, recommendationShown: true }, createdAt: new Date(now - day + 3000).toISOString() },
      { id: 'handoff', question: 'Contact human', answer: 'WhatsApp Telegram', locale: 'en', matched: true, confidence: 1, intent: 'human_handoff', responseType: 'human_handoff', sessionId: 'conv-b', normalizedQuestion: 'contact human', createdAt: new Date(now - day + 4000).toISOString() },
      { id: 'end', question: 'Thanks', answer: 'Thanks', locale: 'en', matched: false, confidence: 0.1, intent: 'conversation_end', responseType: 'conversation_end', sessionId: 'conv-c', normalizedQuestion: 'thanks', createdAt: new Date(now - day + 5000).toISOString() },
      { id: 'noise', question: 'Test', answer: 'Fallback', locale: 'en', matched: false, confidence: 0.1, intent: 'noise_or_test', responseType: 'noise_or_test', sessionId: 'conv-d', normalizedQuestion: 'test', createdAt: new Date(now - day + 6000).toISOString() },
      { id: 'r5', question: 'Latvian only', answer: 'LV', locale: 'lv', matched: false, confidence: 0.1, sessionId: 're', normalizedQuestion: 'latvian only', createdAt: new Date(now - day).toISOString() },
      { id: 'old', question: 'Old topic', answer: 'Old', locale: 'en', matched: false, confidence: 0.1, sessionId: 'rf', normalizedQuestion: 'old topic', createdAt: new Date(now - 40 * day).toISOString() },
    ]);
    writeJson('products.json', [
      { id: 'p1', productType: 'Mini Pro', color: 'Blue', sellPrice: 129, lots: [{ qty: 2 }] },
      { id: 'p2', productType: 'Mini Pro', color: 'Gray', sellPrice: 129, lots: [{ qty: 0 }] },
    ]);
    writeJson('assistant-improvement-reports.json', []);

    const reportUnauth = await request('/api/admin/assistant-improvement-report/data');
    assert.strictEqual(reportUnauth.res.status, 401, 'report data requires authentication');

    const from = new Date(now - 7 * day).toISOString().slice(0, 10);
    const to = new Date(now).toISOString().slice(0, 10);
    const reportData = await request(`/api/admin/assistant-improvement-report/data?dateFrom=${from}&dateTo=${to}&locale=en`, { headers: auth(token) });
    assert.strictEqual(reportData.res.status, 200);
    assert.strictEqual(reportData.body.totalQuestions, 9, 'date and locale filtering are applied');
    assert.strictEqual(reportData.body.uniqueSessions, 8);
    assert.strictEqual(reportData.body.unmatchedCount, 4);
    assert.ok(reportData.body.repeatedQuestions.some(group => group.normalizedQuestion === 'delivery to riga' && group.count === 2), 'repeated question grouping works');
    assert.ok(reportData.body.missingFaqCandidates[0].priorityScore >= reportData.body.missingFaqCandidates.at(-1).priorityScore, 'missing FAQ candidates are priority sorted');
    assert.ok(reportData.body.weakFaqStats.some(item => item.faqId === 'setup'), 'weak FAQ is identified');
    assert.ok(reportData.body.intentDistribution.some(item => item.intent === 'product_selection'), 'intent distribution is included');
    assert.strictEqual(reportData.body.conversationFunnels.startedSelection, 1, 'conversation funnel tracks selection starts');
    assert.strictEqual(reportData.body.conversationFunnels.recommendationShown, 1, 'conversation funnel tracks recommendations');
    assert.ok(reportData.body.failedConversations.some(item => item.reasons.includes('human_handoff_requested')), 'human handoff is a failed conversation');
    assert.strictEqual(reportData.body.missingFaqCandidates.some(item => ['thanks', 'test'].includes(item.title)), false, 'end/noise messages are excluded from missing FAQ candidates');
    assert.strictEqual(reportData.body.conversationFunnels.failedConversations, 1, 'end/noise are excluded from failed conversation counts');

    const cleanQueue = await request('/api/admin/assistant-questions?preset=needs_improvement&page=1&limit=50', { headers: auth(token) });
    assert.strictEqual(cleanQueue.res.status, 200);
    assert.strictEqual(cleanQueue.body.items.some(item => ['end', 'noise'].includes(item.id)), false, 'end/noise messages are excluded from improvement queue');
    assert.ok(reportData.body.comparisonWithPreviousPeriod.newlyAppearingQuestionTopics.includes('delivery to riga'), 'trend comparison finds new topics');
    assert.strictEqual(JSON.stringify(reportData.body).includes('test@example.com'), false, 'PII email is redacted from report data');
    assert.strictEqual(JSON.stringify(reportData.body).includes('+371 22222222'), false, 'PII phone is redacted from report data');

    const exportUnauth = await request(`/api/admin/assistant-improvement-report/export?dateFrom=${from}&dateTo=${to}&locale=en`);
    assert.strictEqual(exportUnauth.res.status, 401, 'AI export requires authentication');

    const exportRes = await request(`/api/admin/assistant-improvement-report/export?dateFrom=${from}&dateTo=${to}&locale=en&includeConversations=true`, { headers: auth(token) });
    assert.strictEqual(exportRes.res.status, 200);
    assert.match(exportRes.res.headers.get('content-type') || '', /application\/json/, 'AI export returns JSON');
    assert.match(exportRes.res.headers.get('content-disposition') || '', /assistant-ai-report-/, 'AI export is downloadable');
    assert.strictEqual(exportRes.body.purpose, 'assistant_improvement_llm_review');
    assert.strictEqual(exportRes.body.parameters.includeConversations, true);
    assert.strictEqual(exportRes.body.overview.totalQuestions, 9);
    assert.ok(Array.isArray(exportRes.body.faqEntries) && exportRes.body.faqEntries.length > 0, 'AI export includes all FAQ entries');
    assert.ok(exportRes.body.faqUsageStatistics.some(item => item.faqId === 'setup'), 'AI export includes FAQ usage statistics');
    assert.ok(exportRes.body.negativeFeedbackSummary.examples.length, 'AI export includes negative feedback examples');
    assert.ok(exportRes.body.lowConfidenceQuestions.length, 'AI export includes low-confidence questions');
    assert.ok(exportRes.body.exampleConversations.some(item => item.conversations.length), 'AI export includes representative conversations');
    const exportedConversation = exportRes.body.conversationHistory.find(item => item.intentSequence.includes('product_selection') && item.intentSequence.includes('music_use_case'));
    assert.ok(exportedConversation, 'AI export includes grouped conversation history and intent sequence');
    assert.ok(exportedConversation.messages.some(item => item.assistantAnswer === 'What matters most?'), 'AI export includes assistant answers');
    assert.ok(exportedConversation.followUpQuestions.includes('What matters most?'), 'AI export includes follow-up questions');
    assert.strictEqual(exportedConversation.recommendationShown.modelId, 'miniPro', 'AI export includes recommendation shown');
    assert.strictEqual(exportedConversation.sessionOutcome, 'recommendation_shown', 'AI export includes session outcome');
    assert.ok(exportRes.body.assistantAnswers.some(item => item.assistantAnswer === 'Delivery answer'), 'AI export includes assistant answers');
    assert.ok(exportRes.body.currentFaqTextsByLanguage.en?.length, 'AI export includes FAQ texts by language');
    assert.ok(exportRes.body.productCatalogMetadata.some(item => item.id === 'p1'), 'AI export includes in-stock product metadata');
    assert.strictEqual(exportRes.body.productCatalogMetadata.some(item => item.id === 'p2'), false, 'AI export omits unavailable catalog products');
    const exportJson = JSON.stringify(exportRes.body);
    assert.strictEqual(exportJson.includes('test@example.com'), false, 'AI export redacts emails');
    assert.strictEqual(exportJson.includes('+371 22222222'), false, 'AI export redacts phone numbers');
    assert.strictEqual(exportJson.includes('userAgent'), false, 'AI export does not include user agents');
    assert.strictEqual(exportJson.includes('ipAddress'), false, 'AI export does not include IP address fields');
    assert.strictEqual(exportJson.includes('remoteAddress'), false, 'AI export does not include remote address fields');
    assert.strictEqual(exportJson.includes('authorization'), false, 'AI export does not include auth fields');
    assert.strictEqual(exportJson.includes('cookie'), false, 'AI export does not include cookies');

    const exportNoConversations = await request(`/api/admin/assistant-improvement-report/export?dateFrom=${from}&dateTo=${to}&locale=en&includeConversations=false`, { headers: auth(token) });
    assert.strictEqual(exportNoConversations.res.status, 200);
    assert.deepStrictEqual(exportNoConversations.body.exampleConversations, [], 'AI export can omit conversations');
    assert.deepStrictEqual(exportRes.body.overview, exportNoConversations.body.overview, 'AI export overview is deterministic across conversation modes');

    const generated = await request('/api/admin/assistant-improvement-report/generate', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ dateFrom: from, dateTo: to, locale: 'en', aiMock: 'valid' }),
    });
    assert.strictEqual(generated.res.status, 200);
    assert.strictEqual(generated.body.ok, true);
    assert.ok(generated.body.report.id, 'generated report has id');
    assert.ok(generated.body.report.recommendedActions.length, 'AI recommendations are stored');

    const history = await request('/api/admin/assistant-improvement-reports', { headers: auth(token) });
    assert.strictEqual(history.res.status, 200);
    assert.ok(history.body.reports.some(report => report.id === generated.body.report.id), 'report history includes generated report');

    const savedReport = await request(`/api/admin/assistant-improvement-reports/${generated.body.report.id}`, { headers: auth(token) });
    assert.strictEqual(savedReport.res.status, 200);
    assert.strictEqual(savedReport.body.report.id, generated.body.report.id);

    const actionUpdate = await request(`/api/admin/assistant-improvement-reports/${generated.body.report.id}/actions/0`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ status: 'accepted', adminNote: '<b>check</b>' }),
    });
    assert.strictEqual(actionUpdate.res.status, 200, 'recommendation status update works');

    const malformed = await request('/api/admin/assistant-improvement-report/generate', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ dateFrom: from, dateTo: to, locale: 'en', aiMock: 'malformed' }),
    });
    assert.strictEqual(malformed.res.status, 200);
    assert.strictEqual(malformed.body.report.status, 'failed', 'malformed AI response is stored as failed');

    const aiFailure = await request('/api/admin/assistant-improvement-report/generate', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ dateFrom: from, dateTo: to, locale: 'en', aiMock: 'failure' }),
    });
    assert.strictEqual(aiFailure.res.status, 200);
    assert.strictEqual(aiFailure.body.report.status, 'failed', 'AI provider failure is handled');

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
