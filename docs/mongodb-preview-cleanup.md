# Safe preview-collection cleanup for MongoDB Atlas

**Never run this script automatically at startup or as part of a deploy.** It is a manual maintenance tool for the \`inventory\` database only. It does not touch any other database.

## Preconditions

1. The administrator has downloaded and securely stored a fresh **full production** backup from the HeySmart Backups page. That archive deliberately excludes preview collections, so it does not restore PR-specific data.
2. Use the production inventory-app Railway service, which has \`MONGODB_URI\` and the **persistent** \`/data/backups\` volume mounted. An ephemeral local computer path is not accepted in apply mode.
3. Make sure there are no open PRs whose preview data you wish to delete. The script independently queries the GitHub API and excludes open PRs.
4. Open a **remote** shell inside the deployed Railway service with `railway ssh --service inventory-app --environment production` (after linking the correct Railway project). This requires a registered SSH key. Do **not** use `railway run` or `railway shell`: those execute on your local machine, without the mounted persistent volume.

## Preview (non-destructive, default)

\`\`\`sh
npm run cleanup:previews:plan
# or: node scripts/cleanup-preview-collections.js
\`\`\`

This prints JSON containing the exact candidate count, per-PR counts, protected open PRs, and a SHA-256 plan fingerprint. Copy the \`candidates\` count and \`sha256\` value.

## Execute (requires a separate deliberate action)

\`\`\`sh
node scripts/cleanup-preview-collections.js --apply \
  --ack-local-backup \
  --confirm=DELETE_STALE_PREVIEWS \
  --expected-count=<value-from-dry-run> \
  --plan-sha=<sha256-from-dry-run>
\`\`\`

Before dropping any collection, the script:

1. Checks the live list of open GitHub PRs.
2. Limits eligible names to an explicit allowlist of production collection bases with a complete \`__inventory-app-pr-<number>\` or \`__pr-<number>\` suffix.
3. Requires an exact SHA-256 and count match against the previously reviewed dry-run.
4. Creates and verifies a fresh complete working-data backup on \`/data/backups\`.
5. Archives **all preview collections selected for deletion** separately, verifies each collection checksum and document count, and saves that archive to \`/data/backups/preview-cleanup-*.backup.json.gz\`.
6. Rechecks both database names and GitHub open PRs; any change aborts without deletion.
7. Only then drops the named collections.

A permission error stops the operation; no attempt is made to change database privileges or delete working collections. A partial deletion remains possible if MongoDB fails mid-operation: both archives will already be on the persistent volume.

To verify, repeat the dry-run and inspect the Atlas collection count. Any newly opened PR preview collections remain protected.

The stored \`.backup.json.gz\` archives are **not** compatible with the older selective ZIP import interface. Restoring them requires the dedicated MongoDB backup format tools. Never publish or email backup files, because they contain customer and financial data.
