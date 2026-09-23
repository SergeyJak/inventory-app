const path = require('path');
const { spawn } = require('child_process');

function spawnNode(script) {
  return spawn(process.execPath, [path.join(__dirname, '..', script)], {
    env: process.env,
    stdio: 'inherit',
  });
}

const server = spawnNode('server.js');
let scheduler = spawnNode('scripts/backup-scheduler.js');
let shuttingDown = false;

function stopChild(child) {
  if (child && !child.killed) child.kill('SIGTERM');
}

function shutdown(signal, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChild(server);
  stopChild(scheduler);
  if (signal) console.log('[start] received ' + signal);
  setTimeout(() => process.exit(code), 250).unref();
}

server.on('exit', code => {
  if (shuttingDown) return;
  console.error('[start] web server exited with code ' + code);
  shutdown(null, Number.isInteger(code) ? code : 1);
});

scheduler.on('exit', code => {
  if (shuttingDown) return;
  console.error('[start] backup scheduler exited with code ' + code + '; restarting');
  setTimeout(() => {
    if (!shuttingDown) scheduler = spawnNode('scripts/backup-scheduler.js');
  }, 5000).unref();
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
