# Changelog

This file records the current high-level state of the project. It is not a release log with exact dates.

## Current State

### Catalog Purchase Questions

* A visible RU/EN/LV question-and-answer section explains using Alice in Latvia, Yandex Plus requirements, and initial setup. RU/EN answers are included in server-rendered HTML.

### Riga Purchase Steps

* The existing local purchase section includes a three-step ordering guide in RU/EN/LV and a Contact button that opens the existing contact panel for the selected model and colour.

### Catalog Comparison Offers

* Model comparison cards show inventory-backed prices and availability in server-rendered HTML and refresh them from the existing public products API.
* Different available colour prices use a minimum-price prefix; unavailable models omit historical prices. Missing or invalid prices are not displayed, and unverified fallback inventory does not advertise availability in comparison cards.
* Product links retain native mouse and keyboard navigation. Offer labels follow the RU/EN/LV interface language.

### Data Safety And Session Fixes

* Inventory login rejects non-string credentials without terminating the Express process.
* Mailbox requests validate current account activity and session version. Deactivation and password changes revoke older mailbox cookies; legacy cookies require a fresh login without changing stored passwords or messages.
* Critical Mongo replacements use per-collection transaction fences, version checks, recovery snapshots and post-write verification in the same transaction. Concurrent stale saves return 409, including empty-collection writes.
* Admin data responses include fingerprints calculated from their exact returned arrays in both Mongo and JSON modes.
* JSON critical writes and website-file restores use atomic renames, snapshots and recovery journals. Pending failed recovery blocks requests rather than exposing partial data.
* Mongo ZIP restores require versions for every selected critical dataset. Selected inventory collections restore together, and sales-only restoration preserves restock history. Malformed selected sections are rejected before changes.
* Inventory and FAQ/translation restores are separate operations; the interface defaults to inventory sections. See `docs/review-data-safety.md` for verification and rollout limits.

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

* `/reports` serves the read-only sales analytics dashboard for admin and viewer roles.
* `/analytics` serves a separate admin-only HeySmart visitor analytics dashboard using the existing visitor analytics API.
* `GET /api/reports/sales` aggregates sales by month, quarter, or year.
* Sales dashboard supports metric switching, year comparison, summary cards, Chart.js chart, and compact table.
* Visitor analytics supports 7/14/30-day ranges, visitor/session/page-view/contact summary cards, activity trend, country/city/device/language/model breakdowns, search, pagination, and a per-visitor event timeline.
* The visitor table labels `visitCount` as active days and shows session count separately.
* The returning-visitors summary explicitly describes a count of visitors who returned, not a count of repeat visits.
* The activity trend shows new visitors and Daily Active Visitors; each visitor is counted at most once per calendar day regardless of the number of sessions or events that day.
* Model-interest reporting ignores the automatic initial model view when it is paired with the session page view; explicit model views and meaningful model interactions remain counted.
* Likely hosting/cloud/social-infrastructure providers are marked heuristically with an `Infrastructure?` badge. Geography can switch between all traffic and ordinary networks without deleting any visitor data.
* Visitor analytics remains read-only in the UI and does not expose delete actions.

### Public Catalog

* Public HeySmart catalog is served by `catalog.html`, `catalog.css`, `catalog.js`, `i18n.js`, and `assistant-engine.js`.
* The eight RU/EN canonical product routes reuse the full catalog with an explicit initial model, product-specific SSR metadata and Yandex Product schema. Product language links retain the slug; unavailable products remain indexable with OutOfStock schema. Existing catalog hash links retain their selection and smooth scrolling.
* The catalog root `/` initializes with the Russian locale so browser or saved-language detection cannot rewrite its SEO title to English; `/en` remains the explicit English landing page.
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
