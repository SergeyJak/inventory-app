# HeySmart Knowledge Base Architecture

## Purpose

This document defines the Phase 1.1 architecture for the HeySmart Knowledge Base. The Knowledge Base will become the main SEO content hub for HeySmart: a multilingual library of practical articles that helps customers in Latvia and Europe choose, connect, and use Yandex smart speakers with confidence.

This is a design document only. It does not implement routes, UI, database collections, or code.

---

## Architecture Summary

The Knowledge Base should be a structured, multilingual content system with stable URLs, strong SEO metadata, category hubs, article relationships, search analytics, editorial workflow, and future AI-assisted drafting.

Core decisions:

- Article URLs are locale-prefixed and category-independent: `/{locale}/help/{articleSlug}`.
- Categories are used for navigation, breadcrumbs, clustering, and filtering, but not for article URL permanence.
- Every article belongs to a `translationGroupId` shared across RU, LV, and EN translations.
- Every published localized article self-canonicalizes and references available translations with `hreflang`.
- Redirect support is required from the first implementation slice.
- AI can suggest and draft content, but only humans can publish.
- The MVP starts small but keeps fields and policies compatible with 1000+ articles.

---

## 1. Site Structure

### Final Public URL Structure

Use locale-prefixed, category-independent article URLs:

```text
/ru/help
/ru/help/{articleSlug}

/lv/help
/lv/help/{articleSlug}

/en/help
/en/help/{articleSlug}
```

Category pages use a separate path:

```text
/ru/help/category/{categorySlug}
/lv/help/category/{categorySlug}
/en/help/category/{categorySlug}
```

Search uses:

```text
/ru/help/search?q={query}
/lv/help/search?q={query}
/en/help/search?q={query}
```

Examples:

```text
/ru/help/rabotaet-li-alisa-v-latvii
/lv/help/vai-alise-strada-latvija
/en/help/does-alice-work-in-latvia

/ru/help/mini-vs-midi
/en/help/best-station-for-music
```

### Why Article URLs Do Not Include Category

The chosen model is:

```text
/{locale}/help/{articleSlug}
```

This is preferred over:

```text
/{locale}/help/{categorySlug}/{articleSlug}
```

because:

- Article URLs remain stable when categories change.
- Content can move between clusters without losing SEO equity.
- A single article can support multiple topic clusters without duplicate URLs.
- Redirect logic is simpler and less error-prone.
- Breadcrumbs can still show the current primary category.
- Category pages can evolve independently from article URLs.

### Slug Policy

- Slugs are unique per locale.
- Slugs should be human-readable and localized where useful.
- Slugs should not include category names unless the category is part of the query intent.
- Published slugs should be changed only when there is a clear SEO or UX reason.
- Every slug change must create a permanent redirect from the previous URL.
- `translationGroupId` is the article identity; slugs are public routing identifiers only.

### Category Move Policy

- Moving an article between categories must not change its public article URL.
- Category changes should update breadcrumbs, related content, category pages, and internal links.
- No redirect is needed for category moves because article URLs do not include category paths.
- If a category slug changes, old category URLs should redirect to the new category URL.

### Localized Slug Behavior

- Each locale can have its own slug.
- Localized slugs should be written for local search behavior, not mechanically translated.
- Missing translations should not reserve public URLs.
- When a translation is later published, it receives its own localized slug and joins the existing `translationGroupId`.

### Redirect Support

Redirect support is required in MVP.

Article model should support:

- `previousSlugs`: simple per-locale list of old slugs for the same article.
- `redirects`: explicit redirect records for more complex redirects, merges, and archival decisions.

Redirect records should include:

- `sourceLocale`
- `sourcePath`
- `targetPath`
- `statusCode`
- `reason`
- `createdAt`
- `createdBy`

### Redirect Behavior

- Slug changes: old article URL redirects with permanent `301` to the new article URL.
- Category slug changes: old category URL redirects with permanent `301` to the new category URL.
- Merged article: old article URL redirects with permanent `301` to the surviving article.
- Archived article with replacement: archived URL redirects with permanent `301` to the best replacement.
- Archived article without replacement: return a helpful archived/removed page or `410 Gone`; do not redirect to the help home unless it is genuinely the best match.
- Deleted draft: no public redirect is needed because drafts were never public.

---

## 2. Categories

Categories are navigation and topic-cluster objects, not permanent article URL owners.

