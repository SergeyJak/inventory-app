require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const {
  backupFileName,
  decodeArchive,
  encodeArchive,
  retentionPlan,
  writeArchiveAtomic,
  writeJsonAtomic,
} = require('./mongo-backup-lib');

const DB_NAME = process.env.MONGO_BACKUP_DB || 'inventory';
const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';
const RESTORE_TEST_PREFIX = 'hs_restore_test_';
const MAX_DB_NAME_BYTES = 38;

function isPreviewCollection(name) {
  return /__inventory-app-pr-|__pr-/i.test(name);
}

function assertSafeRestoreTarget(name) {
  if (typeof name !== 'string' || !name.startsWith(RESTORE_TEST_PREFIX)) {
    throw new Error('Unsafe restore target rejected: ' + String(name));
  }
  if (name === DB_NAME || name === 'inventory' || name.length <= RESTORE_TEST_PREFIX.length) {
    throw new Error('Production restore target rejected: ' + name);
  }
  if (!/^hs_restore_test_[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error('Restore-test target contains unsafe characters: ' + name);
  }
  if (Buffer.byteLength(name, 'utf8') > MAX_DB_NAME_BYTES) {
    throw new Error('Restore-test target exceeds Atlas database-name limit: ' + name);
  }
  return true;
}

function createRestoreTestDbName() {
  const name = RESTORE_TEST_PREFIX
    + Date.now().toString(36)
    + '_'
    + crypto.randomBytes(3).toString('hex');
  assertSafeRestoreTarget(name);
  return name;
}

async function readProductionCollections(db) {
  const listed = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = listed
    .map(item => item.name)
    .filter(name => name && !name.startsWith('system.') && !isPreviewCollection(name))
    .sort();

  const collections = [];
  for (const name of names) {
    const documents = await db.collection(name).find({}).toArray();
    collections.push({ name, documents });
  }
  return collections;
}

function applyRetention() {
  const files = fs.existsSync(BACKUP_DIR)
    ? fs.readdirSync(BACKUP_DIR).filter(name => name.endsWith('.backup.json.gz'))
    : [];
  const plan = retentionPlan(files, {
    dbName: DB_NAME,
    daily: Number(process.env.BACKUP_RETENTION_DAILY) || 7,
    weekly: Number(process.env.BACKUP_RETENTION_WEEKLY) || 4,
    monthly: Number(process.env.BACKUP_RETENTION_MONTHLY) || 3,
  });
  for (const name of plan.remove) {
    fs.rmSync(path.join(BACKUP_DIR, name), { force: true });
  }
  return plan;
}

async function restoreTest(client, archivePath) {
  const archive = decodeArchive(fs.readFileSync(archivePath));
  const tempName = createRestoreTestDbName();
  const tempDb = client.db(tempName);

  try {
    console.log('[backup] restore target verified safe: ' + tempName + '; production DB untouched');
    for (const collection of archive.collections) {
      if (collection.documents.length > 0) {
        await tempDb.collection(collection.name).insertMany(collection.documents, { ordered: true });
      } else {
        await tempDb.createCollection(collection.name);
      }
      const count = await tempDb.collection(collection.name).countDocuments({});
      if (count !== collection.count) {
        throw new Error('Restore verification failed for ' + collection.name + ': ' + count + '/' + collection.count);
      }
    }
    return { ok: true, database: tempName, collections: archive.collections.length };
  } finally {
    assertSafeRestoreTarget(tempName);
    await tempDb.dropDatabase().catch(() => {});
  }
}

async function createBackup(client) {
  const db = client.db(DB_NAME);
  const startedAt = new Date();
  const collections = await readProductionCollections(db);
  const archiveBuffer = encodeArchive({ dbName: DB_NAME, collections, createdAt: startedAt });
  const fileName = backupFileName(DB_NAME, startedAt);
  const targetPath = path.join(BACKUP_DIR, fileName);

  writeArchiveAtomic(targetPath, archiveBuffer);
  const verified = decodeArchive(fs.readFileSync(targetPath));
  const retention = applyRetention();

  const status = {
    ok: true,
    database: DB_NAME,
    createdAt: startedAt.toISOString(),
    fileName,
    path: targetPath,
    sizeBytes: archiveBuffer.length,
    collectionCount: verified.collections.length,
    documentCount: verified.collections.reduce((sum, item) => sum + item.count, 0),
    retainedFiles: retention.keep.length,
  };
  writeJsonAtomic(path.join(BACKUP_DIR, 'latest.json'), status);
  fs.rmSync(path.join(BACKUP_DIR, 'last-error.json'), { force: true });
  return status;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  try {
    if (process.argv.includes('--restore-test')) {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(name => name.endsWith('.backup.json.gz'))
        .sort()
        .reverse();
      if (!files.length) throw new Error('No backup archive is available for restore test');
      const archivePath = path.join(BACKUP_DIR, files[0]);
      const result = await restoreTest(client, archivePath);
      console.log('[backup] restore test OK: ' + files[0] + ' (' + result.collections + ' collections)');
      return;
    }

    const status = await createBackup(client);
    console.log('[backup] OK: ' + status.fileName + ', ' + status.collectionCount + ' collections, '
      + status.documentCount + ' documents, ' + status.sizeBytes + ' bytes');
  } catch (error) {
    const failure = {
      ok: false,
      failedAt: new Date().toISOString(),
      message: error && error.message ? error.message : String(error),
    };
    try {
      writeJsonAtomic(path.join(BACKUP_DIR, 'last-error.json'), failure);
    } catch (_) {}
    throw error;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('[backup] FAILED', error);
    process.exit(1);
  });
}

module.exports = {
  MAX_DB_NAME_BYTES,
  RESTORE_TEST_PREFIX,
  applyRetention,
  assertSafeRestoreTarget,
  createBackup,
  createRestoreTestDbName,
  isPreviewCollection,
  readProductionCollections,
  restoreTest,
};
