# SignHearing shrinking sticky card stack

Updated 5 November 2026, Asia/Saigon, for the attached stacking-card brief.

## Implementation

The insertion point is the existing six-card showcase in `FeatureGuide`, used
only by the public Next.js `/features` route. It uses React/TypeScript, the
existing page theme variables and localized server content, with component
CSS Modules. No new dependencies or global CSS changes were needed.

- Roomy desktop sticky offsets are **80, 92, 104, 116, 128 and 140px**. Later
  cards cover earlier cards in increasing stacking order. On shorter windows,
  the base is `min(80px, viewport height − card height − total layer steps − 24px)`.
- The compact revision caps the deck at **1120px** wide and prefers card heights
  of **clamp(320px, 52svh, 480px)**, with natural content growth. The icon and
  number share one header row; repeated badges, long per-card notes, screenshot
  pins/caption legends and duplicate headings are removed. All four usage steps
  and working actions remain. Tall cards scroll fully before their bottom edge pins.
- Each approaching card contributes scroll progress clamped to **0–1** over its
  measured height. Accumulated depth reduces scale by **0.06** and increases the
  black overlay by **0.18** per layer, with a center-top transform origin.
- Passive document scrolling schedules requestAnimationFrame updates. Scroll
  updates change transforms/opacity without React state or automatic timers.
  Scrolling upward reverses the same calculation.
- Previous layers remain visible as 12px steps. The complete final deck holds
  for 12svh of scrolling, clamped to 72–120px. Per-card bottom spacing aligns
  all holders' bottom edges so the layers exit together into onboarding.
- Reusable `FeatureCard` presents the number, title, description, four steps,
  working action and real screenshot. Browser frames retain subtle shadows and
  violet/blue/cyan/pink glows, with 24px card corners and the requested easing
  for non-scroll transitions. Screenshot sizing preserves the original ratio;
  only the small corner zoom button opens the accessible enlargement dialog.
  The image itself stays ordinary, scrollable page content; original-image links
  remain in the dialog and no-JS fallback.
- Widths from 768px use two columns. Narrower layouts use one column and a 20px
  preferred sticky offset. Every width retains overlap; no width/height gate or
  nested scrolling container is used. Single-column screenshots are capped at
  320px wide, with compact padding to reduce overall card height.
- Reduced motion retains native sticky overlap, with scaling, darkening and
  transitions disabled. No JavaScript shows static readable cards. Keyboard focus
  on a card control temporarily removes overlap to keep covered actions usable.
  Wheel/pointer input resumes stacking after keyboard use. Visible focus,
  document scrolling and dialog focus restoration are preserved.

All six guides, VI/EN translations, twelve genuine Playwright screenshot assets,
links, mascot and brand colors are preserved. Screenshot provenance hashes and
actual feature routes are verified. AI grading and scenario conversations remain
explicitly planned; no fictional feature or screenshot was added. The source
license comment and `THIRD_PARTY_LICENSES.md` remain outside rendered HTML/UI.

## Files changed in this revision

| File | Change |
| --- | --- |
| `frontend/src/components/features/feature-card.tsx` | Reusable localized card content |
| `frontend/src/components/features/feature-card.module.css` | Chapter layout, compact tablet/laptop styles, themed screenshot glow and sizing |
| `frontend/src/components/features/feature-guide.tsx` | Render verified guide data with FeatureCard |
| `frontend/src/components/features/guide-screenshot.tsx`, `guide-screenshot.module.css` | Remove screenshot annotations and make enlargement an explicit corner-button action |
| `frontend/src/components/features/shrinking-card-stack.tsx` | 80px offset, normalized depth, common measured size and aligned exit geometry |
| `frontend/src/components/features/shrinking-card-stack.module.css` | Viewport-sized surfaces, reserved layout space, final hold and scoped fallbacks |
| `frontend/tests/features.browser.mjs` | Updated offset/progress assertions; reverse, hold, exit, layout stability and tablet/laptop checks |
| `docs/FEATURES-REPORT.md`, `docs/FEATURES-STACK-223.md` | Current implementation and validation reports |

The compact revision changes the card, stack and screenshot components/modules,
guide composition, browser regression suite and reports. The homepage, learning
platform, backend, source translations and screenshot assets are unchanged.

## Why the effect could disappear

