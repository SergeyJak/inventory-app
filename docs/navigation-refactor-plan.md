# Navigation refactor plan

## Goal

Refactor Inventory navigation without changing business behaviour or permissions.

The navigation must scale for future sections while remaining simple on desktop and mobile. The same navigation model is used for every user, with items filtered by role.

## Current access contract

### Admin (Sergey)

Shared operational areas:
- Dashboard
- Products
- Sales
- Restock
- History
- Annual reporting
- Analytics reports
- "Return to Andrey"

Admin-only areas:
- Accounts
- Mail Accounts
- Visitor activity
- Assistant questions
- Backups

### Viewer (Andrey)

Viewer keeps access to the current non-admin areas:
- Dashboard
- Products
- Sales
- Restock
- History
- Annual reporting
- Analytics reports
- "Return to Andrey"

Viewer must not see or navigate to:
- Accounts
- Mail Accounts
- Visitor activity
- Assistant questions
- Backups
- any future admin-only section unless explicitly granted

Viewer write restrictions are unchanged.

## Target information architecture

Desktop uses a left sidebar grouped by business purpose rather than a generic "Admin" bucket.

Suggested groups:

### Overview
- Dashboard

### Commerce
- Products
- Sales
- Restock
- History

### Subscriptions (admin only)
- Accounts / Subscribers
- Hosts

### Finance
- Return to Andrey
- Annual reporting
- future finance pages

### HeySmart (admin only unless explicitly granted)
- Assistant
- Visitors
- Mail

### System (admin only)
- Backups
- future settings/logs

Analytics/report links should exist in one logical location only. The duplicate header Analytics link must be removed as part of the refactor.

## Mobile navigation

Mobile must not shrink the desktop sidebar into a narrow column.

Final pattern:
- compact header menu button opens an off-canvas left drawer
- drawer uses the same role-filtered navigation source as desktop
- only permitted destinations are rendered
- active destination is clearly highlighted
- current destination survives drawer open/close
- Escape/backdrop closes drawer
- no fixed bottom navigation
- content keeps the full mobile viewport height

The bottom-navigation prototype was rejected during preview testing because the navigation entry point was harder to discover and consumed useful screen space.

## Routing

Navigation state should move away from being DOM-only.

Preferred lightweight approach for the current vanilla JS application:
- hash routes such as #/dashboard, #/products, #/sales
- browser Back/Forward must work
- refresh should preserve the current destination
- invalid or unauthorized routes must fall back to a permitted page

A framework/router migration is not required.

## Implementation sequence

1. Characterization tests for current role access.
2. Introduce one navigation configuration as the source of truth.
3. Render desktop sidebar from that configuration.
4. Render mobile hamburger + drawer from the same configuration.
5. Add hash routing and route authorization.
6. Move "Return to Andrey" out of Dashboard sub-tabs into navigation without changing its calculations.
7. Remove duplicate Analytics entry.
8. Split Accounts UI concepts so Hosts are a destination/entity while Active/New/Cancelled remain filters.
9. Remove legacy top-nav/dropdown code after parity is proven.
10. Run desktop and mobile regression tests before merge.

## Test strategy

### Contract tests
Must verify:
- current shared destinations remain available to viewer
- admin-only destinations remain unavailable to viewer
- admin retains every destination
- role filtering has no implicit fallback that exposes admin-only items
- navigation item IDs/routes are unique

### DOM/navigation tests
During implementation verify:
- active destination state
- sidebar renders on desktop
- hamburger + drawer renders on mobile
- drawer contains role-appropriate items only
- selecting an item closes the mobile drawer
- duplicated Analytics link is removed
- Return to Andrey is reachable for both current roles

### Routing tests
Verify:
- direct hash opens the destination
- refresh preserves destination
- browser navigation changes destination
- unauthorized route for viewer falls back safely

### Regression
Existing inventory, sales, accounts, finance, analytics, assistant and backup tests remain unchanged unless the navigation refactor exposes an existing coupling.

## Non-goals for this refactor

Do not redesign business screens, tables, forms, finance calculations or account workflows in the first navigation iteration.

Do not change user roles or server-side authorization.

Do not introduce a frontend framework solely for navigation.

## Definition of done

- one role-aware navigation source is used by desktop and mobile
- Sergey sees all current admin functionality
- Andrey sees exactly his current viewer functionality and no admin-only pages
- desktop uses the scalable sidebar pattern
- mobile uses the shared hamburger + drawer pattern
- direct navigation is URL-addressable
- no duplicate Analytics navigation
- existing business tests pass
- new navigation tests pass on desktop and mobile


## Preview decisions completed

- Finance, Sales Analytics and Visitors Analytics use the shared navigation shell.
- Visitors points to the full `/analytics` dashboard; the legacy embedded Visitors tab is removed.
- "Return to Andrey" is a first-class navigation destination; the legacy Dashboard sub-tabs are removed.
- Hosts is a first-class admin navigation destination while Subscribers/New/Cancelled remain account status views.
- Inventory uses hash routes with refresh persistence and browser Back/Forward support.
- Mobile uses a header hamburger and left drawer; the bottom navigation prototype was removed.
