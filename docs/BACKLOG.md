# Backlog

## Current / Near-Term

### Viewer Analytics Dashboard

Status: shipped MVP, needs product polish.

* Verify `/reports` after every deploy for both `admin` and `viewer`.
* Keep `/api/reports/sales` read-only and available to both roles.
* Keep viewer blocked from `POST /api/save` and other mutation routes.
* Validate empty-data states for month, quarter, and year grouping.

### Charts With Filters

Status: shipped MVP.

* Improve visual distinction when comparing multiple years.
* Consider better default year selection when many years exist.
* Add optional "select all / clear all" year controls.
* Add chart type toggle only if users ask for it.

### Reports UI Polish

Status: ongoing.

* Polish mobile table density.
* Add sticky table header for long report tables.
* Improve report copy/localization if the page should be customer-facing.
* Review Chart.js CDN dependency if stricter CSP or offline operation is needed.

## Future Ideas

### Export

* Export current report table to CSV.
* Export dashboard snapshot to PDF.
* Add date-stamped filenames, for example `sales-report-2026-month.csv`.

### Drilldowns

* Drill from report period to sales rows.
* Add product-level breakdown.
* Add top products by revenue/profit.

### Mobile Polish

* Compact metric controls further on narrow screens.
* Consider card-based detail rows under 420px width.
* Verify hover tooltip alternatives for touch devices.

### Admin Reporting

* Decide whether old annual report should stay separate or link to `/reports`.
* Keep old annual report stable until a replacement is explicitly approved.