The previous eligibility check required a viewport at least 700 CSS pixels high
and every complete card to fit. A 1366×768 laptop display can have a browser
content area only 600–650 pixels high after browser chrome or display scaling.
Reproduction at 1366×650 and 1280×640 showed `data-stacking=false`, even with
reduced motion off. Earlier tests incorrectly accepted a static short-window
fallback. This gate is removed; adaptive sticky geometry preserves overlap and
readable content. Keyboard focus also no longer leaves pointer browsing in a
permanently unstacked state.

The latest compact revision also removes the 768px width gate and keeps essential
native overlap under reduced motion. The full-image modal trigger is replaced
with a small explicit button, avoiding accidental modal opening while browsing
the screenshot. The user's confirmed preview URL is
`http://127.0.0.1:3000/features?lang=vi`.

## Verification

- Production build, TypeScript and changed-file Prettier checks passed.
- **346 Playwright checks passed** across VI and EN.
- **Four axe-core WCAG A/AA audits** for VI/EN × light/dark: zero violations.
- Existing content/brand tests: 2 passed. Existing HTTP regressions: 6 passed.
- Initial, half-depth and final states, upward reversal, final hold, synchronized
  exit and the next section's visibility passed.
- Checked widths 320, 360, 390, 768, 1024, 1280, 1366 and 1440px; laptop sizes
  1366×768 / 1280×800 and tablets 1024×1024 / 768×1366.
- Short-window regressions cover 1366×650, 1280×640, 1440×600, 1024×600 and
  768×900, 390×844 and 320×700. Real mouse-wheel input, overlapping bounding boxes and
  elementFromPoint hit-testing prove the next card visibly covers the previous
  one. Shrink/darken, adaptive final steps, reachable bottom and reversal pass.
- Checked document wheel/PageDown, emulated touch, visible focus, image dialog
  Enter/Escape/focus restoration, mobile menu and language navigation.
- Checked reduced motion, no JavaScript, both themes, appearance persistence,
  system appearance changes, image decoding/alt/provenance and real feature URLs.
- No horizontal overflow, clipped instructions or unexpected card layout shift
  during load/scroll (layout-shift threshold <0.01).
- Verified compact desktop height 320–500px and deck width ≤1120px, removal of
  redundant annotations, ordinary image clicks without modal opening, wheel
  scrolling directly over images and real emulated phone swipes over cards.

Local QA artifacts are in `.runtime/features-qa/`, including `results.json`,
four accessibility reports, `final-stack-en-1440.png`,
`final-stack-vi-1366x768-dark.png`, `adaptive-stack-vi-1366x650-dark.png`, tablet/mobile captures and
`stack-exit-en-1440.png`. These artifacts are ignored by Git.

## Individual card colors

The six stacked cards now use blue, lavender, peach, mint, pink and indigo
gradients, with matching icons, step numbers and action links. The color spans
both the instructions and screenshot panel, so the exposed layers remain distinct
while stacked. Each palette has light and dark values through the page's existing
color scheme. A soft glow moves on hover and stops under reduced motion.

Only `frontend/src/components/features/feature-card.module.css` changed for this
revision, alongside this report. Sticky positions, depth calculations, scale and
shade values, content, screenshots and event handlers were preserved.

Production build and formatting passed. The Features regression suite passed
346 checks and four accessibility audits. Additional color QA passed 55 checks
and 24 individual-card accessibility audits across light/dark and 1440px/390px,
including distinct palettes, continuous card backgrounds, theme changes, hover,
reduced motion and no horizontal overflow. The six HTTP integration tests also
passed. New screenshots and reports are in `.runtime/stacked-colors-qa/`.

## Subtitle cleanup — 6 November 2026

Removed the scroll-effect explanation, the introductory description beneath each
of the six card titles, and the generic FAQ subtitle in both languages. The
underlying translations remain available; these sentences are no longer rendered.
All six titles, 24 usage steps, screenshots, colored backgrounds and six actions
remain. The stack region retains its accessible name; the removed hint no longer
leaves an `aria-describedby` reference.

Changed `feature-guide.tsx`, `feature-card.tsx`, `shrinking-card-stack.tsx` and the
two card/stack CSS Modules. The existing browser regression now also checks that
card descriptions are absent. Build passed; all 346 browser checks and four
accessibility audits passed. Separate VI/EN checks confirmed that the eight
removed subtitles are absent and all usage steps, actions and accessibility
references remain valid. Local card screenshots: `.runtime/concise-feature-card-vi.png`
and `.runtime/concise-feature-card-en.png`.

Limitations: Firefox, Safari and physical touch devices were not tested. Existing
learning-content and camera limitations are detailed in `FEATURES-REPORT.md`.
