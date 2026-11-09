"""Progressive migration adapter: reuse the team's existing modules without rewriting them.

This adapter calls pure rendering functions; authenticated data lives in app.api.progress.
Importing serve does not start its HTTP server. Page contexts refresh changed translation
files before rendering templates from the shared app shell.
"""

import os
import re
import sys
from functools import lru_cache
from hashlib import sha256
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
REPOSITORY = BACKEND.parent
BUNDLE = BACKEND / "legacy_site"
if os.environ.get("VERCEL") == "1" and (BUNDLE / "app_modules.py").is_file():
    ROOT = BUNDLE
elif (REPOSITORY / "app_modules.py").is_file():
    ROOT = REPOSITORY
else:
    ROOT = BUNDLE
if not (ROOT / "app_modules.py").is_file():
    raise RuntimeError(
        "Learning sources are missing. Run python scripts/prepare_legacy.py during build."
    )
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app_modules  # noqa: E402
from serve import page_context, render_page  # noqa: E402


def _render(locale: str, path: str, *, initial_state: dict | None = None) -> tuple[str, int]:
    if path == "/login":
        return render_page(locale, "/login", "login").decode("utf-8"), 200
    if app_modules.is_app_path(path):
        try:
            return app_modules.render(
                locale, path.rstrip("/"), page_context(locale, path, "app"),
                initial_state=initial_state,
            ), 200
        except app_modules.NotFound:
            pass
    return render_page(locale, "/404", "error").decode("utf-8"), 404


@lru_cache(maxsize=512)
def _asset_version(path: str, modified: int, size: int) -> str:
    return sha256(Path(path).read_bytes()).hexdigest()[:16]


def asset_version(candidate: Path) -> str:
    info = candidate.stat()
    return _asset_version(str(candidate), info.st_mtime_ns, info.st_size)


def render(locale: str, path: str, *, initial_state: dict | None = None) -> tuple[str, int]:
    body, status = _render(locale, path, initial_state=initial_state)

    def version_asset(match):
        candidate = static_file(match[2])
        if not candidate or candidate.suffix == ".mp4":
            return match[0]
        return match[1] + match[2] + "?v=" + asset_version(candidate) + '"'

    return re.sub(r'((?:src|href|poster)=")(/static/[^"?]+)"', version_asset, body), status


def static_file(path: str) -> Path | None:
    if path.startswith(("/static/app/", "/static/m/")):
        return app_modules.static_file(path)
    candidate = (ROOT / path.lstrip("/")).resolve()
    base = (ROOT / "static").resolve()
    allowed = {".css", ".js", ".png", ".svg", ".webp", ".woff2", ".mp4"}
    if candidate.is_relative_to(base) and candidate.suffix in allowed and candidate.is_file():
        return candidate
    return None
