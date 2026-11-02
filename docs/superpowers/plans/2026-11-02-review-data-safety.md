# Review Data Safety Implementation Plan

> Implement inline using superpowers:executing-plans and test-driven-development; request a fresh whole-branch review before delivery.

**Goal:** Correct the six findings from the review of cce586c while preserving stored business data.

**Architecture:** Keep Express, existing collections, FIFO calculations and public/admin routing. Use a shared transaction for critical Mongo replacements: per-collection write fence, read/version validation, recovery snapshot, replacement and verification all participate in the same session. Return fingerprints derived from the response arrays. JSON replacements use atomic file renames, a recovery journal and pre-write snapshots.

**Tech Stack:** Node >=20.19, Express 4, MongoDB driver 7, existing JWT/bcrypt libraries. No new production dependencies.

**Spec:** Six findings in `/workspace/inventory-app-review.md`; user requires correction with protection against data loss. Work only on synthetic local data, never deploy or restore production as part of implementation.

## Global Constraints

- Preserve viewer read-only and inventory/public host separation.
- Do not rewrite FIFO, alter existing financial entries, or run production migrations.
- Snapshot critical data before replacing it; do not expose snapshots via generic save or public assets.
- Version conflicts must reject the whole operation with 409.
- Mongo transaction failure must leave every collection unchanged; initialize write-fence documents additively.
- Existing mailbox cookies without a session version may require one new login; do not change passwords or delete mail.
- A rollback to the old server reintroduces concurrency bugs; deployment needs a verified backup and a controlled switch with no overlapping old writers.

## Review Focus

- Empty collections and two writers must not both accept one old version.
- Failed insert/verification after deletion must abort without exposing an empty collection.
- Invalid later backup section must not overwrite earlier valid inventory sections.
- Password reset/deactivate/reactivate must never revive a revoked mailbox cookie.
- JSON crash recovery must restore all old files, not a mixture.

## Task 1: Input validation and mailbox session revocation

Files: server.js, mail-service.js, tests/auth-session-safety.test.cjs.

- [x] Add HTTP regression tests: malformed password returns 400 and server remains alive; valid login works; mailbox active session works, deactivate/reset/delete revokes it; fresh login works after password change; reactivation does not revive old sessions.
- [x] Run tests and observe expected failures.
- [x] Validate login field types; catch async errors. Add sessionVersion to mailbox JWT and account updates, check current active account/version in mailbox middleware; accept legacy accounts at version zero, fail closed on DB errors.
- [x] Run new tests and existing mail/API suites, commit.

## Task 2: Versioned atomic inventory writes and safe restore

Files: server.js, tests/data-write-safety.test.cjs, tests/mongo-write-safety.test.cjs, tests/mongo-data-integrity.test.cjs, tests/backup-flow.test.cjs, app.js, package.json.

- [x] Add failing tests for exact response fingerprints/local browser save, two writers, rollback after insert failure, stale multi-collection restore, valid restore, invalid backup before mutation, preservation of restock history and recovery snapshots/journal.
- [x] Implement shared critical-dataset writer with per-collection Mongo write fences and transactions; snapshots and verification inside the transaction. Reject malformed arrays before deletion. Keep unrelated collections and finance ledger untouched.
- [x] Derive metadata from loaded arrays; supply metadata for JSON admin responses. Make JSON multi-file writes recoverable from a journal; preserve optional legacy unversioned JSON API behavior.
- [x] Use shared writer in generic save, inventory movement and backup restore. Validate entire selected archive first; pass browser versions for restore and return stale conflicts distinctly. Preserve non-sale transactions on sales-only restore.
- [x] Avoid optimistic mutation of cached stock/history on failed movement writes; test retry after rejection.
- [x] Replace obsolete source-shape assertions with behavioral checks; add executable safety test scripts. Run on a disposable real Mongo replica set as well as JSON; commit.

## Task 3: Verification and delivery

Files: docs/CHANGELOG.md, docs/review-data-safety.md.

- [x] Run npm test, test:api, test:mail, test:backup, new safety suites, syntax and diff checks.
- [x] Document additive metadata, legacy-session re-login, recovery behavior, actual validation evidence and rollout/rollback limits.
- [x] Request one independent whole-branch review; fix substantive findings with regression tests.
- [x] Deliver a reviewable local branch and patch. Do not merge or deploy automatically.

## Execution record

Task 1: complete — 217c901; malformed credential and revoked-cookie tests observed RED then GREEN; existing mail/API suites passed.

Task 2: complete — Mongo replica-set and JSON regressions observed RED then GREEN. Transaction fencing includes empty collections. Independent final review findings were reproduced and fixed: missing Mongo restore versions, mixed-store restore rollback, and JSON reads after failed rollback.

Ruling: website files and inventory restore separately — a filesystem write cannot commit atomically with a Mongo transaction; mixed restores now fail before mutation, with matching UI guidance.

Ruling: preserve existing unversioned JSON API callers while checking all supplied versions — existing integration tools use this local API; Mongo always requires versions. JSON remains a single-process store.

Task 3: complete — npm test, API, mail, backup, 12 safety checks and 7 real-Mongo checks passed; independent review findings fixed with regression tests. Local branch and patch are the reviewable deliverable; no deployment or remote branch change performed.
