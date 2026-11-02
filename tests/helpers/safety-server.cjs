const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

async function startServer(overrides = {}, setup = () => {}) {
  const root = path.resolve(__dirname, '../..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-safety-'));
  setup(dir);
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const secret = 'isolated-safety-test-secret';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env, MONGODB_URI: '', IMAP_USER: '', IMAP_PASSWORD: '',
      PORT: String(port), DATA_DIR: dir, JWT_SECRET: secret,
      ADMIN_HASH: bcrypt.hashSync('safety-test-password', 4),
      RAILWAY_ENVIRONMENT_NAME: 'safety-tests', ...overrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', b => { logs += b; });
  child.stderr.on('data', b => { logs += b; });
  const exited = once(child, 'exit');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timeout: ' + logs)), 15000);
      child.stdout.on('data', b => {
        if (String(b).includes('Inventory app running')) { clearTimeout(timer); resolve(); }
      });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited: ' + logs)); });
    });
  } catch (error) { child.kill(); fs.rmSync(dir, { recursive: true, force: true }); throw error; }
  return {
    child, dir,
    async request(url, { role = 'admin', body, headers = {}, ...options } = {}) {
      const token = jwt.sign({ username: role, role }, secret);
      return fetch(`http://127.0.0.1:${port}${url}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    async close() {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exited;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
module.exports = { startServer };
