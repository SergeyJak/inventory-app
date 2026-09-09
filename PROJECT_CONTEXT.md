# Project Context

## What This Project Is

`inventory-app` is a Node.js/Express inventory and sales management app with:

* an inventory admin interface;
* a read-only viewer mode;
* a public HeySmart product catalog;
* HeySmart Mail account management and mailbox UI;
* a read-only sales analytics dashboard;
* an admin-only HeySmart visitor analytics dashboard.

The same Express service serves both inventory/admin pages and public catalog/mail pages, with host/path guards in `server.js`.

## Tech Stack

* Node.js + Express
* Vanilla JavaScript, HTML, CSS
* MongoDB when `MONGODB_URI` is set
* JSON file fallback under `data/` when MongoDB is not configured
* JWT auth for inventory/admin users
* bcryptjs for passwords
* Chart.js from CDN for `/reports` and `/analytics`
* ImapFlow + mailparser + sanitize-html for HeySmart Mail

## Important Files

* `server.js` - Express app, security headers, host routing, auth middleware, data APIs, reports API, backup APIs, mail service mounting.
* `app.js` - inventory/admin frontend logic: dashboard, products, sales, restock, history, accounts, annual report, mail admin UI.
* `index.html` - inventory/admin shell.
* `style.css` - inventory/admin styles.
* `login.html` - inventory/admin login page and localStorage token storage.
* `reports.html`, `reports.css`, `reports.js` - sales analytics at `/reports`; `reports.js` also renders the separate visitor analytics dashboard at `/analytics`.
* `catalog.html`, `catalog.css`, `catalog.js`, `i18n.js`, `assistant-engine.js` - public catalog and assistant experience.
* `mail-service.js` - HeySmart Mail backend module, IMAP polling, mail account routes, mailbox auth, sanitizing, indexes.
* `mail.html`, `mail.css`, `mail.js` - public mailbox UI for clients.
* `tests/` - focused regression tests for assistant, backup, visitor analytics, and mail service behavior.

## Roles

Inventory users are configured in `server.js` through environment-backed hashes:

* `admin` - full inventory/admin access, can save data, manage accounts, backups, mail accounts, and view visitor analytics.
* `viewer` - read-only access. Current viewer username is `andrey` in code. Viewer can view dashboards, inventory, history, annual reports, and `/reports`; viewer must not save or mutate data and cannot access admin visitor analytics APIs.

Inventory auth uses JWT returned by `POST /api/login`. Frontend stores:

* `localStorage.inv_token`
* `localStorage.inv_role`
* `localStorage.inv_username`

Mailbox auth is separate from inventory auth and uses an httpOnly mailbox cookie managed by `mail-service.js`.

## Main Pages

Inventory/admin:

* `/` or `/index.html` - inventory app shell.
* `/login.html` - inventory login.
* `/reports` - read-only sales analytics dashboard for admin and viewer.
* `/analytics` - separate admin-only HeySmart visitor analytics dashboard.

Public catalog/mail:

* `/catalog.html` locally, and `/` on catalog hosts - public HeySmart catalog.
* `/mail` - HeySmart Mail client mailbox login and inbox.

## Main API Endpoints

Auth and inventory:

* `POST /api/login` - inventory login; returns JWT, role, username.
* `GET /api/data` - inventory data; admin gets all keys, viewer has admin-only keys removed.
* `POST /api/save` - admin-only persistence route.

Reports:

* `GET /api/reports/sales?groupBy=month|quarter|year&years=2024,2025,2026` - read-only sales aggregation for admin and viewer.

Visitor analytics:

* `POST /api/public/analytics/event` - public event ingestion for the HeySmart catalog.
* `GET /api/admin/analytics/visitors` - admin-only visitor list and summary with date/search/sort/pagination filters.
* `GET /api/admin/analytics/visitors/:visitorId` - admin-only visitor timeline detail.
* Visitor analytics UI is read-only even though backend maintenance delete endpoints exist.

Backups:

* `POST /api/backups/export` - admin-only ZIP export.
* `POST /api/backups/import/inspect` - admin-only ZIP inspection.
* `POST /api/backups/import` - admin-only restore/import.

