require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';
const DB_NAME = process.env.MONGO_BACKUP_DB || 'inventory';
const HOUR_UTC = Math.min(23, Math.max(0, Number(process.env.BACKUP_HOUR_UTC) || 1));
const MINUTE_UTC = Math.min(59, Math.max(0, Number(process.env.BACKUP_MINUTE_UTC) || 15));
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

let running = false;

function todayUtcKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function latestBackupDate() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(name => name.startsWith(DB_NAME + '-') && name.endsWith('.backup.json.gz'))
    .sort()
    .reverse();
  if (!files.length) return null;
  const match = files[0].match(/-(\d{4})(\d{2})(\d{2})T/);
  return match ? match[1] + '-' + match[2] + '-' + match[3] : null;
}

function scheduledTimePassed(date = new Date()) {
  const scheduled = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    HOUR_UTC,
    MINUTE_UTC,
    0,
    0
  );
  return date.getTime() >= scheduled;
}

function runBackup(args = []) {
  if (running) return Promise.resolve(false);
  running = true;
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(__dirname, 'backup-mongo.js'), ...args], {
      env: process.env,
      stdio: 'inherit',
    });
    child.on('exit', code => {
      running = false;
      resolve(code === 0);
    });
    child.on('error', error => {
      running = false;
      console.error('[backup-scheduler] failed to start backup process', error);
      resolve(false);
    });
  });
}

async function tick() {
  const now = new Date();
  if (!scheduledTimePassed(now)) return;
  if (latestBackupDate() === todayUtcKey(now)) return;

  const ok = await runBackup();
  if (!ok) return;

  if (now.getUTCDay() === 0) {
    await runBackup(['--restore-test']);
  }
}

console.log('[backup-scheduler] daily backup at ' + String(HOUR_UTC).padStart(2, '0') + ':'
  + String(MINUTE_UTC).padStart(2, '0') + ' UTC -> ' + BACKUP_DIR);

tick().catch(error => console.error('[backup-scheduler] initial tick failed', error));
setInterval(() => {
  tick().catch(error => console.error('[backup-scheduler] tick failed', error));
}, CHECK_INTERVAL_MS);
