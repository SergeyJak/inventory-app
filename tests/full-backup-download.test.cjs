const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { encodeArchive } = require('../scripts/mongo-backup-lib');
const { createVerifiedFullBackup, expectedProductionNames } = require('../scripts/full-backup-export');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'heysmart-full-export-'));

function setup(collections, listedNames = collections.map(c => c.name), statusChanges = {}, bytes) {
  const filePath = path.join(temp, 'archive-' + Math.random().toString(36).slice(2) + '.backup.json.gz');
  const content = bytes || encodeArchive({ dbName: 'inventory', collections, createdAt: new Date('2026-11-16T20:00:00.000Z') });
  fs.writeFileSync(filePath, content);
  const client = {
    db(name) {
      assert.equal(name, 'inventory');
      return { listCollections: () => ({ toArray: async () => listedNames.map(name => ({ name })) }) };
    },
  };
  const status = {
    database: 'inventory',
    path: filePath,
    fileName: 'inventory-20261116T200000Z.backup.json.gz',
    collectionCount: collections.length,
    documentCount: collections.reduce((sum, item) => sum + item.documents.length, 0),
    sizeBytes: content.length,
    ...statusChanges,
  };
  return { client, backup: async () => status };
}

(async () => {
  try {
    const collections = [
      { name: 'products', documents: [{ _id: 'item-1', qty: 2 }] },
      { name: 'financeInvoices', documents: [{ _id: 'inv-1', total: 100 }] },
      { name: 'mail_messages', documents: [{ _id: 'mail-1', subject: 'Test' }] },
      { name: 'assistantQuestions', documents: [{ _id: 'q-1', question: 'Mini 3' }] },
      { name: 'transactions', documents: [] },
    ];
    const listedNames = [...collections.map(c => c.name), 'financeInvoices__inventory-app-pr-73', 'products__pr-74'];
    assert.deepEqual(expectedProductionNames(listedNames.map(name => ({ name }))), collections.map(c => c.name).sort());

    const test = setup(collections, listedNames);
    const download = await createVerifiedFullBackup(test.client, test.backup);
    assert.match(download.filename, /^heysmart-full-inventory-\d{8}T\d{6}Z\.backup\.json\.gz$/);
    assert.equal(download.collectionCount, 5);
    assert.equal(download.documentCount, 4);
    assert.ok(download.content.length);
    assert.equal(download.createdAt, '2026-11-16T20:00:00.000Z');

    await assert.rejects(
      createVerifiedFullBackup(...Object.values(setup(collections.slice(0, 4), listedNames))),
      /missing or includes unexpected/,
    );
    const wrongDb = setup(collections, undefined, { database: 'other' });
    await assert.rejects(createVerifiedFullBackup(wrongDb.client, wrongDb.backup), /expected database/);
    const badManifest = setup(collections, undefined, { documentCount: 999 });
    await assert.rejects(createVerifiedFullBackup(badManifest.client, badManifest.backup), /manifest/);

    const damagedBytes = Buffer.from(testDownloadData(collections));
    damagedBytes[damagedBytes.length - 1] ^= 0xff;
    const damaged = setup(collections, undefined, {}, damagedBytes);
    await assert.rejects(createVerifiedFullBackup(damaged.client, damaged.backup), /checksum|incorrect|invalid|unexpected|data|header|length|Z_DATA_ERROR/i);
    await assert.rejects(createVerifiedFullBackup(null), /unavailable/);
    console.log('full production backup download regression passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

function testDownloadData(collections) {
  return encodeArchive({ dbName: 'inventory', collections });
}
