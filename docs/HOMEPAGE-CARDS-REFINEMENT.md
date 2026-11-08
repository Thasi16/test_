# Homepage copy and card colors

Updated 5 November 2026 in the existing local Next.js application.

The homepage now keeps a short hero description and one concise description per
feature card. Repeated hero/final notes, illustration captions, section subtitles,
preview captions within the cards and planned-feature footer notes were removed.
The six card titles, availability badges, illustrations and three learning links
remain. Detailed journey previews still describe sample content, the camera mirror
and planned AI functionality.

Each homepage card has a distinct layered gradient: blue, mint, violet, peach,
pink and lavender. Hover moves a soft color glow and lifts the card; keyboard focus
adds a matching border. The existing pause control and reduced-motion preference
disable the color transitions. Brand assets and the learning area were unchanged.
The hero grid now uses shrinkable columns and responsive artwork widths so its
content stays inside narrow viewports instead of being clipped by the landing.

## Files

- `frontend/src/components/landing/immersive/sections.tsx`: reduced repeated text
  and selected compact card previews.
- `frontend/src/components/landing/immersive/visuals.tsx`: optional compact previews
  and optional progress caption; journey previews retain their existing defaults.
- `frontend/src/styles/immersive.css`: individual palettes, glow, focus styles,
  shorter-copy spacing and improved chapter-number contrast.
- `locales/vi.json`, `locales/en.json`: concise homepage descriptions only.
- `frontend/src/locales/vi.json`, `frontend/src/locales/en.json`: generated
  dictionaries from the existing content synchronization script.
- `frontend/tests/http.test.mjs`: updated expected rendered homepage copy.

## Verification

- Production build including TypeScript: passed.
- Existing content and original brand-asset checks: 2 passed.
- Existing HTTP, language persistence, CTA and proxy checks: 6 passed.
- Homepage browser QA: 151 checks passed across Vietnamese/English and
  1440px/390px viewports, including unique palettes, concise text, keyboard access,
  no horizontal overflow, hero bounds, hover, pause and reduced motion. Additional
  hero bounds and page-width checks passed at 320px, 768px and 999px.
- Homepage cards: four WCAG accessibility audits passed.
- Existing Features/stacking-card regression: 346 checks and four accessibility
  audits passed, including its light/dark themes.
- Homepage retains its existing light visual theme; system-dark mobile rendering
  was also checked. No homepage theme switch was added.
- Changed TSX/CSS/test formatting and `git diff --check`: passed.

Screenshots and audit results: `.runtime/homepage-colors-qa/`.
Pre-edit source backup:
`D:\SignHearing\.tools\backups\homepage-colors-20261105-174243`.

Local preview: `http://127.0.0.1:3000/?lang=vi`.
The existing local frontend was refreshed with the final build. No commit, push
or deployment was performed.
