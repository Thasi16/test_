"""Video review uses the existing verified identity and quiz history contract."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import legacy
from app.services import supabase as sb


@pytest.mark.parametrize(
    "lang,title", [("vi", "Ôn tập trắc nghiệm"), ("en", "Multiple-choice review")]
)
def test_video_review_landing_and_questions(verified_identity, lang, title):
    with TestClient(create_app(), base_url="https://testserver") as client:
        response = client.get("/app/review?lang=" + lang)
        assert response.status_code == 200
        assert title in response.text
        assert 'class="review-launch"' in response.text
        assert "/app/review/quiz/video?lang=" + lang in response.text
        assert "data-flash" not in response.text
        assert "{{" not in response.text
        response = client.get("/app/review/quiz/video?lang=" + lang)
        assert response.status_code == 200
        assert 'class="review-question-layout"' in response.text
        assert 'class="review-media-panel"' in response.text
        assert 'class="review-answer-panel"' in response.text
        assert 'data-lesson-id="video"' in response.text
        assert 'data-quiz-mode="video"' in response.text
        assert "data-mistake-list" in response.text
        assert "{{" not in response.text


def test_video_review_saves_real_scores_with_same_subject_and_rpc(verified_identity, monkeypatch):
    calls = []

    async def rpc(name, who, payload=None):
        calls.append((name, who.user["id"], payload))
        return {}

    monkeypatch.setattr(sb, "rpc", rpc)
    total = sum(bool(sign.get("video")) for sign in legacy.app_modules.content.signs())
    with TestClient(create_app(), base_url="https://testserver") as client:
        body = {"type": "quiz", "id": "video", "score": 0, "total": total, "event_id": str(uuid4())}
        headers = {"Origin": "https://testserver", "X-SH-User": verified_identity.user["id"]}
        assert client.post("/api/learning/events", json=body, headers=headers).status_code == 200
        assert len(calls) == 1
        name, user_id, payload = calls[0]
        assert name == "sh_record_learning_event"
        assert user_id == verified_identity.user["id"]
        assert payload["event"]["id"] == "video"
        assert payload["event"]["score"] == 0
        assert payload["event"]["total"] == total
        assert payload["event"]["event_id"] == body["event_id"]
        assert (
            client.post(
                "/api/learning/events", json=dict(body, total=total + 1), headers=headers
            ).status_code
            == 422
        )
        assert len(calls) == 1


def test_lesson_links_keep_their_own_video_pool(verified_identity):
    with TestClient(create_app(), base_url="https://testserver") as client:
        response = client.get("/app/review/quiz/1")
        assert response.status_code == 200
        assert 'data-lesson-id="1"' in response.text
        assert 'data-quiz-mode="lesson"' in response.text
        assert client.get("/app/review/quiz/18").status_code == 404