Public catalog:

* `GET /api/public/products` - safe public product list.
* `POST /api/public/assistant-question` - public assistant question logging.

HeySmart Mail admin:

* `GET /api/admin/mail/accounts` - admin-only account list.
* `POST /api/admin/mail/accounts` - admin-only create mailbox.
* `POST /api/admin/mail/accounts/:id/activate` - admin-only activate mailbox.
* `POST /api/admin/mail/accounts/:id/deactivate` - admin-only deactivate mailbox.
* `POST /api/admin/mail/accounts/:id/reset-password` - admin-only generated or manually supplied password change.
* `DELETE /api/admin/mail/accounts/:id` - admin-only delete mailbox and saved messages.
* `GET /api/admin/mail/accounts/:id/messages` - admin-only mailbox message preview.
* `GET /api/admin/mail/imap-test` - admin-only IMAP connectivity test.

HeySmart Mail client:

* `POST /api/mail/login` - mailbox login, not inventory login.
* `POST /api/mail/logout` - mailbox logout.
* `GET /api/mail/me` - mailbox session check.
* `GET /api/mail/messages` - current mailbox messages.
* `GET /api/mail/messages/:id` - read one message.
* `POST /api/mail/sync` - manual mailbox sync for current mailbox.

## Reporting

There are now three reporting surfaces:

* Existing annual report tab in `index.html`/`app.js`, calculated client-side from loaded transactions.
* `/reports` sales dashboard using `GET /api/reports/sales`, Chart.js, metric filters, period filters, year comparison, summary cards, and compact table.
* `/analytics` admin-only HeySmart visitor dashboard using existing visitor analytics APIs for 7/14/30-day summary cards, first/last activity trend, geography, devices, languages, models, search, pagination, and per-visitor event timeline.

Do not break the old annual report or `/reports` when changing `/analytics`.

## Data Model Notes

Inventory transactions include sales and restocks. Sales use fields such as:

* `type: "sale"`
* `qty`
* `total`
* `costTotal`
* `profit`
* `date`

Sales cost and profit are produced by existing FIFO logic in `app.js`. Reports should read these stored fields instead of recalculating business logic differently.

Visitor analytics events are retained for the configured analytics retention period and can include visitor/session IDs, event type, timestamp, safe page URL, locale, model/color, IP, device/browser, bot flag, and resolved geo fields. Admin list/detail APIs aggregate these events; public clients cannot read visitor analytics.

HeySmart Mail collections:

* `mail_accounts`
* `mail_messages`

Mail messages have a TTL index on `createdAt`; default TTL is 30 days unless `MAIL_TTL_SECONDS` overrides it.

## Local Development

Install dependencies:

```powershell
npm install
```

Start the server:

```powershell
npm start
```

Default local URL:

```text
http://127.0.0.1:3001
```

Useful test commands:

```powershell
npm run test:mail
npm run test:backup
npm run test:assistant
```

Useful syntax checks:

```powershell
node --check server.js
node --check app.js
node --check reports.js
```

## Environment Variables

Important variables:

* `PORT`
* `MONGODB_URI`
* `JWT_SECRET`
* `ADMIN_HASH`
* `ANDREY_HASH`
* `IMAP_HOST`
* `IMAP_PORT`
* `IMAP_USER`
* `IMAP_PASSWORD`
* `MAIL_POLL_INTERVAL_MS`
* `MAIL_TTL_SECONDS`
* `ANALYTICS_RETENTION_DAYS`
* `GEOLITE2_CITY_DB`
* `GEOLITE2_ASN_DB`

Never commit real secrets.

## Constraints

* Keep viewer read-only.
* Keep admin-only mutation routes behind `requireAdmin`.
* Do not refactor large files unless explicitly requested.
* Do not change DNS, Cloudflare, Gmail, or Railway settings from code tasks unless explicitly requested.
* Do not expose Gmail account or app password to clients.
* Preserve public catalog host separation in `server.js`.
* Prefer adding focused routes/modules over changing existing business logic.
