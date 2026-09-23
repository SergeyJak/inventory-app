const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { BSON } = require('mongodb');

const EJSON = BSON && BSON.EJSON;
if (!EJSON) throw new Error('MongoDB EJSON support is unavailable');

const BACKUP_FORMAT_VERSION = 1;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function formatBackupTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function backupFileName(dbName, date = new Date()) {
  return dbName + '-' + formatBackupTimestamp(date) + '.backup.json.gz';
}

function parseBackupTimestamp(filename, dbName = 'inventory') {
  if (!filename.startsWith(dbName + '-') || !filename.endsWith('.backup.json.gz')) return null;
  const stamp = filename.slice((dbName + '-').length, -'.backup.json.gz'.length);
  if (!/^\d{8}T\d{6}Z$/.test(stamp)) return null;
  const iso = stamp.slice(0, 4) + '-' + stamp.slice(4, 6) + '-' + stamp.slice(6, 8)
    + 'T' + stamp.slice(9, 11) + ':' + stamp.slice(11, 13) + ':' + stamp.slice(13, 15) + 'Z';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function retentionPlan(files, options = {}) {
  const dbName = options.dbName || 'inventory';
  const daily = Math.max(1, Number(options.daily) || 7);
  const weekly = Math.max(0, Number(options.weekly) || 4);
  const monthly = Math.max(0, Number(options.monthly) || 3);

  const valid = files
    .map(name => ({ name, date: parseBackupTimestamp(name, dbName) }))
    .filter(item => item.date)
    .sort((a, b) => b.date - a.date);

  const keep = new Set();
  const daySeen = new Set();
  const weekSeen = new Set();
  const monthSeen = new Set();

  for (const item of valid) {
    const day = item.date.toISOString().slice(0, 10);
    if (daySeen.size < daily && !daySeen.has(day)) {
      daySeen.add(day);
      keep.add(item.name);
    }
  }

  for (const item of valid) {
    const week = isoWeekKey(item.date);
    if (weekSeen.size < weekly && !weekSeen.has(week)) {
      weekSeen.add(week);
      keep.add(item.name);
    }
  }

  for (const item of valid) {
    const month = item.date.toISOString().slice(0, 7);
    if (monthSeen.size < monthly && !monthSeen.has(month)) {
      monthSeen.add(month);
      keep.add(item.name);
    }
  }

  if (valid[0]) keep.add(valid[0].name);

  return {
    keep: valid.filter(item => keep.has(item.name)).map(item => item.name),
    remove: valid.filter(item => !keep.has(item.name)).map(item => item.name),
    ignored: files.filter(name => !parseBackupTimestamp(name, dbName)),
  };
}

function encodeArchive({ dbName, collections, createdAt = new Date() }) {
  const payload = {
    version: BACKUP_FORMAT_VERSION,
    database: dbName,
    createdAt: createdAt.toISOString(),
    collections: [],
  };

  for (const collection of collections) {
    const ejson = EJSON.stringify(collection.documents, { relaxed: false });
    payload.collections.push({
      name: collection.name,
      count: collection.documents.length,
      sha256: sha256(ejson),
      ejson,
    });
  }

  const json = JSON.stringify(payload);
  return zlib.gzipSync(Buffer.from(json, 'utf8'), { level: zlib.constants.Z_BEST_COMPRESSION });
}

function decodeArchive(buffer) {
  const json = zlib.gunzipSync(buffer).toString('utf8');
  const payload = JSON.parse(json);
  if (payload.version !== BACKUP_FORMAT_VERSION) {
    throw new Error('Unsupported backup version: ' + payload.version);
  }
  if (!payload.database || !Array.isArray(payload.collections)) {
    throw new Error('Invalid backup manifest');
  }

  const names = new Set();
  const collections = payload.collections.map(entry => {
    if (!entry || typeof entry.name !== 'string' || !entry.name || names.has(entry.name)) {
      throw new Error('Invalid or duplicate collection in backup');
    }
    names.add(entry.name);
    if (sha256(entry.ejson) !== entry.sha256) {
      throw new Error('Checksum mismatch for collection ' + entry.name);
    }
    const documents = EJSON.parse(entry.ejson, { relaxed: false });
    if (!Array.isArray(documents) || documents.length !== entry.count) {
      throw new Error('Document count mismatch for collection ' + entry.name);
    }
    return { name: entry.name, count: entry.count, sha256: entry.sha256, documents };
  });

  return {
    version: payload.version,
    database: payload.database,
    createdAt: payload.createdAt,
    collections,
  };
}

function writeArchiveAtomic(targetPath, buffer) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmp = targetPath + '.tmp-' + process.pid + '-' + Date.now();
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, buffer);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, targetPath);
}

function writeJsonAtomic(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmp = targetPath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, targetPath);
}

module.exports = {
  BACKUP_FORMAT_VERSION,
  backupFileName,
  decodeArchive,
  encodeArchive,
  parseBackupTimestamp,
  retentionPlan,
  sha256,
  writeArchiveAtomic,
  writeJsonAtomic,
};
