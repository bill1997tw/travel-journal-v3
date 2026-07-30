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
- `account-cloud-queue.js`
- `cloud-sync.js`
- `cloud-sync.css`
- `supabase-config.js`
- `test/account-cloud-import.test.js`
- `test/account-cloud-queue.test.js`

Do not enable automatic synchronization yet. Follow the ordered next steps and
acceptance cases in `GEMINI_HANDOFF.md`.

Step B's durable offline queue browser acceptance passed on 2026-07-25.
Localhost-only query switches exist for deterministic regression checks:
`cloudTestOffline=1`, `cloudTestStaleRevision=1`, and
`cloudTestAutoConfirmDiscard=1`. They must remain ignored on deployed hosts.
Step C's deterministic local/cloud state indicators and signed-in browser
acceptance passed on 2026-07-25.

Step D's Supabase Realtime notice flow and signed-in browser acceptance passed
on 2026-07-25. Clean local copies require an explicit
`載入雲端最新版`; edited or queued copies preserve local data and offer
`比較版本`. `cloudTestRealtime=1` is localhost-only and must remain ignored
on deployed hosts. The acceptance run restored the original two local trips.

Steps A-D and guarded automatic saving are complete. Automatic writes must
remain restricted to signed-in owners and editors, preserve queued offline
drafts, and keep revision-conflict recovery intact. Ledger mutations remain in
the cloud platform RPC layer and must not be reimplemented in the UI.

## 2026-07-31 release-candidate integration contract

The system branch is `codex/unified-remember-login`. The UI branch must merge
this branch, not copy individual functions out of it.

System-owned browser modules now include:

- `account-lifecycle.js`
- `api/account-permanent-deletion.js`
- `api/account-deletion-recovery.js`
- `exchange-rate.js`
- `local-account-vault.js`

`cloud-sync.js` loads `account-lifecycle.js` before `account-cloud.js`.
Account-settings UI may call:

```js
const lifecycle = window.voyageAccountCloud?.createLifecycleService?.();
```

If it returns `null`, show an unavailable state and do not simulate success.
Do not call the service-role endpoints directly, duplicate confirmation
phrases, store passwords, or expose server environment variables.

The final UI merge must bump the HTML and service-worker cache versions for all
changed release assets. It must retain the account lifecycle load chain and
run `node --test` before deployment.
