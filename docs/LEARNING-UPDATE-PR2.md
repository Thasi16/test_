# Learning update from merged PR #2

Date: 5 November 2026, Asia/Saigon.

## Source and integration

- Repository: https://github.com/dvkhanh911/signhearing-vsl400
- Merged PR: https://github.com/dvkhanh911/signhearing-vsl400/pull/2
- Upstream branch: `origin/feature/homepage` (the repository's default branch).
- Imported commit: `6a6ff7ac5987b8f853699cc4aa962f0a4cdae192`.
- Common base: `227ebbf4cfb9b78e80c7cf96a628611346a7bcb4`.
- Active checkout: `D:\SignHearing\.checkouts\team-20261031`.

Fetched the upstream update and selectively applied 37 learning-related paths:
the shell/sidebar/topbar, account module, demo login, curriculum descriptions,
module text/UI updates and their tests. The working branch remains
`feature/modern-fullstack`, with its existing local changes preserved. This was
a working-tree integration; no commit, push, branch switch or remote merge was made.

The upstream changes to `index.html`, `under-construction.html` and
`static/landing.css` were excluded to retain the local public website. Source
locale files gained 19 login keys and updated two learning-related values per
language. All other existing values remain unchanged. Generated dictionaries
now contain 764 keys per language, using the existing sync script.

## Compatibility work

- Added `/login` to the existing Next.js-to-FastAPI rewrites and legacy-rendering
  adapter; the login and learning pages share the existing port/origin.
- Kept the selected login language when returning to a deep learning link.
- Reconciled the modern learning CSS with the new sidebar width/collapse state.
- Kept the new topbar within narrow screens and clipped sidebar background
  decorations that otherwise caused horizontal overflow.
- Added backend coverage for `/login` and `/app/account`, plus
  `frontend/tests/learning-update.browser.mjs` for the merged browser workflows.

The login is the upstream **browser-local demo**, accepting any nonempty username
and password. It is not a new server account system. Passwords are not stored.
The account/Premium page remains the upstream sample UI; subscription/payment
services are not connected. Logging out removes demo-auth state and preserves
the existing `signhearing:v1` learning progress.

## Preserved homepage and Features

Preservation is measured against the local state at the start of this update,
including its pre-existing uncommitted homepage and Features work.

- **69 public UI/source/asset files** remain byte-identical to the saved snapshot.
- **600 existing source translation values** remain identical, excluding the two
  intentionally updated learning-related values in each language.
- Homepage text and full-page dimensions match before/after for VI/EN at
  1440px and 390px. Image comparisons match within a two-channel-level rendering
  tolerance; final captures have no pixels exceeding that tolerance.
- The Features page, compact sticky cards, images, theme behavior and local
  branding were preserved. Its existing 346-check browser suite still passes.

## Backup and evidence

Source backup before integration:

`D:\SignHearing\.tools\backups\learning-pr2-20261105-3633cd24\working-tree.zip`

The same folder contains the original pending Git patch/status, protected-file
SHA-256 manifest, imported patch/path list, and homepage screenshots/comparison.
The archive contains 248 source files and is 16,404,872 bytes. Local environment,
dependencies and browser profiles were not copied or modified.

Learning QA screenshots and results: `.runtime/learning-update-qa/`.
Features QA results: `.runtime/features-qa/`.

## Validation

- Production frontend build and TypeScript compilation: passed.
- Backend: **34 passed**, one database-dependent test skipped because no
  PostgreSQL test connection is configured.
- Learning-module render/content tests: **40 passed** across account, settings,
  dictionary, practice, dashboard, lesson, progress and review.
- Existing frontend content/brand tests: **2 passed**.
- Existing HTTP/proxy/i18n/video-range regressions: **6 passed**.
- New browser integration: **145 passed**, covering VI/EN, all 12 learning
  routes, login validation/deep links/language/normal-motion transition,
  sidebar collapse/reload/mobile behavior, account actions, external-return
  rejection, password non-storage and progress preservation across logout/login.
- Existing Features browser suite: **346 passed**, plus four accessibility audits.
- Homepage snapshot preservation and `git diff --check`: passed.

All browser state was in isolated disposable QA contexts. The user's normal
browser profile and saved progress were not accessed. Firefox/Safari and physical
camera behavior were not tested in this update.

## Local entry points

- Preserved homepage: http://127.0.0.1:3000/?lang=vi
- Preserved Features page: http://127.0.0.1:3000/features?lang=vi
- Updated learning area: http://127.0.0.1:3000/app?lang=vi
- Demo login: http://127.0.0.1:3000/login?lang=vi
- Account: http://127.0.0.1:3000/app/account?lang=vi

Both existing servers were restarted on the same local ports with the updated
source. The existing startup script remains `scripts/start-modern.ps1 -Production`.
