const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { createMailService } = require('../mail-service');
const { startServer } = require('./helpers/safety-server.cjs');

test('malformed inventory credentials return 400 without terminating the service', async () => {
  const server = await startServer();
  try {
    for (const password of [{}, [], 123, true]) {
      const res = await server.request('/api/login', { method: 'POST', body: { username: 'admin', password } }).catch(() => null);
      assert.equal(res?.status, 400, 'non-string password must be rejected without losing the connection');
    }
    const good = await server.request('/api/login', { method: 'POST', body: { username: 'admin', password: 'safety-test-password' } });
    assert.equal(good.status, 200);
    assert.equal((await good.json()).role, 'admin');
  } finally { await server.close(); }
});

test('deactivation, password changes and deletion revoke mailbox cookies', async () => {
  let account = { _id: new ObjectId(), email: 'safety@heysmart.lv', active: true, passwordHash: await bcrypt.hash('old-test-password', 4) };
  const matches = q => account && Object.entries(q).every(([k, v]) => String(account[k]) === String(v));
  const db = { collection(name) {
    if (name === 'mail_accounts') return {
      findOne: async q => matches(q) ? { ...account } : null,
      updateOne: async (q, p) => { if (!matches(q)) return { modifiedCount: 0 }; Object.assign(account, p.$set); for (const [k,v] of Object.entries(p.$inc || {})) account[k] = (account[k] || 0) + v; return { modifiedCount: 1 }; },
      findOneAndUpdate: async (q, p) => { if (!matches(q)) return null; Object.assign(account, p.$set); for (const [k,v] of Object.entries(p.$inc || {})) account[k] = (account[k] || 0) + v; return { ...account }; },
      deleteOne: async q => { if (!matches(q)) return { deletedCount: 0 }; account = null; return { deletedCount: 1 }; },
    };
    return { find: () => ({ sort() { return this; }, limit() { return this; }, toArray: async () => [{ _id: new ObjectId(), subject: 'private message' }] }), deleteMany: async () => ({ deletedCount: 1 }) };
  } };
  const app = express(); app.use(express.json());
  const mail = createMailService({ express, dbProvider: () => db, jwtSecret: 'isolated-mail-secret', requireAuth: (req,res,next) => next(), requireAdmin: (req,res,next) => next() });
  app.use(mail.router);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options = {}) => fetch(base + url, options);
  const login = async password => {
    const res = await request('/api/mail/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'safety@heysmart.lv', password }) });
    assert.equal(res.status, 200); return res.headers.get('set-cookie').split(';')[0];
  };
  const inbox = cookie => request('/api/mail/messages', { headers: { cookie } });
  try {
    const id = String(account._id);
    const cookie = await login('old-test-password');
    assert.equal((await inbox(cookie)).status, 200, 'legacy account without version must support fresh login');
    await request(`/api/admin/mail/accounts/${id}/deactivate`, { method: 'POST' });
    assert.equal((await inbox(cookie)).status, 401, 'inactive mailbox must not remain readable');
    await request(`/api/admin/mail/accounts/${id}/activate`, { method: 'POST' });
    assert.equal((await inbox(cookie)).status, 401, 'reactivation must not revive an old cookie');
    const cookie2 = await login('old-test-password');
    const reset = await request(`/api/admin/mail/accounts/${id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'new-test-password', confirmPassword: 'new-test-password' }) });
    assert.equal(reset.status, 200);
    assert.equal((await inbox(cookie2)).status, 401, 'manual password change must revoke previous cookie');
    const cookie3 = await login('new-test-password');
    const generated = await request(`/api/admin/mail/accounts/${id}/reset-password`, { method: 'POST' });
    assert.equal(generated.status, 200);
    assert.equal((await inbox(cookie3)).status, 401, 'generated password reset must revoke previous cookie');
    const cookie4 = await login((await generated.json()).password);
    await request(`/api/admin/mail/accounts/${id}`, { method: 'DELETE' });
    assert.equal((await inbox(cookie4)).status, 401, 'deleted mailbox must be inaccessible');
  } finally { await new Promise(resolve => server.close(resolve)); await mail.shutdownMailPoller(); }
});
