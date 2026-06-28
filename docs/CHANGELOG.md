# Changelog

This file records the current high-level state of the project. It is not a release log with exact dates.

## Current State

### Inventory Admin

* Inventory app is served by `server.js` with `index.html`, `app.js`, and `style.css`.
* Admin can manage products, stock lots, sales, restocks, history, sub-accounts, host subscriptions, backups, and HeySmart Mail accounts.
* Viewer can read inventory dashboards and reports but must not mutate data.
* Persistence uses MongoDB when `MONGODB_URI` is configured, otherwise local JSON files under `data/`.

### Auth

* Inventory login is handled by `POST /api/login`.
* JWT is stored in localStorage by `login.html`.
* `requireAuth` protects inventory APIs.
* `requireAdmin` protects mutation/admin-only APIs.

### Sales And Inventory

* Sales and restocks are stored as transactions.
* Sale profit and cost are based on existing FIFO logic in `app.js`.
* Old annual report remains in the inventory app and is calculated client-side from loaded transactions.

### Reports / Analytics

* `/reports` and `/analytics` serve a read-only sales analytics dashboard.
* `GET /api/reports/sales` aggregates sales by month, quarter, or year.
* Dashboard supports metric switching, year comparison, summary cards, Chart.js chart, and compact table.
* Reports are available to both `admin` and `viewer`.

### Public Catalog

* Public HeySmart catalog is served by `catalog.html`, `catalog.css`, `catalog.js`, `i18n.js`, and `assistant-engine.js`.
* Catalog language is stored in `localStorage.catalogLanguage`.
* Catalog has a mail icon link to `/mail`.
* Catalog routes are separated from inventory/admin routes by host/path guards in `server.js`.

### HeySmart Mail

* Cloudflare Email Routing catch-all forwards `@heysmart.lv` mail into Gmail.
* Backend reads Gmail via IMAP using `mail-service.js`.
* Admin can create, activate/deactivate, change password, delete, and preview mailbox accounts.
* Mailbox accounts are stored in `mail_accounts`.
* Messages are stored in `mail_messages` with duplicate protection and TTL cleanup.
* Public mailbox UI is served by `/mail` and lets clients see only their own mailbox messages.

## Validation Commands

Common checks used after changes:

```powershell
node --check server.js
node --check app.js
node --check reports.js
npm run test:mail
npm run test:backup
npm run test:assistant
```
