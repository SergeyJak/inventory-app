# HeySmart Roadmap

## Vision

HeySmart aims to become the best place in Latvia and Europe to buy, compare, and confidently choose Yandex smart speakers, with clear product information, helpful guidance, strong SEO visibility, and a simple mobile-first purchase path.

---

## Development Principles

Before implementing any new feature, verify:

- Does it improve SEO?
- Does it improve UX?
- Does it improve conversion?
- Does it improve analytics?
- Is it really needed?
- Can existing functionality solve the problem?
- Keep the UI simple.
- Mobile first.
- Every feature should have measurable value.

---

## Infrastructure & Data Protection (CROSS-CUTTING)

Production data protection is mandatory and may be implemented independently of the sequential product phases below.

### Backup Roadmap

- [x] Keep MongoDB Atlas on the Free tier while production data remains comfortably within its limits.
- [x] Keep the existing admin export/import flow as the fast, human-operated backup layer.
- [x] Use the existing Railway persistent volume mounted at `/data` for automated backups.
- [ ] Add a daily full backup of the production `inventory` database to `/data/backups`.
- [ ] Store BSON-compatible Extended JSON in a gzip-compressed archive with per-collection SHA-256 checksums.
- [ ] Write backups atomically so an interrupted backup never replaces a valid archive.
- [ ] Retain 7 daily, 4 weekly, and 3 monthly recovery points.
- [ ] Validate every newly created archive before marking it successful.
- [ ] Run a periodic restore test into an isolated temporary database and verify collection counts/checksums.
- [ ] Exclude Railway PR/preview collections from production backups.
- [ ] Add backup health logging and expose the latest successful backup timestamp/size.
- [ ] Add an alert path for a missed or failed backup.
- [ ] Add a second off-platform/object-storage copy when production data size or business impact justifies it.
- [ ] Re-evaluate MongoDB Flex/Dedicated when storage, performance, recovery-point requirements, or operational risk outgrow the Free tier.

### Recovery Targets

- Daily automated recovery point while on the current Free-tier architecture.
- Manual admin export remains available for targeted operational recovery.
- A backup is not considered healthy until its archive integrity has been verified.
- Restore procedures must be testable without touching the production database.
- Production and PR/preview data must never be mixed during backup or restore.

### Definition of Done

- A valid compressed backup is created automatically every day.
- Backups survive application redeploys because they are stored on the persistent Railway volume.
- Retention runs automatically and never deletes the newest valid recovery point.
- A restore test can recreate the backup in an isolated temporary database and clean it up afterwards.
- Automated backup tests run in CI.
- Backup failures are visible in logs and do not crash the customer-facing application.

---

## Phase 1 - SEO & Content (CURRENT PHASE)

Highest priority.

### Tasks

- [ ] Knowledge Base
- [ ] SEO landing pages
- [ ] Product page improvements
- [ ] Internal linking
- [ ] Search Console improvements

### Definition of Done

- Target SEO pages are indexed and visible in Search Console.
- Each priority product and buying intent has a clear landing or content page.
- Product pages include useful, unique, search-friendly content.
- Important pages link to each other through relevant internal links.
- Search Console issues are reviewed, prioritized, and either fixed or documented.
- Organic impressions, clicks, indexed pages, and target query coverage are tracked.

---

## Phase 2 - AI Assistant

### Tasks

- [ ] Improve answers from analytics
- [ ] Close Missing FAQ
- [ ] Improve low-confidence responses
- [ ] Improve recommendation flow

### Definition of Done

- Assistant analytics are reviewed regularly and converted into concrete improvements.
- Missing FAQ items are answered or intentionally rejected with a reason.
- Low-confidence answer patterns are reduced and tracked over time.
- Recommendation flow reliably guides users toward suitable in-stock products.
- Assistant changes are tested against existing supported languages and core scenarios.

---

## Phase 3 - Analytics

### Tasks

- [ ] Visitor analytics
- [ ] Conversion funnel
- [ ] Search analytics
- [ ] Popular pages
- [ ] Product analytics

### Definition of Done

- Key visitor events are tracked without exposing private data.
- Funnel steps from discovery to contact/purchase intent are measurable.
- Search behavior and zero-result patterns are visible.
- Popular pages and product interest are visible by period.
- Analytics can guide SEO, UX, product, and assistant priorities.

---

## Phase 4 - UX

### Tasks

- [ ] Mobile improvements
- [ ] Admin UI improvements
- [ ] Performance
- [ ] Navigation
- [ ] Accessibility

### Definition of Done

- Core customer flows work well on mobile without horizontal scrolling.
- Admin workflows remain practical, clear, and efficient.
- Key public pages load quickly and avoid unnecessary layout shifts.
- Navigation keeps frequent actions easy to reach.
- Main interactive elements are keyboard accessible and have visible focus states.

---

## Phase 5 - Automation

### Tasks

- [ ] Generate articles from assistant analytics
- [ ] Generate FAQ suggestions
- [ ] Automated SEO workflow

### Definition of Done

- Automation produces draft content or suggestions, not unchecked production changes.
- Generated drafts are traceable to analytics or search demand.
- FAQ suggestions include evidence, priority, and review status.
- SEO workflow reduces manual effort while preserving quality control.
- Automation outputs are reviewed before publication.

---

## Phase 6 - Growth

### Tasks

- [ ] Reviews
- [ ] Backlinks
- [ ] New markets
- [ ] New product categories

### Definition of Done

- Review collection is reliable, visible, and useful for buyers.
- Backlink opportunities are tracked and prioritized.
- New market work has clear language, logistics, support, and SEO assumptions.
- New product categories have measurable demand and fit the HeySmart brand.
- Growth experiments are evaluated by traffic, conversion, and operational effort.

---

## Working Rules

The product roadmap is sequential.

Never start a new product phase until the current one is substantially complete unless explicitly instructed.

Cross-cutting production safety work, including backup, recovery, security, and data-integrity fixes, may interrupt the sequential product phases.

Every completed task should be marked with a checkbox.

Every future implementation must reference the roadmap phase or cross-cutting track it belongs to.
