"""Supplied videos are playable assets attached to existing syllabus words."""

import json
import re
from html import unescape

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import legacy

WORDS = {
    "an": (8, "000734.mp4"),
    "uong": (8, "000736.mp4"),
    "thuc-day": (10, "000450.mp4"),
    "nha": (13, "000074.mp4"),
    "xe-dap": (14, "000410.mp4"),
    "o-to": (14, "000402.mp4"),
    "khoc": (17, "000744.mp4"),
}


@pytest.mark.parametrize("lang", ["vi", "en"])
def test_fill_videos_in_dictionary_lessons_practice_and_quiz(verified_identity, lang):
    content = legacy.app_modules.content
    with TestClient(create_app(), base_url="https://testserver") as client:
        for slug, (lesson_id, filename) in WORDS.items():
            sign = content.sign(slug)
            assert sign["lesson"] == lesson_id
            assert sign["source"]["relative_path"].endswith("/" + filename)
            assert sign["source"]["web_codec"] == "h264"
            body = (legacy.ROOT / sign["video"].lstrip("/")).read_bytes()
            assert b"avc1" in body
            assert body.index(b"moov") < body.index(b"mdat")
            for path in (f"/app/signs/{slug}", f"/app/lessons/{lesson_id}",
                         f"/app/practice/{slug}"):
                page = client.get(path + "?lang=" + lang)
                assert page.status_code == 200
                assert f'src="{sign["video"]}"' in page.text
            partial = client.get(sign["video"], headers={"Range": "bytes=0-127"})
            assert partial.status_code == 206
            assert partial.headers["content-type"] == "video/mp4"
            assert partial.headers["content-range"] == f"bytes 0-127/{len(body)}"
            assert partial.content == body[:128]
            head = client.head(sign["video"])
            assert head.status_code == 200
            assert int(head.headers["content-length"]) == len(body)
            assert not head.content
            lesson_videos = [s for s in content.signs(lesson_id) if s.get("video")]
            quiz_id = lesson_id if len(lesson_videos) >= 2 else "video"
            quiz = client.get(f"/app/review/quiz/{quiz_id}?lang={lang}")
            assert quiz.status_code == 200
            match = re.search(r'<script type="application/json" id="sh-data">(.*?)</script>',
                              quiz.text, re.S)
            payload = json.loads(unescape(match[1]))
            assert any(s["slug"] == slug and s["video"] == sign["video"]
                       for s in payload["signs"])