Recommended initial categories:

### Getting Started

For first-time buyers and setup questions.

Example articles:

- Does Alice work in Latvia?
- How to connect Alice?
- Alice in Europe

### Buying Guide

For choosing the right speaker by need, room, user, budget, or scenario.

Example articles:

- Which station is best for music?
- Which station is best for children?
- Which station should I buy first?

### Comparisons

For model-vs-model pages and feature comparisons.

Example articles:

- Mini vs Midi
- Mini 3 vs Mini 3 Pro
- Lite 2 vs Mini 3

### Subscription

For Yandex Plus and account-related questions.

Example articles:

- Yandex Plus subscription
- Do I need a subscription for Alice?
- What works without Yandex Plus?

### Smart Home

For smart home scenarios, Zigbee, devices, and automation.

Example articles:

- Smart Home with Alice
- Which station supports smart home?
- What can Alice control?

### Compatibility

For region, language, app, phone, Wi-Fi, Bluetooth, and service compatibility.

Example articles:

- Does Alice work in Europe?
- Can Alice speak English?
- Does Alice work with Spotify?

### Troubleshooting

For setup problems, connection issues, app problems, and common errors.

Example articles:

- Alice will not connect to Wi-Fi
- App setup does not work
- Speaker cannot find account

### Product Guides

For model-specific evergreen pages that connect catalog products with educational content.

Example articles:

- Yandex Station Lite 2 guide
- Yandex Station Mini 3 guide
- Yandex Station Midi guide

---

## 3. Article Model

The content model should support both MVP simplicity and later editorial scale. Fields below are marked as `MVP` or `Later`.

### Identity Fields

- `id` (`MVP`): Stable internal article identifier.
- `translationGroupId` (`MVP`): Stable identifier shared by all translations of the same article.
- `locale` (`MVP`): Article language, one of `ru`, `lv`, or `en`.
- `slug` (`MVP`): Locale-specific public article slug.
- `categoryId` (`MVP`): Primary category identifier for breadcrumbs and category listing.
- `status` (`MVP`): `draft`, `review`, `published`, or `archived`.
- `contentType` (`MVP`): `guide`, `comparison`, `troubleshooting`, `faq`, `product-guide`, or `landing`.

### URL and Redirect Fields

- `previousSlugs` (`MVP`): Locale-specific previous slugs for automatic 301 redirects to the current URL.
- `redirects` (`Later`): Explicit redirect records for merged articles, category redirects, archived pages, and custom redirect behavior.

### Core Content Fields

- `title` (`MVP`): Public article title.
- `excerpt` (`MVP`): Short summary for category pages, search results, and related article cards.
- `content` (`MVP`): Main article body, stored as Markdown or structured blocks.
- `summary` (`MVP`): Short answer block for users who need a quick answer.
- `faq` (`MVP`): List of visible question and answer pairs for the article.
- `tags` (`MVP`): Search, filtering, and relationship tags.
- `takeaways` (`Later`): Optional list of key points.
- `steps` (`Later`): Optional structured step-by-step instructions.
- `warnings` (`Later`): Optional notices for regional limitations, subscriptions, or compatibility.

### SEO Fields

- `seoTitle` (`MVP`): Search-optimized title tag.
- `seoDescription` (`MVP`): Meta description.
- `canonicalUrl` (`MVP`): Self-referencing canonical URL for published articles.
- `robots` (`MVP`): Indexing directive such as `index,follow` or `noindex,follow`.
- `focusKeyword` (`MVP`): Primary search query target.
- `searchIntent` (`MVP`): `informational`, `comparison`, `buying`, `troubleshooting`, or `subscription`.
- `secondaryKeywords` (`Later`): Supporting search queries.
- `schemaTypes` (`Later`): Structured data types to emit when non-default schemas are needed.

### Relationship Fields

- `relatedProducts` (`MVP`): Product IDs or product type identifiers connected to the article.
- `relatedArticles` (`MVP`): Article IDs or translation group IDs for curated internal links.
- `sourceQuestions` (`MVP`): Assistant question IDs or analytics references that justified the article.
- `faqReferences` (`Later`): FAQ item IDs if the article expands existing FAQ content.
- `relatedCategories` (`Later`): Optional category IDs for cross-cluster navigation.

### Publishing and Review Fields

