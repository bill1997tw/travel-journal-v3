# Gemini entrypoint for travel-journal-v3

Before editing this repository, read:

1. `C:\Users\User\ticket_memory\travel-bill-platform\GEMINI.md`
2. `C:\Users\User\ticket_memory\travel-bill-platform\GEMINI_HANDOFF.md`
3. `C:\Users\User\ticket_memory\travel-bill-platform\AGENTS.md`
4. `C:\Users\User\ticket_memory\travel-bill-platform\docs\TRAVEL_JOURNAL_INTEGRATION.md`

The cloud platform repository is the architecture and migration source of truth.
This repository remains the existing travel UI during the transition.

## Critical worktree rule

The following files already contain user work unrelated to the cloud handoff:

- `app.js`
- `index.css`
- `index.html`
- `local-server.js`
- `sw.js`
- `patch_app_budget.js`
- `search_css.js`

Do not reset, delete, reformat or stage those files as part of cloud work.
Never use `git add .`. Stage only explicit task files.

## Current cloud-owned files

- `account-cloud.js`
- `account-cloud-import.js`
- `cloud-sync.js`
- `cloud-sync.css`
- `supabase-config.js`
- `test/account-cloud-import.test.js`

Do not enable automatic synchronization yet. Follow the ordered next steps and
acceptance cases in `GEMINI_HANDOFF.md`.
