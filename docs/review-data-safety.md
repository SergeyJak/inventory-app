# Data safety fixes: validation and rollout

## Analysis

This change addresses the six findings reviewed at commit cce586c: malformed inventory login, mailbox session revocation, concurrent Mongo replacements, inconsistent response fingerprints, failed Mongo ZIP restore, and missing JSON browser versions. It also prevents rejected inventory movements from mutating browser cache before server confirmation.

## Plan

Work is isolated on `fix/review-data-safety`. Production credentials, data, hosting and DNS were not used or changed. There are no business-data migrations in this change. Deployment is a separate operation requiring a verified recoverable backup and a controlled writer switch.

## Implementation

Mongo critical replacements acquire existing `dataWriteLocks` documents in key order inside a transaction. Reads, version checks, recovery snapshots, replacements and verification all use that session. Snapshot read concern and majority write concern apply; transaction retries repeat validation. The lock documents are initialized additively at startup and scoped by environment like the critical datasets. Existing business and finance collection names and contents are preserved until an authorized user saves or restores data.

Mongo restores require current versions for all selected critical datasets. JSON continues to accept legacy unversioned API callers; supplied versions are checked, and the browser now receives/sends versions in both modes. Version conflicts do not partially commit.

JSON critical replacements snapshot the previous datasets under `DATA_DIR/.snapshots`, then create `.inventory-write-journal.json` before replacing files. Startup or the next request rolls back a pending journal. If recovery fails, requests fail closed (503) rather than exposing mixed stock/history. Individual writes fsync the temporary file before atomic rename. This is recovery for process interruption and ordinary write errors, not a guarantee against filesystem corruption or hardware failure. JSON storage assumes a single service process owns the data directory; use MongoDB for concurrent service replicas.

FAQ and translation restoration is synchronous and uses its own snapshots and `.asset-write-journal.json`. A mixed inventory/website-file restore is rejected before writes because MongoDB and filesystem changes cannot be one atomic transaction here. The UI selects inventory by default and explains separate restores. Sales-only restore replaces sales while preserving current non-sale transactions. Old ZIP archives remain supported; versions are supplied from the current page rather than embedded in the archive. Existing standalone finance ledgers and mail collections are outside the ZIP inventory restore.

Mailbox cookies include an account `sessionVersion`. Legacy accounts without that field are treated as version zero when logging in; legacy cookies without a version require a new login. Deactivation and both password-reset paths increment the version. Reactivation does not revive an older cookie. Account status/version is checked on each protected mailbox request, with database errors failing closed. Password hashes and saved mail are not migrated or deleted.

## Verification

Tested on Node 24.19.0, with a temporary real MongoDB 8.0.16 single-node replica set and synthetic data. No external MongoDB or IMAP accounts were used.

Passed:

* `npm test`, including `npm run test:safety` (12 new behavioral checks).
* `npm run test:mongo-safety` (7 new checks, automatically starts and stops a disposable local replica set).
* `npm run test:api`, `npm run test:mail`, `npm run test:backup`.
* `node --check server.js`, `node --check app.js`, `node --check mail-service.js`, and `git diff --check`.

Regression tests cover invalid credentials without process exit; revoke/reset/reactivate/delete; exact fingerprints and JSON browser saving; malformed replacements; concurrent movements and empty generic saves; failed Mongo inserts and multi-section restores; required/stale restore versions; preserved restocks and recovery snapshots; malformed later backup sections; rejected mixed restores; JSON restart recovery; successful and failed rollback after simulated disk errors; and website-file recovery.

An independent read-only review found three additional issues during implementation: unversioned Mongo restore, mixed-store static rollback, and reading JSON files after rollback failure. Each was reproduced by a failing regression test before correction; the full suites above then passed. No substantive finding was deferred. Browser rendering/E2E was not run; browser persistence and failed-sale behavior were exercised from the actual client functions, and existing host/role/API regressions passed.

## Changed Files

Runtime changes: `server.js`, `mail-service.js`, `app.js`. Tests and CI: three new safety suites, two test helpers, updated backup/integrity checks, package scripts and the Mongo safety CI step. `mongodb-memory-server-core` is a development dependency only; it downloads MongoDB when the optional real-Mongo test is run, not on production server startup. Documentation: this file, the implementation plan and changelog.

## Build Required

There is no frontend bundle build. The production service must be restarted with the new server/static files to apply the fixes. Nothing in this work deploys automatically.

Before production rollout:

1. Verify an independent current Mongo backup includes all business, finance and mail collections; test restoration into a separate database and retain it outside the application instance. Snapshot filesystem data/assets separately if used. This production backup/restore validation has not been performed in this task.
2. Pause mutations, stop/drain old writers, then switch to the new version. Old server instances do not use the new write fences and must not continue writing alongside the new version. Refresh existing admin tabs after the switch.
3. Confirm server startup and read-only data counts, representative products, totals and reports against the saved baseline before enabling writes. Confirm mailbox sign-in; existing mailbox users may need to sign in once again.
4. Keep the independent backup, deployed code version and application recovery snapshots until normal operation is confirmed.

For code rollback, pause writes and stop all new instances first. Reverting code does not itself require restoring business data: these changes use additive metadata and leave collection formats readable by the old version. Keep recovery journals/snapshots intact; resolve pending filesystem recovery before starting an old server, which does not understand the new journals. The old code reintroduces the reviewed bugs, so restrict writes during diagnosis. Never automatically restore an older database backup over successful later transactions; reconcile any data recovery separately against the saved snapshots.

Zero risk cannot be guaranteed. The changes reduce known failure modes and are tested without touching live data; actual production backup verification and controlled deployment remain required before applying them there.
