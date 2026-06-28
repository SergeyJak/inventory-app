# Agent Rules

Before changing anything in this repository:

1. Read `PROJECT_CONTEXT.md`.
2. Analyze the request and inspect the relevant files.
3. Share a short plan before edits when the user asks for one or the task spans multiple files.
4. Make minimal, scoped changes only.
5. Run validation before claiming success.
6. Self-review the diff.
7. Report results with changed files, test steps, risks, and build/deploy impact.

Required final response sections:

## Analysis

## Plan

## Implementation

## Verification

## Changed Files

## Build Required

Repository rules:

* Do not modify unrelated files.
* Do not rewrite architecture without an explicit request.
* Prefer existing patterns in `server.js`, `app.js`, and the current static HTML/CSS/JS structure.
* Keep business logic stable unless the user explicitly asks to change it.
* Viewer role is read-only. Viewer may read dashboards/reports but must not create, edit, delete, import, restore, or save inventory data.
* Admin-only routes must keep `requireAdmin`.
* Public catalog and mail routes must stay separated from inventory admin routes by host/path rules in `server.js`.
* Do not expose Gmail credentials or mailbox backend details to public clients.
* Never claim success without verification output.

UI rules:

* Mobile-first.
* Keep spacing, typography, and controls consistent with the current app.
* For inventory/admin UI, keep a practical dashboard style.
* For public catalog/mail UI, keep a polished HeySmart product style.
* Before testing any frontend/mobile UI change, state whether a build/deployment is required.

Documentation rules:

* Keep `PROJECT_CONTEXT.md` stable and factual.
* Put future work in `docs/BACKLOG.md`.
* Put shipped or existing state in `docs/CHANGELOG.md`.
* Do not store secrets, passwords, tokens, or full environment values in docs.
