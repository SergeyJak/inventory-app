const path = require('path');
const { spawn } = require('child_process');

function spawnNode(script) {
  return spawn(process.execPath, [path.join(__dirname, '..', script)], {
    env: process.env,
    stdio: 'inherit',
  });
}

const server = spawnNode('server.js');
const backupsEnabled = String(process.env.ENABLE_AUTOMATED_BACKUPS || '').toLowerCase() === 'true';
let scheduler = backupsEnabled ? spawnNode('scripts/backup-scheduler.js') : null;
let shuttingDown = false;

if (backupsEnabled) {
  console.log('[start] automated backups enabled');
} else {
  console.log('[start] automated backups disabled for this service');
}

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

function watchScheduler(child) {
  if (!child) return;
  child.on('exit', code => {
    if (shuttingDown || !backupsEnabled) return;
    console.error('[start] backup scheduler exited with code ' + code + '; restarting');
    setTimeout(() => {
      if (!shuttingDown && backupsEnabled) {
        scheduler = spawnNode('scripts/backup-scheduler.js');
        watchScheduler(scheduler);
      }
    }, 5000).unref();
  });
}

watchScheduler(scheduler);

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
