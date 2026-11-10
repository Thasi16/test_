"""Imported syllabus, old bookmarks and existing server sessions stay compatible."""

import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import legacy

COUNTS = [19, 29, 22, 20, 16, 19, 10, 23, 30, 31, 24, 22, 22, 13, 18, 33, 39, 10]


def test_syllabus_has_400_unique_words_and_all_18_lessons():
    content = legacy.app_modules.content
    data = content.DATA
    assert len(content.open_lessons()) == 18
    assert len(content.modules()) == 8
    assert [len(content.signs(i)) for i in range(1, 19)] == COUNTS
    syllabus = [sign for sign in data["signs"] if sign["lesson"] is not None]
    assert len({sign["slug"] for sign in syllabus}) == 400
    assert len({sign["word"]["vi"] for sign in syllabus}) == 400
    for lesson in content.open_lessons():
        assert lesson["signs"] == [sign["slug"] for sign in content.signs(lesson["id"])]
        assert all(content.text(lesson["title"], lang) for lang in ("vi", "en"))
    assert data["_syllabus"]["words"] == 400


def test_existing_video_files_are_unchanged_and_still_sample_media():
    content = legacy.app_modules.content
    videos = [sign for sign in content.signs() if sign.get("video")]
    assert len(videos) == 12
    for sign in videos:
        assert sign["status"] == "sample"
        media = legacy.ROOT / sign["video"].lstrip("/")
        assert hashlib.sha256(media.read_bytes()).hexdigest() == sign["source"]["web_sha256"]


@pytest.mark.parametrize("lang", ["vi", "en"])
def test_all_lessons_and_footer_render_with_existing_identity(verified_identity, lang):
    with TestClient(create_app(), base_url="https://testserver") as client:
        for number in range(1, 19):
            response = client.get(f"/app/lessons/{number}?lang={lang}")
            assert response.status_code == 200
            assert response.text.count('<article class="sh-card lesson-sign"') == COUNTS[number - 1]
            assert "VSL400 (Zenodo)" in response.text
            assert "CC BY 4.0" in response.text
            assert "{{" not in response.text
        page = client.get(f"/app/lessons/18?lang={lang}").text
        assert 'class="lesson-media"' not in page
        assert 'class="lesson-observe"' not in page
        assert "data-quiz" not in page
        assert client.get("/app/review/quiz/18").status_code == 404


def test_old_sample_bookmarks_remain_readable(verified_identity):
    content = legacy.app_modules.content
    retained = content.DATA["_legacy_samples"]["slugs"]
    assert len(retained) == 8
    assert "xin-chao" in retained
    with TestClient(create_app(), base_url="https://testserver") as client:
        for slug in retained:
            assert content.sign(slug)["lesson"] is None
            assert client.get("/app/signs/" + slug).status_code == 200
            assert client.get("/app/practice/" + slug).status_code == 200
        page = client.get("/app/dictionary").text
        assert page.count('class="dictionary-item"') == 408
        assert 'data-collection="local-videos"' in page
        assert 'data-search="' in page


def test_lesson_quiz_contains_only_its_video_words(verified_identity):
    content = legacy.app_modules.content
    with TestClient(create_app(), base_url="https://testserver") as client:
        response = client.get("/app/review/quiz/1")
        assert response.status_code == 200
        # The browser and event validator must count the same video questions.
        import re
        from html import unescape

        match = re.search(
            r'<script type="application/json" id="sh-data">(.*?)</script>', response.text, re.S
        )
        payload = json.loads(unescape(match[1]))
        visible = [sign for sign in payload["signs"] if sign["lesson"] == 1 and sign["video"]]
        assert len(visible) == sum(bool(sign["video"]) for sign in content.signs(1))
        assert len(visible) >= 2
