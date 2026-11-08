# Migration audit — 2026-10-31

Baseline: `227ebbf4cfb9b78e80c7cf96a628611346a7bcb4`, clean
`feature/homepage`; implementation branch: `feature/modern-fullstack`.
No push, merge, history rewrite or remote change is part of this migration.

Scope clarification from the user: **modernize the learning area at `/app` too**.
The actual dashboard and modules therefore stay available at their existing URLs;
the earlier instruction to replace `/app` with an under-construction page is superseded.

## Existing implementation

Python 3.11 stdlib HTTP server, HTML templates, CSS, JavaScript; no package
manager or database. `serve.py` dispatches public pages, registered learning
routes, shell/module assets, and local MP4s (including byte-range requests).
`i18n.py` combines 97 public strings with shell and module dictionaries:
499 matching VI/EN keys. Locale precedence: valid query, cookie, Vietnamese.
Language cookie is HttpOnly/SameSite=Lax, one year. `/khu-hoc-tap` redirects
to `/app` preserving locale. Unknown paths render a translated 404.

The merged implementation includes 8 learning modules / 11 app routes, a
browser-local `SH.store` under `signhearing:v1`, sample curriculum and 12
local demo videos. The old README/review and the requested migration scope
describe an under-construction app, so they do not fully describe this commit.
Keep all legacy sources and content in place; do not reimplement or delete
learning, local progress, video handling, or their tests. New public frontend
and API live beside them. The legacy server remains independently runnable.

Baseline verification actually run: 2,542 HTTP/i18n/content assertions pass.
No browser or Lighthouse result is inferred from this baseline.

## Brand and content contract

Extracted from `static/landing.css` (not estimated): navy `#082953`, blue
`#2678ed`, text `#244262`, muted `#617596`, sky `#e7f4ff`, pink `#f595b3`,
line `#dce9f6`, white `#fff`. Original font: Segoe UI/Arial, Vietnamese support.
Assets: `static/assets/logo-horizontal.png` 2172×724 and `mascot.png`
1351×1164. Copy bytes unchanged; preserve proportions and reference JPG.

Preserve public dictionary values verbatim, all module keys, the story order,
story-anchor primary CTA, `/app` secondary CTA, honest missing-contact details,
planned 8 modules / 18 lessons, unpublished-learning-material notice, Jordan
and Keller quotes and their exact original citation URLs. No new product
metrics, users, learning content, testimonials, authentication or AI endpoints.

## Target

Next App Router/strict TypeScript, Tailwind v4 tokens, customized shadcn-style
Radix primitives, Motion and Lucide. Server components own content; small client
islands own menu, language hash preservation and non-blocking reveal effects.
FastAPI/Pydantic settings, lazy SQLAlchemy 2.x engine, request-scoped sessions,
Alembic baseline and PostgreSQL Compose service. Landing never fetches the API
or database. Existing source remains usable with `python serve.py`.

Initial machine constraints: only Python 3.11 in PATH, no Node/Docker/Postgres
in PATH. Isolated Node LTS and Python 3.12 runtimes are prepared outside this
checkout. Report database/browser verification honestly if tools are missing.
