# SignHearing Features page — implementation and verification

Date: **5 November 2026**, Asia/Saigon.

Updated for the latest shrinking sticky card brief, retaining the #223 depth treatment. See
[the #223 revision report](FEATURES-STACK-223.md) for the replacement details.

## Location and inspection findings

Implemented in the active modern application:
`D:\SignHearing\.checkouts\team-20261031\frontend`.
The older, landing-only files at `D:\SignHearing` remain unchanged.

Before implementation, inspection established:

- Next.js **16.4.3**, App Router, React **19.3.1**, strict TypeScript, Tailwind v4,
  CSS variables, Motion and Lucide. The installed Next.js routing, Server/Client
  Component and image guides were read before adding the route.
- The public header shares its link list with the Radix mobile menu. The four
  existing story links and learning CTA are preserved; Features is added between
  Story and Journey. The shared language switch preserves the page and fragment.
- The original navy, blue, sky and pink variables define the public design.
  There was no existing dark-mode implementation. The new guide has a scoped
  light/dark appearance control, system preference support and saved preference.
- Public dictionaries are generated from the repository's source dictionaries
  plus module dictionaries by `scripts/sync-content.mjs`. **139 matching keys**
  were added to the source VI/EN files; the generated dictionaries now contain
  **704 keys each**. No second localization system was introduced.
- Learning routes are served through the existing same-origin Next.js rewrites
  to FastAPI and the original Python/JS modules. These modules were inspected
  and opened in the browser. This development build requires no login.
- Existing module browser suites use dependency-free Chrome DevTools scripts.
  Playwright was not installed. Playwright **1.64.1** was added under the
  workspace's `.tools/browser-qa` directory and used with installed Chrome.
- Pre-existing uncommitted immersive homepage work was preserved. No backend,
  database/schema, learning module or curriculum source was changed.

## Files created or modified for this task

Paths below are relative to the modern checkout.

| Files | Change |
| --- | --- |
| `frontend/src/app/features/page.tsx` | Public `/features` route and localized metadata |
| `frontend/src/components/features/feature-guide.tsx` | Hero, six guides, onboarding, planned features, FAQ and final CTA |
| `frontend/src/components/features/feature-card.tsx`, `feature-card.module.css` | Reusable localized chapter, responsive two-column layout and themed screenshot glow |
| `frontend/src/components/features/shrinking-card-stack.tsx` | Document-scrolling sticky deck with #223 depth, black overlays and accessible fallbacks |
| `frontend/src/components/features/shrinking-card-stack.module.css` | Component-local #223 shape, motion tokens and SignHearing theme mappings |
| `frontend/src/components/features/guide-screenshot.tsx`, `guide-screenshot.module.css` | Clean screenshot frame, small explicit zoom control, accessible dialog and no-JS original-image link |
| `frontend/src/components/features/feature-preferences.tsx` | Scoped system/light/dark preference and appearance control |
| `frontend/src/styles/features.css` | Namespaced layout, gradients, responsive design, themes and accessible fallbacks |
| `frontend/src/components/layout/header.tsx` | Shared desktop/mobile Features link, active state and current-page language URLs |
| `frontend/src/proxy.ts` | Allowlisted `/features` page identity for language navigation |
| `frontend/src/lib/i18n.ts` | Features metadata type |
| `locales/vi.json`, `locales/en.json` | Source translations for all new content, labels, alt text and metadata |
| `frontend/src/locales/vi.json`, `frontend/src/locales/en.json` | Generated translations using the existing sync command |
| `frontend/public/images/feature-guides/*.webp` | Twelve captured screenshots |
| `frontend/src/data/feature-captures.json` | Capture routes, locale, viewport, browser, states, sizes, annotation coordinates and SHA-256 hashes |
| `frontend/scripts/capture-feature-guides.mjs` | Reproducible Playwright capture and WebP optimization workflow |
| `frontend/tests/features.browser.mjs` | Browser integration and accessibility verification |
| `frontend/package.json` | `capture:features` and `test:features` commands |
| `docs/FEATURES-REPORT.md` | This report |
| `docs/FEATURES-STACK-223.md` | Report of the #223 revision |
| `THIRD_PARTY_LICENSES.md` | Upstream MIT copyright and permission notice, kept outside the rendered UI |

No third-party visual branding or attribution is rendered. The current stack
ports the #223 source supplied by the user. Its source comment and upstream
copyright/permission notice are retained in code and `THIRD_PARTY_LICENSES.md`.

## Existing components reused

Shared `Header`, `MobileNavigation` (Radix Dialog), `LanguageSwitch`, `Footer`,
`Button`, `Reveal`, `AnchorBehavior`, the Manrope font, `next/image`, existing
brand tokens and the unchanged mascot/logo assets. Existing content tests verify
that the brand assets remain byte-identical to the originals.

## Verified workflows and routes

| Guide | Actual routes and important boundaries |
| --- | --- |
| Learning roadmap | `/app/courses`; opens the two sample lessons at `/app/lessons/1` and `/app/lessons/2`. Their curriculum signs currently have no videos; closed lessons stay closed. |
| Sign dictionary | `/app/dictionary`; real search, module/collection/favorite filters and detail links. Not every sign has a video. |
| Sign video playback | `/app/signs/am` (example); native playback, sample/source notice, favorites and a real self-practice link. The imported videos are separate from the curriculum. |
| Camera self-practice | `/app/practice`, `/app/practice/am` (example); reference speed/loop controls, camera mirror, five self-assessment fields and browser-local saves. No AI assessment. |
| Flashcards and quizzes | `/app/review`, `/app/review/quiz/1`; source selection, reveal/memory controls and recognition quizzes. Results are saved at the final result screen; at least 80% marks a lesson complete. |
| Learning progress | `/app/progress`; browser-local summaries, module progress, 30-day calendar, practice history, quiz results and viewed signs. No account sync. |

AI feedback has an empty reserved area in the practice source, with no grading
implementation. Scenario conversations have no implemented route. Both are
presented separately as **planned**, without a launch action or fictional image.

## Real screenshot captures

Captured using Playwright against the running app at a consistent **1440 × 1000**
viewport. Chrome version **156.0.8078.80**. Each screenshot used a fresh,
nonpersistent browser context, the actual route, the selected interface locale,
loaded UI/fonts, and decoded video frames where relevant.

PNG screenshot buffers were optimized to WebP with Sharp, quality 88. No image
content was invented or retouched. Twelve assets total **824,946 bytes** (about
806 KiB). Original annotation coordinates remain recorded separately for VI and
EN as provenance; the compact cards no longer render pins or caption legends.

| Screenshot filenames (inside `frontend/public/images/feature-guides/`) | Captured state |
| --- | --- |
| `learning-roadmap-vi.webp`, `learning-roadmap-en.webp` | Open filter selected by clicking the existing button; no completed lessons |
| `vsl-library-vi.webp`, `vsl-library-en.webp` | Actual first-visit dictionary and imported-collection filter |
| `sign-learning-vi.webp`, `sign-learning-en.webp` | Actual paused imported sample clip and content notice |
| `camera-practice-vi.webp`, `camera-practice-en.webp` | Camera **off**, reference clip decoded, speed controls and camera-start button visible |
| `review-quiz-vi.webp`, `review-quiz-en.webp` | By lesson selected through the real control; no seeded favorites, viewed signs or quiz scores |
| `learning-progress-vi.webp`, `learning-progress-en.webp` | Genuine fresh-browser empty state: 0/2 lessons and zero viewed signs/practice/quiz attempts |

Neither the user's normal browser profile nor private learner data was used.
No credentials were needed. Camera captures do not use a physical webcam or
fabricated video stream. Live webcam operation was not demonstrated. There are
no AI-feedback or scenario-conversation captures because those features do not
exist as usable workflows.

## Stack behavior and differences from the reference demo

The six verified feature cards on `/features` stack during ordinary **page
scrolling**. This revision implements the attached premium stacking-card brief.

- On roomy desktops, each card stays sticky at **80px + index × 12px**.
  Narrow layouts use a 20px preferred base.
  Short windows use an adaptive base offset so tall cards scroll through their
  full content before pinning; the effect is not disabled by viewport height.
  Later cards have increasing stacking order and slide over earlier cards.
- The container follows normal document flow: no fixed-height frame, inner
  scroll area, panel focus stop, wheel interception or scroll handoff is required.
- Each approaching card contributes normalized progress from 0 to 1 over its
  measured height. Scale reduces by 0.06 per accumulated layer; the black overlay
  increases by 0.18 per layer. Reverse scrolling retraces the same progress.
- Reads and writes are coalesced through requestAnimationFrame. Transforms affect
  the visual surfaces; sticky holders retain their measurable layout geometry.
- Desktop cards now prefer **clamp(320px, 52svh, 480px)** and the deck is capped
  at **1120px** wide. Natural content can grow freely. The sticky base is the
  smaller of its preferred offset and `viewport height − measured card height
  − total layer offset − 24px`. The screenshot frame preserves the original
  image aspect ratio. Subtle violet, blue, cyan and
  pink glows complement the original SignHearing palette in both themes.
- Repeated status badges, long per-card notes, numbered screenshot pins, caption
  legends and the duplicate stack title are removed. All four usage steps,
  localized titles/descriptions and working feature actions remain.
- Screenshot images are ordinary page content. Only the small corner zoom button
  opens the dialog, so clicking the image itself cannot accidentally cover the
  page with a modal. Full-resolution links remain in the dialog and no-JS fallback.
- Styling changes stay in three component CSS Modules; global styles are unchanged
  in this revision. Cards retain 24px corners and non-scroll transitions use
  cubic-bezier(0.2, 0.8, 0.2, 1). License notices remain in source files only.
- Stacking stays active at every viewport width, with no minimum-height or
  all-cards-fit gate. Widths from 768px use two compact columns; narrower layouts
  stack the copy and image in one column. Reduced motion retains essential native
  sticky overlap while disabling scaling, darkening and transitions. No JavaScript
  uses readable static cards. Tall cards scroll fully before their bottom edges pin.
  Single-column screenshots are capped at 320px wide so a narrow desktop window
  does not produce an oversized image below the instructions.
- Keyboard focus on a card control temporarily unstacks the cards to keep covered
  links usable. Wheel/pointer browsing resumes the stack so keyboard use cannot
  leave it disabled. Normal wheel, PageDown and touch input scroll the document.
- The final stack forms visible steps and holds for 12vh (clamped to 72–120px
  of scroll). Per-card bottom spacing aligns the holders' bottom edges so all
  layers exit together, retaining the 12px steps as onboarding comes into view.

## Verification

Final automated browser result is recorded in
`.runtime/features-qa/results.json`; axe reports and representative desktop,
stacked, dark and mobile images are in the same directory. These local QA
artifacts are ignored by Git.

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Passed; production build also runs TypeScript |
| Production build (`npm run build`) | Passed; `/features` is a server-rendered route |
| Existing content/brand tests (`npm test`) | 2 passed |
| Existing HTTP/i18n/learning/video-range regressions (`npm run test:http`) | 6 passed |
| Features Playwright suite (`npm run test:features`) | **346 checks passed**, both VI and EN; final result recorded in the JSON report |
| Accessibility | Four axe-core WCAG 2 A/AA and WCAG 2.1 AA audits of the new page: VI/EN × light/dark; zero violations |
| Responsive | 320, 360, 390, 768, 1024, 1280, 1366 and 1440px; laptop 1366×768 / 1280×800, tablet 1024×1024 / 768×1366; no horizontal overflow or clipped instructions |
| Short viewport | 1366×650, 1280×640, 1440×600, 1024×600 and tall-card 768×900 keep stacking; real wheel input, visible overlap/hit-testing, shrink/darken, final steps, reachable bottom and reverse progress passed |
| Sticky model | Half-depth scale 0.97 / overlay 0.09; pinned layer scale 0.94 / overlay 0.18; accumulated depth and stops 80/92/104/116/128/140px, reverse scrolling, final hold and synchronized exit checked |
| Navigation | Public desktop/mobile Features links; retained story/learning links; language switching stays on `/features` |
| Input | Document wheel/PageDown, continued page scrolling over the deck, keyboard controls and emulated mobile touch swipe |
| Keyboard | Visible focus, expanded stack on focus, screenshot Enter/Escape/focus restoration, FAQ, mobile menu Escape/focus restoration |
| Reduced motion / no JavaScript | Reduced motion keeps native overlap with no scale/shade/transitions; no-JS static fallback retains all instructions and original-image links |
| Compactness and scroll | Desktop card height 320–500px and deck width ≤1120px; no repeated badges/notes/pins/captions; image clicks do not open modals; wheel over images and phone touch over cards scroll the document |
| Themes | Light/dark control, reload persistence, system appearance and system changes |
| Stability | Reserved screenshot dimensions and card space; no unexpected card layout shift during load or scroll (browser threshold <0.01) |
| Assets and actions | Every captured image loads, provenance hashes match, alt text exists, and every guide route returns 200 in both locales |

## Run and reproduce

From the modern checkout, after `npm run build` in `frontend`:

```powershell
powershell -NoProfile -File scripts/start-modern.ps1 -Production
```

Open `http://127.0.0.1:3000/features?lang=vi` or
`http://127.0.0.1:3000/features?lang=en`.

For browser checks in this workspace, with both existing servers running:

```powershell
cd frontend
$env:PATH = 'D:\SignHearing\.tools\node-v22.23.4-win-x64;' + $env:PATH
$env:PLAYWRIGHT_MODULE = 'D:\SignHearing\.tools\browser-qa\node_modules\playwright'
$env:AXE_MODULE = 'D:\SignHearing\.tools\browser-qa\node_modules\axe-core'
npm run test:features
```

`npm run capture:features` regenerates the screenshot assets and provenance
manifest from actual pages. `TEST_URL` optionally selects a different running
origin; `CHROME_PATH` optionally selects a Chrome executable for capture.
On another machine, install Playwright and axe-core in a suitable QA environment
and set these module paths (or install Playwright locally). The application
itself gained no runtime dependencies.

## Remaining limitations

- Learning content is still a development prototype: two sample lessons and
  twelve imported, unreviewed clips. This page does not make the materials
  official or enable closed lessons.
- Physical webcam behavior, physical touch devices, Firefox and Safari were not
  tested. Chrome emulation verifies layout/input behavior but cannot establish
  hardware-camera or cross-browser results.
- Appearance changes are scoped to the new guide. Existing shared brand chrome,
  the homepage, learning module styling and captured light UI are preserved.
- Progress remains browser/origin-local. There is no new account, cloud sync,
  AI grading, scenario engine or backend/database change.
- No external hosting deployment, Git commit, push or merge was performed.
