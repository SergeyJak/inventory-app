# Structured data notes

## Product ratings and reviews

Google Search Console may show warnings for missing `aggregateRating` and
`review` fields in Product structured data.

These fields are intentionally not added until HeySmart has real customer
reviews or real aggregate rating data. Fake ratings, placeholder reviews, or
invented review counts must not be added.

Current Product JSON-LD uses real catalog data and includes `offers` with:

- availability
- priceCurrency
- price
- itemCondition
- url

For Google Product rich results, `offers`, `review`, or `aggregateRating` can
satisfy the required Product enhancement path. Missing `aggregateRating` and
`review` are enhancement warnings when `offers` is present, not a reason to add
unverified data.

When real reviews become available, add `review` and/or `aggregateRating` only
from that source and update the structured data tests/checklist.