- `author` (`MVP`): Human author name or system author label.
- `reviewer` (`MVP`): Reviewer name.
- `contentOwner` (`MVP`): Person responsible for freshness and correctness.
- `reviewStatus` (`MVP`): `not-reviewed`, `needs-review`, `approved`, or `needs-update`.
- `lastReviewedAt` (`MVP`): Date of last human review.
- `createdAt` (`MVP`): Creation timestamp.
- `updatedAt` (`MVP`): Last edit timestamp.
- `publishedAt` (`MVP`): First publish timestamp.
- `lastUpdated` (`MVP`): User-visible content freshness date.
- `changeSummary` (`MVP`): Human-readable note explaining the latest meaningful change.
- `scheduledAt` (`Later`): Optional scheduled publish time.
- `version` (`Later`): Numeric revision or content version.

### User Experience Fields

- `readingTime` (`Later`): Estimated reading time.
- `difficulty` (`Later`): `beginner`, `intermediate`, or `advanced`.

### Source and Automation Fields

- `ideaSource` (`MVP`): Assistant analytics, Search Console, manual, product gap, or customer request.
- `measurementGoal` (`MVP`): Expected measurable outcome, such as indexed page, target query impressions, contact clicks, or reduced repeated assistant misses.
- `sourceQuality` (`MVP`): `verified`, `internal`, `inferred`, or `needs-verification`.
- `priorityScore` (`Later`): Numeric priority based on search demand, assistant frequency, conversion value, and content gap.
- `aiDraftStatus` (`Later`): `none`, `suggested`, `drafted`, `reviewed`, `rejected`, or `published`.
- `aiDraftNotes` (`Later`): Notes about generated content, missing evidence, or reviewer instructions.

### Revision Fields

Revision history should be implemented as a separate revision log rather than embedded in the article document once edits become frequent.

Each revision should include:

- article ID
- version number
- editor
- timestamp
- change summary
- previous content snapshot or diff
- rollback target flag

---

## 4. Multilingual Strategy

Supported locales:

- RU
- LV
- EN

### Translation Linking

All translations of the same article must share one `translationGroupId`.

Example:

```text
translationGroupId: alice-in-latvia

RU: /ru/help/rabotaet-li-alisa-v-latvii
LV: /lv/help/vai-alise-strada-latvija
EN: /en/help/does-alice-work-in-latvia
```

### Hreflang Rules

Each published localized article must emit:

- self canonical pointing to its own URL;
- `hreflang="ru"` when RU translation exists;
- `hreflang="lv"` when LV translation exists;
- `hreflang="en"` when EN translation exists;
- `hreflang="x-default"` pointing to the best default article, usually the default locale or language selector equivalent.

If a translation is missing:

- Do not emit `hreflang` for the missing locale.
- Do not redirect users to a different language automatically.
- Show available language links only.
- Track the missing translation as an admin content gap.

### Canonical Between Languages

- Localized pages must not canonicalize to another language.
- Each language version self-canonicalizes.
- Translations are connected through `hreflang`, not cross-language canonicals.

### Locale Quality Rules

- RU, LV, and EN content should be reviewed independently.
- Machine translation may be used for drafting, but not for direct publishing.
- Local examples, wording, and search terms should match the locale audience.

---

## 5. SEO Strategy

### Canonical URLs

- Published article pages self-canonicalize.
- Category pages self-canonicalize.
- Search result pages use `noindex,follow`.
- Redirected URLs must not emit canonicals; they return redirects.

### Breadcrumbs

Every article should expose a visible breadcrumb path:

```text
Home > Help > Category > Article
```

Breadcrumbs should be emitted as `BreadcrumbList` structured data. Category in breadcrumbs comes from `categoryId`, not from the article URL.

### Structured Data

Use structured data where appropriate:

- `Article` for every published article.
- `FAQPage` when the article includes visible FAQ entries.
- `BreadcrumbList` for category and article hierarchy.

Article schema should include:

- headline
- description
- author
- datePublished
- dateModified
- mainEntityOfPage
- inLanguage

FAQ schema should only include FAQ content visible on the page.

### Pagination and Indexing

#### Category Pages

- Category landing page page 1 should be indexable when it has useful intro copy and curated links.
- Paginated category pages should use clean pagination URLs such as `?page=2`.
- Page 1 canonicalizes to the base category URL.
- Page 2+ self-canonicalizes if it has unique article listings and should be discoverable.
- If paginated pages become thin or low value, use `noindex,follow` for page 2+ while keeping links crawlable.

