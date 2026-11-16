const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decodeArchive } = require('../scripts/mongo-backup-lib');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heysmart-preview-cleanup-'));
process.env.BACKUP_DIR = dir;

const {
  archivePreviewCollections, buildPlan, fetchOpenPRs,
  parsePreviewName, planHash, validateApplyArgs,
} = require('../scripts/cleanup-preview-collections');

async function run() {
  assert.deepEqual(parsePreviewName('products__inventory-app-pr-74'),
    { name: 'products__inventory-app-pr-74', base: 'products', pr: 74 });
  assert.deepEqual(parsePreviewName('financeIncome__pr-26'),
    { name: 'financeIncome__pr-26', base: 'financeIncome', pr: 26 });
  for (const name of [
    'products', 'mail_messages', 'financeIncome', 'assistantQuestions',
    'products__inventory-app-pr-0', 'products__inventory-app-pr-74x',
    'mail_messages__inventory-app-pr-74',
    'other__pr-73', 'products__pr-73_extra',
  ]) {
    assert.equal(parsePreviewName(name), null, 'must never approve ' + name);
  }

  const input = [
    'products', 'financeInvoices', 'assistantQuestions', 'mail_messages',
    'products__inventory-app-pr-74', 'financeIncome__pr-74',
    'transactions__inventory-app-pr-73', 'products__pr-72',
  ];
  const p = buildPlan(input, [74]);
  assert.deepEqual(p.candidates, ['products__pr-72', 'transactions__inventory-app-pr-73']);
  assert.equal(p.candidateCount, 2);
  assert.deepEqual(p.protectedNames, ['financeIncome__pr-74', 'products__inventory-app-pr-74']);
  assert.equal(p.workingCollectionCount, 4);
  assert.equal(p.hash, planHash(p.candidates));
  assert.equal(p.hash, planHash([...p.candidates].reverse()));

  assert.equal(validateApplyArgs([], p), false, 'dry-run must not require any deletion flags');
  const flags = [
    '--apply', '--ack-local-backup', '--confirm=DELETE_STALE_PREVIEWS',
    '--plan-sha=' + p.hash, '--expected-count=2',
  ];
  assert.equal(validateApplyArgs(flags, p), true);
  for (const i of [1, 2, 3, 4]) {
    assert.throws(() => validateApplyArgs(flags.filter((_, j) => i !== j), p));
  }
  assert.throws(() => validateApplyArgs(flags, buildPlan(input.concat('products__pr-71'), [74])), /changed/);

  assert.throws(
    () => buildPlan(['products__inventory-app-pr-74', 'mail_messages__pr-73'], []),
    /Unrecognized preview collections/,
  );
  const huge = Array.from({ length: 601 }, (_, i) => 'products__pr-' + (i + 1));
  assert.throws(() => buildPlan(huge, []), /Safety limit/);

  const pages = [];
  const open = await fetchOpenPRs(async url => {
    pages.push(url);
    if (pages.length === 1) {
      return {
        ok: true,
        json: async () => [{ number: 74 }],
        headers: { get: () => '<https://api.github.com/repos/SergeyJak/inventory-app/pulls?state=open&per_page=100&page=2>; rel="next"' },
      };
    }
    return { ok: true, json: async () => [{ number: 76 }], headers: { get: () => '' } };
  });
  assert.deepEqual(open, [74, 76]);
  assert.equal(pages.length, 2);
  await assert.rejects(
    fetchOpenPRs(async () => ({ ok: false, status: 403 })),
    /GitHub open-PR check failed/,
  );

  const mock = {
    collection(name) {
      return { find() {
        return { toArray: async () => [{ _id: name, value: 'safely archived' }] };
      } };
    },
  };
  const eligible = buildPlan(['products__pr-72', 'transactions__inventory-app-pr-73'], []);
  const archive = await archivePreviewCollections(mock, eligible);
  assert.equal(archive.collectionCount, 2);
  assert.equal(archive.documentCount, 2);
  assert.ok(archive.path.startsWith(dir));
  const restored = decodeArchive(fs.readFileSync(archive.path));
  assert.deepEqual(restored.collections.map(c => c.name).sort(), eligible.candidates);
  assert.deepEqual(restored.collections.map(c => c.documents[0].value), ['safely archived', 'safely archived']);

  console.log('preview cleanup safety checks passed; no collections deleted');
}

run().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => fs.rmSync(dir, { recursive: true, force: true }));
