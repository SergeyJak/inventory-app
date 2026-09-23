const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ObjectId } = require('mongodb');
const {
  backupFileName,
  decodeArchive,
  encodeArchive,
  retentionPlan,
  writeArchiveAtomic,
} = require('../scripts/mongo-backup-lib');
const { assertSafeRestoreTarget, isPreviewCollection } = require('../scripts/backup-mongo');

(function archiveRoundTrip() {
  const id = new ObjectId();
  const createdAt = new Date('2026-09-23T01:15:00.000Z');
  const buffer = encodeArchive({
    dbName: 'inventory',
    createdAt,
    collections: [
      { name: 'products', documents: [{ _id: id, id: 'p1', qty: 2, createdAt }] },
      { name: 'financeInvoices', documents: [{ _id: 'inv-001', invoiceNo: '001', total: 100 }] },
    ],
  });

  const decoded = decodeArchive(buffer);
  assert.strictEqual(decoded.database, 'inventory');
  assert.strictEqual(decoded.collections.length, 2);
  assert.strictEqual(decoded.collections[0].count, 1);
  assert(decoded.collections[0].documents[0]._id instanceof ObjectId);
  assert.strictEqual(String(decoded.collections[0].documents[0]._id), String(id));
  assert(decoded.collections[0].documents[0].createdAt instanceof Date);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-auto-backup-'));
  const target = path.join(tmp, backupFileName('inventory', createdAt));
  writeArchiveAtomic(target, buffer);
  assert(fs.existsSync(target));
  assert.strictEqual(decodeArchive(fs.readFileSync(target)).collections.length, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
})();

(function checksumFailureIsDetected() {
  const zlib = require('zlib');
  const buffer = encodeArchive({
    dbName: 'inventory',
    collections: [{ name: 'products', documents: [{ id: 'p1' }] }],
  });
  const payload = JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
  payload.collections[0].ejson = payload.collections[0].ejson.replace('p1', 'p2');
  const tampered = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  assert.throws(() => decodeArchive(tampered), /Checksum mismatch/);
})();

(function retentionKeepsRecoveryPoints() {
  const files = [];
  for (let i = 0; i < 45; i++) {
    const d = new Date(Date.UTC(2026, 8, 23 - i, 1, 15, 0));
    files.push(backupFileName('inventory', d));
  }
  files.push('latest.json');
  const plan = retentionPlan(files, { dbName: 'inventory', daily: 7, weekly: 4, monthly: 3 });

  assert(plan.keep.includes(files[0]), 'newest backup must always be retained');
  assert(plan.keep.length >= 7, 'daily recovery points should be retained');
  assert(plan.remove.length > 0, 'old recovery points should be pruned');
  assert.deepStrictEqual(plan.ignored, ['latest.json']);
})();

(function previewCollectionsAreExcluded() {
  assert.strictEqual(isPreviewCollection('products__inventory-app-pr-24'), true);
  assert.strictEqual(isPreviewCollection('financeIncome__pr-44'), true);
  assert.strictEqual(isPreviewCollection('products'), false);
  assert.strictEqual(isPreviewCollection('migrationBackup_20260920_subAccounts'), false);
})();

(function restoreTargetGuard() {
  assert.strictEqual(assertSafeRestoreTarget('inventory_backup_restore_test_123_abc'), true);
  for (const unsafe of [
    'inventory',
    'production',
    '',
    'inventory_backup_restore_test_',
    'inventory_backup_restore_test_../inventory',
    'inventory_backup_restore_test_$bad',
  ]) {
    assert.throws(() => assertSafeRestoreTarget(unsafe), /restore target|Restore-test target|Production restore/i);
  }
})();

console.log('automated backup regression passed');
