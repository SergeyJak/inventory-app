require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const { encodeArchive, decodeArchive, writeArchiveAtomic } = require('./mongo-backup-lib');
const { createVerifiedFullBackup } = require('./full-backup-export');

const DB_NAME = 'inventory';
const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';
const CONFIRMATION = 'DELETE_STALE_PREVIEWS';
const MAX_DELETIONS = 600;
const PR_API = 'https://api.github.com/repos/SergeyJak/inventory-app/pulls?state=open&per_page=100';
const ALLOWED_PREVIEW_BASES = new Set([
  'andreyReturns', 'dataSnapshots', 'dataWriteLocks', 'financeAudit',
  'financeExpenses', 'financeIncome', 'financeInvoiceCounters',
  'financeInvoices', 'hostSubscriptions', 'products', 'subAccounts',
  'transactions',
]);

function parsePreviewName(name) {
  if (typeof name !== 'string') return null;
  const match = /^([A-Za-z][A-Za-z0-9_]*)__(?:inventory-app-pr-|pr-)([1-9]\d{0,5})$/.exec(name);
  if (!match || !ALLOWED_PREVIEW_BASES.has(match[1])) return null;
  return { name, base: match[1], pr: Number(match[2]) };
}

function planHash(names) {
  return crypto.createHash('sha256').update(names.slice().sort().join('\n')).digest('hex');
}

function buildPlan(listed, openPRs) {
  const open = new Set(openPRs);
  const names = listed.map(item => typeof item === 'string' ? item : item && item.name)
    .filter(name => typeof name === 'string');
  const candidates = [];
  const protectedNames = [];
  const unexpectedPreviewNames = [];
  const baseCounts = new Map();
  const prCounts = new Map();

  for (const name of names) {
    const parsed = parsePreviewName(name);
    if (!parsed) {
      if (/__(?:inventory-app-pr-|pr-)/i.test(name)) unexpectedPreviewNames.push(name);
      continue;
    }
    if (open.has(parsed.pr)) {
      protectedNames.push(name);
      continue;
    }
    candidates.push(name);
    baseCounts.set(parsed.base, (baseCounts.get(parsed.base) || 0) + 1);
    prCounts.set(parsed.pr, (prCounts.get(parsed.pr) || 0) + 1);
  }

  candidates.sort();
  protectedNames.sort();
  unexpectedPreviewNames.sort();
  if (candidates.length > MAX_DELETIONS) throw new Error('Safety limit exceeded: ' + candidates.length);
  if (unexpectedPreviewNames.length) {
    throw new Error('Unrecognized preview collections exist; refusing cleanup: ' + unexpectedPreviewNames.slice(0, 5).join(', '));
  }

  return {
    database: DB_NAME,
    candidates,
    candidateCount: candidates.length,
    hash: planHash(candidates),
    openPRs: [...open].sort((a, b) => a - b),
    protectedNames,
    baseCounts: Object.fromEntries([...baseCounts].sort()),
    prCounts: Object.fromEntries([...prCounts].sort((a, b) => a[0] - b[0])),
    workingCollectionCount: names.length - candidates.length - protectedNames.length,
  };
}

function validateApplyArgs(argv, plan) {
  if (!argv.includes('--apply')) return false;
  const values = {};
  for (const arg of argv) {
    const i = arg.indexOf('=');
    if (i > 0) values[arg.slice(0, i)] = arg.slice(i + 1);
  }
  if (!argv.includes('--ack-local-backup')) throw new Error('Local copy of the working database must be acknowledged');
  if (values['--confirm'] !== CONFIRMATION) throw new Error('Explicit deletion confirmation is required');
  if (values['--plan-sha'] !== plan.hash) throw new Error('Preview cleanup plan hash changed; run dry-run again');
  if (values['--expected-count'] !== String(plan.candidateCount)) throw new Error('Preview cleanup count changed; run dry-run again');
  if (!plan.candidateCount) throw new Error('No closed-PR preview collections found');
  return true;
}

async function fetchOpenPRs(fetchImpl = fetch) {
  let url = PR_API;
  const open = [];
  const seen = new Set();
  for (let page = 0; url && page < 20; page++) {
    if (seen.has(url)) throw new Error('GitHub PR pagination loop');
    seen.add(url);
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'HeySmart-preview-cleanup' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('GitHub open-PR check failed: HTTP ' + response.status);
    const results = await response.json();
    if (!Array.isArray(results)) throw new Error('Invalid GitHub open-PR response');
    for (const item of results) {
      if (!Number.isSafeInteger(item.number) || item.number <= 0) throw new Error('Invalid PR number from GitHub');
      open.push(item.number);
    }
    const link = response.headers.get('link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    if (!next) { url = ''; break; }
    const nextUrl = new URL(next[1]);
    if (nextUrl.origin !== 'https://api.github.com' || nextUrl.pathname !== '/repos/SergeyJak/inventory-app/pulls') {
      throw new Error('Unsafe GitHub pagination target');
    }
    url = nextUrl.href;
  }
  if (url) throw new Error('GitHub PR pagination exceeded safety limit');
  return [...new Set(open)];
}

async function readPlan(db, openPRs) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return buildPlan(collections, openPRs);
}