#### Search Results

- Search result pages should be `noindex,follow`.
- Search URLs should not be included in XML sitemaps.
- Search pages should not canonicalize to `/help`; they should self-canonicalize or omit canonical while using `noindex,follow`.
- Search analytics should be stored for content planning.

#### Admin Lists

- Admin list pagination has no SEO role.
- Admin lists should be server-side or API-paginated when article count grows.
- Admin list filters should support status, locale, category, content type, owner, review status, and updated date.

### Internal Links

Each article should include:

- contextual links to highly relevant articles;
- related article cards;
- related product cards when the article has buying intent;
- links from product pages back to relevant help articles;
- links from assistant answers to relevant help articles when useful.

Internal linking rules are defined in section 8.

---

## 6. Sitemap Strategy

### Current Small Site

At launch, a single sitemap can include:

- public catalog pages;
- help home pages;
- help category pages;
- published help articles.

Only canonical, published, indexable URLs should be included.

### 100+ Articles

Split by locale if useful:

```text
/sitemap.xml
/sitemaps/help-ru.xml
/sitemaps/help-lv.xml
/sitemaps/help-en.xml
```

The root sitemap should become a sitemap index when multiple sitemap files exist.

### 500+ Articles

Separate sitemap files by content type:

```text
/sitemaps/products.xml
/sitemaps/help-ru.xml
/sitemaps/help-lv.xml
/sitemaps/help-en.xml
/sitemaps/categories.xml
```

Article and product sitemaps should be separated if update cadence differs.

### 1000+ Articles

Use a sitemap index with segmented sitemaps by locale and optionally by article range or content type:

```text
/sitemap.xml
/sitemaps/help-ru-1.xml
/sitemaps/help-ru-2.xml
/sitemaps/help-lv-1.xml
/sitemaps/help-en-1.xml
/sitemaps/products.xml
/sitemaps/categories.xml
```

Rules:

- Include `lastmod` from `lastUpdated` or `updatedAt`.
- Exclude drafts, review items, archived pages without public replacement, redirects, and `noindex` pages.
- Generate sitemap files automatically from published content.
- Keep sitemap generation deterministic so diffs and cache behavior are predictable.

---

## 7. Search Strategy

### MVP Search Scope

Search should include:

- title
- excerpt
- summary
- content headings
- FAQ questions
- tags
- product names
- category names

### Ranking Order

MVP ranking should prioritize:

1. Exact title match.
2. Exact FAQ question match.
3. Slug match.
4. Tag and product alias match.
5. Heading match.
6. Excerpt and summary match.
7. Body content match.
8. Recency and review freshness as a light boost.

### Locale-Aware Normalization

Search should normalize:

- case;
- punctuation;
- extra whitespace;
- common model aliases;
- language-specific characters where safe;
- Russian, Latvian, and English query variants.

### Typo Tolerance and Tokenization

MVP:

- token-based matching;
- alias lists for model names;
- simple typo tolerance for short product/model queries only.

Later:

- stemming or lemmatization per locale;
- fuzzy matching;
- synonym dictionaries from search analytics;
- dedicated search index if database search is not enough.

### Search Index Decision

For MVP and up to roughly 100-300 articles, MongoDB text indexes or a prebuilt JSON/static search index should be enough.

Consider dedicated search when:

- article count approaches 500+;
- query latency becomes noticeable;
- typo tolerance and multilingual stemming become important;
- ranking needs analytics-driven tuning;
- search needs faceting by category, product, and content type.

---

## 8. Internal Linking Rules

### Related Article Rules

Related articles should be selected from:

- same topic cluster;
- same product relationship;
- same search intent;
- prerequisite or next-step articles;
- manually curated links for high-value articles.

Related links should usually use `translationGroupId` so the rendered page can link to the same locale when available.

### Related Product Rules

Related products should appear when:

- article intent is buying, comparison, product guide, compatibility, or smart home;
- product is relevant to the answer;
- product is currently safe to show publicly.

Related product blocks should avoid recommending unavailable products unless the page explicitly explains availability.

### Contextual Link Limits

- Avoid over-linking.
- Use a maximum of about 3-6 contextual article links in a normal article body.
- Use related article cards for additional links.
- Do not repeat the same contextual link multiple times in one article.
- Do not link every keyword occurrence.

### Orphan Page Detection

