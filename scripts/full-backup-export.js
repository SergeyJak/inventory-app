const fs = require('fs');
const { createBackup, isPreviewCollection } = require('./backup-mongo');
const { decodeArchive } = require('./mongo-backup-lib');

const DATABASE = 'inventory';

function expectedProductionNames(listed) {
  return listed
    .map(item => item && item.name)
    .filter(name => typeof name === 'string' && name && !name.startsWith('system.') && !isPreviewCollection(name))
    .sort();
}

// Create and verify a fresh archive before any bytes are sent to the browser.
// This backs up all working inventory collections, but deliberately excludes
// the per-PR test copies that are not part of the production inventory.
async function createVerifiedFullBackup(client, backupFn = createBackup) {
  if (!client || typeof client.db !== 'function') {
    throw new Error('MongoDB is unavailable for full backup');
  }

  const listed = await client.db(DATABASE).listCollections({}, { nameOnly: true }).toArray();
  const expected = expectedProductionNames(listed);
  if (!expected.length) throw new Error('No production collections found');

  const status = await backupFn(client);
  if (!status || status.database !== DATABASE || !status.path) {
    throw new Error('Backup was not created for the expected database');
  }

  const content = fs.readFileSync(status.path);
  const archive = decodeArchive(content); // Verifies checksum and document count for every collection.
  if (archive.database !== DATABASE) throw new Error('Backup archive targets a different database');

  const actual = archive.collections.map(collection => collection.name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Backup is missing or includes unexpected production collections');
  }

  const documents = archive.collections.reduce((sum, item) => sum + item.count, 0);
  if (status.collectionCount !== actual.length || status.documentCount !== documents || status.sizeBytes !== content.length) {
    throw new Error('Backup manifest does not match the verified archive');
  }

  return {
    content,
    filename: 'heysmart-full-' + status.fileName,
    createdAt: archive.createdAt,
    collectionCount: actual.length,
    documentCount: documents,
  };
}

module.exports = { createVerifiedFullBackup, expectedProductionNames };