async function archivePreviewCollections(db, plan) {
  const collections = [];
  for (const name of plan.candidates) {
    const documents = await db.collection(name).find({}).toArray();
    collections.push({ name, documents });
  }

  const buffer = encodeArchive({ dbName: DB_NAME, collections });
  const filename = 'preview-cleanup-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') + '.backup.json.gz';
  const destination = path.join(BACKUP_DIR, filename);
  writeArchiveAtomic(destination, buffer);

  const decoded = decodeArchive(fs.readFileSync(destination));
  const decodedNames = decoded.collections.map(item => item.name).sort();
  if (JSON.stringify(decodedNames) !== JSON.stringify(plan.candidates)) {
    throw new Error('Preview backup does not contain the expected collections');
  }
  return {
    path: destination,
    collectionCount: decoded.collections.length,
    documentCount: decoded.collections.reduce((total, item) => total + item.count, 0),
  };
}

async function main(argv = process.argv.slice(2)) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const apply = argv.includes('--apply');
  if (apply && (!path.isAbsolute(BACKUP_DIR) || !BACKUP_DIR.startsWith('/data/backups'))) {
    throw new Error('Apply requires the persistent /data/backups Railway volume');
  }
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();

  try {
    const db = client.db(DB_NAME);
    const open = await fetchOpenPRs();
    const plan = await readPlan(db, open);

    console.log('[preview-cleanup] ' + JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      database: plan.database,
      candidates: plan.candidateCount,
      workingCollections: plan.workingCollectionCount,
      protectedOpenPRCollections: plan.protectedNames.length,
      openPRs: plan.openPRs,
      sha256: plan.hash,
      perPR: plan.prCounts,
    }));

    if (!apply) console.log('[preview-cleanup] candidate names: ' + JSON.stringify(plan.candidates));

    if (!validateApplyArgs(argv, plan)) {
      console.log('[preview-cleanup] Dry-run only. No collections modified.');
      return plan;
    }

    // A new, verified production backup is mandatory before staging any deletions.
    const workingBackup = await createVerifiedFullBackup(client);
    const productionBackupPath = path.join(BACKUP_DIR, workingBackup.filename.replace(/^heysmart-full-/, ''));
    if (!fs.existsSync(productionBackupPath)) throw new Error('Production backup was not persisted');
    console.log('[preview-cleanup] Verified working backup: ' + productionBackupPath);

    // Unlike normal backups, this archive also preserves the preview data we plan to drop.
    const previewBackup = await archivePreviewCollections(db, plan);
    console.log('[preview-cleanup] Verified preview backup: ' + previewBackup.path +
      ' (' + previewBackup.collectionCount + ' collections, ' + previewBackup.documentCount + ' documents)');

    // Final race check: no open PR or Mongo collection changes since dry-run.
    const freshOpen = await fetchOpenPRs();
    const latest = await readPlan(db, freshOpen);
    if (latest.hash !== plan.hash || latest.candidateCount !== plan.candidateCount ||
        JSON.stringify(latest.openPRs) !== JSON.stringify(plan.openPRs)) {
      throw new Error('Preview collections or open PRs changed during backup; nothing deleted');
    }

    let deleted = 0;
    for (const name of plan.candidates) {
      const parsed = parsePreviewName(name);
      if (!parsed || freshOpen.includes(parsed.pr)) throw new Error('Protected collection encountered; aborting');
      const ok = await db.collection(name).drop();
      if (!ok) throw new Error('Failed to drop collection ' + name);
      deleted++;
    }
    const finalCollections = await db.listCollections({}, { nameOnly: true }).toArray();
    console.log('[preview-cleanup] Done: ' + deleted + ' preview collections removed; ' + finalCollections.length +
      ' remain. Production backup: ' + productionBackupPath + '; preview backup: ' + previewBackup.path);
    return { deleted, remaining: finalCollections.length, productionBackupPath, previewBackupPath: previewBackup.path };
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(error => { console.error('[preview-cleanup] ABORTED:', error.message); process.exitCode = 1; });
}

module.exports = {
  ALLOWED_PREVIEW_BASES,
  CONFIRMATION,
  MAX_DELETIONS,
  archivePreviewCollections,
  buildPlan,
  fetchOpenPRs,
  main,
  parsePreviewName,
  planHash,
  validateApplyArgs,
};