Admin/content health reporting should flag:

- published articles with no inbound links;
- published articles with no related articles;
- articles missing from all category pages;
- articles not present in the sitemap when indexable.

### Duplicate-Link Avoidance

Before publishing, validate:

- duplicate related article IDs;
- duplicate contextual links;
- self-links;
- links to missing translations without fallback behavior;
- links to drafts or archived articles.

### Topic-Cluster Behavior

Each category should behave as a topic cluster:

- category page introduces the topic;
- pillar articles answer broad questions;
- supporting articles answer specific questions;
- product pages link into relevant article clusters;
- article clusters link back to relevant product or catalog pages where useful.

---

## 9. Admin Experience and Editorial Workflow

The admin experience should allow article creation without requiring code changes, while keeping MVP simple.

### Basic Roles

MVP roles:

- `admin`: create, edit, review, publish, archive, and manage redirects.
- `viewer`: read-only access to admin reporting, no article mutations.

Later roles if needed:

- `editor`: create and edit drafts, submit for review.
- `reviewer`: approve and publish.

### Article Creation

Admin users should be able to:

- create a new article idea;
- choose locale, content type, and primary category;
- add title, slug, excerpt, SEO fields, content, FAQ, tags, related products, and related articles;
- run duplicate-topic checks;
- save as draft;
- preview before publishing;
- link translations through `translationGroupId`.

### MVP Status Workflow

Recommended MVP statuses:

- `draft`: Work in progress, not public.
- `review`: Ready for review.
- `published`: Public and indexable.
- `archived`: Removed from public navigation and handled by redirect or archived response.

Later:

- `scheduled`: Approved and waiting for publish time.

### Publish Checklist

Before publishing, require:

- title;
- slug;
- locale;
- content type;
- category;
- excerpt;
- SEO title;
- SEO description;
- content body;
- author or reviewer;
- content owner;
- review status approved;
- measurement goal;
- duplicate-topic check completed;
- related links validated;
- product availability checked when products are linked.

### Revision History and Rollback

Every publish or major edit should create a revision.

Revision history should support:

- comparing current and previous versions;
- seeing editor, timestamp, and change notes;
- rolling back to a previous published version;
- preserving the public URL and redirect history.

### Change Notes

Every meaningful update should include `changeSummary`, especially when:

- facts change;
- product availability changes;
- setup instructions change;
- SEO title or slug changes;
- articles are merged or archived.

### Duplicate-Topic Check

Before creating or publishing an article, admin should compare against:

- same-locale titles;
- slugs;
- focus keywords;
- translation group IDs;
- related FAQ;
- assistant source questions;
- similar tags and product relationships.

---

## 10. AI Integration and Quality Gates

The Knowledge Base should connect with existing Assistant Analytics without coupling publishing to automated generation.

### Content Idea Workflow

```text
Assistant questions
|
Improvement report
|
Missing FAQ
|
Draft article
|
Review
|
Publish
```

### How Assistant Analytics Generates Ideas

Assistant Analytics can identify:

- frequently repeated questions;
- unanswered questions;
- low-confidence responses;
- negative feedback;
- questions that require long explanations;
- questions tied to specific products or purchase intent;
- regional concerns about Latvia and Europe.

### Draft Generation Output

Generated drafts should include:

- proposed title;
- target locale;
- suggested category;
- content type;
- search intent;
- source questions;
- answer outline;
- suggested FAQ items;
- related products;
- related articles;
- confidence and evidence notes.

### Required AI Quality Gates

Before an AI-generated draft can be published:

- Duplicate-topic detection must pass.
- Factual and product availability checks must pass.
- SEO intent must be validated.
- Locale quality review must pass.
- Related products and related articles must be reviewed.
- A human admin or reviewer must approve.

Automatic publishing is not allowed.

### Feedback Loop

After publishing, the article should be measured through:

- organic impressions;
- organic clicks;
- article views;
- internal search clicks;
- assistant links clicked;
- product link clicks;
- reduced repeated unanswered assistant questions.

---

## 11. Future Scalability

### 100+ Articles

At 100+ articles:

- categories and tags are enough for navigation;
- manual related articles can still work;
- MongoDB text search or a static search index should be enough;
- admin lists need filtering by status, locale, category, content type, owner, and updated date;
- sitemap can remain simple or split by locale.

### 500+ Articles

At 500+ articles:

