# SignHearing immersive landing

The public Next.js landing now follows a six-part narrative, using the original logo, mascot, blue/pink/navy palette and locally hosted Manrope font. The backend, database, authentication, and legacy learning modules are unchanged.

## Structure

- `frontend/src/app/page.tsx`: six sections and localized metadata.
- `frontend/src/components/landing/immersive/sections.tsx`: hero, editorial story, learning journey, feature bento, emotional composition, final invitation/contact.
- `motion.tsx`: shared pause control, visible SSR section entrances, desktop parallax and reduced-motion handling.
- `journey.tsx`: three scroll-selected previews with keyboard-accessible manual selection.
- `visuals.tsx`: reusable aurora and illustrative interface previews.
- `frontend/src/styles/immersive.css`: scoped landing styles, responsive layouts and animation rules. Existing shared and learning styles are unchanged.
- `locales/vi.json`, `locales/en.json`: 64 new keys per language. All 99 existing public translations per language remain unchanged. Run `npm run sync:content` to update generated frontend dictionaries; they contain 565 keys per language including the preserved learning translations.

## Composition and motion

The hero pairs two staggered headline lines with the original floating mascot, orbital details and small interface cards. Transform-based aurora layers connect the hero to the final invitation. Editorial copy and a sourced I. King Jordan quotation lead into the project mission. A sticky journey panel changes between library, camera mirror and planned AI previews. Six bento cards use different illustrations and layouts. The navy emotional section combines oversized type, restrained mascot parallax and the sourced Helen Keller quotation.

Motion uses the existing Motion package and CSS, with no new dependencies. Continuous effects start only after hydration and have a shared pause button. The button is the first control in the main content. SSR and no-JavaScript output retain every essential heading, explanation and link. Motion entrances start from a readable opacity; no content depends on an invisible initial state.

At widths below 1000px or heights below 700px, the journey preview stops sticking and automatic scroll selection/parallax are disabled. Mobile stacks the content and keeps manual scene controls. `prefers-reduced-motion` disables animation, transitions, sticky positioning and parallax. Forced-colors mode restores solid headline text. Breakpoints cover narrow phones, mobile, tablet and desktop; images have responsive sizes and only the main mascot has priority loading.

## Product claims

- Library and camera practice are prototype experiences with sample content. The landing never opens a camera.
- Camera practice is described as a mirror with a self-assessment checklist, without recording, uploads or AI scoring.
- Progress is stored in the browser; no account synchronization is claimed.
- AI feedback, scenario-based lessons and automated personalization are explicitly planned and unavailable in the current prototype.
- The proposed eight modules/eighteen lessons remain a curriculum plan. The existing notice about unavailable official videos remains visible.
- No invented statistics, testimonials, contacts or sign-language demonstrations were added. Contact availability and both original quotation citations remain intact.

## Validation

Run in `frontend`, with Node 22+:

```powershell
npm.cmd run sync:content
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:http
```

HTTP tests require the production frontend on port 3000 and existing backend on port 8001. They cover both locales, complete SSR content, six sections, citations, primary/feature CTA destinations, assets, localized 404 responses, persisted language, legacy redirects, health proxy and partial video requests. Content checks verify dictionary parity/source synchronization and byte-identical brand assets. A separate comparison against the previous Git revision verified every existing public translation was preserved.

Verified on 2026-11-04: lint, TypeScript, formatting, production build, both content/asset tests and all six HTTP integration tests passed. The optimized mascot endpoint returned HTTP 200. The production frontend was restarted with the final build; the existing backend remained running.

Browser visual inspection, interaction checks and Lighthouse measurements remain unverified: the available browser-control inventory contained no browsers. Responsive behavior has been reviewed in source; no screenshot-based desktop/mobile approval or performance score is claimed.

Local preview: `http://127.0.0.1:3000/?lang=vi` and `http://127.0.0.1:3000/?lang=en`. These changes have not been pushed or deployed.
