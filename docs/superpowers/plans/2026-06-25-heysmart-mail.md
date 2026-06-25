# HeySmart Mail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only HeySmart Mail MVP where admins create `@heysmart.lv` mail accounts and clients log in at `/mail` to see only their own forwarded Gmail messages.

**Architecture:** Add a focused `mail-service.js` module that owns IMAP polling, Mongo persistence, mail account APIs, mailbox auth, HTML sanitizing, and helper parsing. Keep `server.js` as the composition layer: pass dependencies, mount routes, serve static mail files, and start the poller after Mongo connects.

**Tech Stack:** Express, MongoDB native driver, bcryptjs, jsonwebtoken, Gmail IMAP via imapflow, mail parsing via mailparser, HTML cleanup via sanitize-html, vanilla HTML/CSS/JS.

---

### Task 1: Dependencies And IMAP Proof Path

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `mail-service.js`
- Test: `tests/mail-service.test.cjs`

- [ ] Add `imapflow`, `mailparser`, and `sanitize-html`.
- [ ] Write tests for recipient extraction, HTML sanitizing, and duplicate-safe message mapping.
- [ ] Implement pure helpers in `mail-service.js` and export them for tests.
- [ ] Add a `testImapConnection()` function that connects to Gmail, opens INBOX, and fetches the newest message metadata.
- [ ] Add `npm run test:mail`.

### Task 2: Mongo Collections And Poller

**Files:**
- Modify: `mail-service.js`
- Modify: `server.js`
- Test: `tests/mail-service.test.cjs`

- [ ] Add `ensureMailIndexes()` for `mail_accounts.email` unique, `mail_messages.accountId/messageId` unique, and TTL for old mail.
- [ ] Add `pollInboxOnce()` that fetches unseen/recent messages, parses recipients, finds active account, and upserts messages without duplicates.
- [ ] Add `startMailPoller()` with env-controlled interval and graceful no-op when IMAP env is missing.
- [ ] Wire `server.js` to initialize mail service after Mongo connects.

### Task 3: Admin Mail Accounts

**Files:**
- Modify: `mail-service.js`
- Modify: `server.js`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`
- Test: `tests/mail-service.test.cjs`

- [ ] Add admin routes for list/create/deactivate/reset password/view messages.
- [ ] Add a Mail Accounts tab in the admin UI.
- [ ] Generate passwords server-side and return copy-ready credentials once.
- [ ] Keep all admin routes behind `requireAuth + requireAdmin`.

### Task 4: Public `/mail` MVP

**Files:**
- Modify: `server.js`
- Modify: `catalog.html`
- Modify: `catalog.css`
- Create: `mail.html`
- Create: `mail.css`
- Create: `mail.js`
- Test: `tests/mail-service.test.cjs`

- [ ] Serve `/mail`, `/mail.css`, and `/mail.js` on catalog/local hosts.
- [ ] Add login with email/password using a separate httpOnly mailbox JWT cookie.
- [ ] Add inbox list, message detail, code extraction display, copy code, refresh, logout.
- [ ] Auto-refresh every 12 seconds and show the approved empty state.
- [ ] Add a main-site "Почта" link to `/mail`.

### Task 5: Verification

**Files:**
- Modify only if validation finds issues.

- [ ] Run `npm run test:mail`.
- [ ] Run existing `npm test` and `npm run test:backup`.
- [ ] Run `node --check server.js`, `node --check mail-service.js`, and checks for frontend JS.
- [ ] If IMAP env exists, run the IMAP proof and record newest Gmail message metadata.
- [ ] Start the local app and smoke test `/mail` plus admin tab.