- related articles should become partly automated;
- content quality dashboards become important;
- search analytics should drive content updates;
- duplicate-topic detection is required before new drafts;
- category pages may need curated article groups;
- sitemap should be split by locale and content type;
- dedicated search should be evaluated.

### 1000+ Articles

At 1000+ articles:

- full-text search should use a dedicated index or optimized database search;
- internal linking should be rule-assisted;
- translation coverage should be tracked as a dashboard;
- content decay should be monitored by traffic drops, outdated dates, and low engagement;
- sitemap generation should use a sitemap index and segmented sitemap files;
- admin should support bulk operations, editorial queues, and content health scoring.

---

## 12. Future Implementation Phases

### Phase 1.2 - Content Inventory

- Collect existing FAQ, assistant answers, product copy, and common customer questions.
- Map each item to a Knowledge Base category.
- Identify missing articles and prioritize the first 20 articles.

### Phase 1.3 - Data Design

- Choose storage format for article content.
- Define category and article schemas.
- Define translation group handling.
- Define redirect records.
- Define sitemap and structured data generation requirements.

### Phase 1.4 - Public Knowledge Base MVP

- Build help home, category pages, and article pages.
- Add SEO metadata, canonical URLs, breadcrumbs, structured data, and sitemap entries.
- Add related products and related articles.
- Add redirect handling for previous slugs.

### Phase 1.5 - Admin Publishing Workflow

- Add draft, review, publish, and archive states.
- Add article preview.
- Add translation linking.
- Add basic publish checklist.
- Add revision history and rollback.

### Phase 1.6 - Search and Analytics

- Add locale-aware Knowledge Base search.
- Track search queries, no-result searches, article views, and article-to-product clicks.
- Feed analytics back into Phase 2 assistant improvements.

### Phase 1.7 - Automation Preparation

- Add assistant source questions, AI draft status, priority score, source quality, and measurement goals.
- Prepare review-first automation for Phase 5.

---

## 13. Implementation Decision

### Final URL Model

Use stable locale-prefixed article URLs:

```text
/{locale}/help/{articleSlug}
```

Use separate category pages:

```text
/{locale}/help/category/{categorySlug}
```

This is the final decision because article URLs must not break when category assignments change.

### Final Storage Direction

MVP should use the simplest structured storage that fits the existing app:

- MongoDB collection when `MONGODB_URI` is configured.
- JSON file fallback for local/dev consistency, matching the app's existing persistence pattern.

Article content should be stored as Markdown or structured blocks, with metadata stored as structured fields.

### MVP Fields

Implement these first:

- `id`
- `translationGroupId`
- `locale`
- `slug`
- `categoryId`
- `status`
- `contentType`
- `previousSlugs`
- `title`
- `excerpt`
- `summary`
- `content`
- `faq`
- `tags`
- `seoTitle`
- `seoDescription`
- `canonicalUrl`
- `robots`
- `focusKeyword`
- `searchIntent`
- `relatedProducts`
- `relatedArticles`
- `sourceQuestions`
- `author`
- `reviewer`
- `contentOwner`
- `reviewStatus`
- `lastReviewedAt`
- `createdAt`
- `updatedAt`
- `publishedAt`
- `lastUpdated`
- `changeSummary`
- `ideaSource`
- `measurementGoal`
- `sourceQuality`

### Later Fields

Add later when the library grows:

- `redirects`
- `takeaways`
- `steps`
- `warnings`
- `secondaryKeywords`
- `schemaTypes`
- `faqReferences`
- `relatedCategories`
- `scheduledAt`
- `version`
- `readingTime`
- `difficulty`
- `priorityScore`
- `aiDraftStatus`
- `aiDraftNotes`

### First Implementation Slice

The first implementation slice should be small:

1. Define read-only data structures for categories and published articles.
2. Add public routes for:
   - `/{locale}/help`
   - `/{locale}/help/{articleSlug}`
   - `/{locale}/help/category/{categorySlug}`
3. Render one category page and 3-5 seed articles in RU, with optional LV/EN translations when ready.
4. Add canonical URLs, `hreflang`, breadcrumbs, `Article` schema, and FAQ schema.
5. Add sitemap entries for published help pages.
6. Add previous-slug redirect handling.
7. Defer admin editing UI, AI drafting, and advanced search until after the public MVP is stable.

With these decisions, the architecture is ready for implementation once content inventory for the first articles is complete.
