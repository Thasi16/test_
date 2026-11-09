"""HTTP contracts against a mocked Supabase upstream; no live credentials required."""

import json
from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.progress import streak_for
from app.core.config import Settings
from app.main import create_app
from app.services import legacy
from app.services import supabase as sb

UID = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
USER = {
    "id": UID,
    "email": "learner@example.invalid",
    "created_at": "2026-11-01T00:00:00Z",
    "user_metadata": {"display_name": "Learner"},
}
HEADERS = {"Origin": "https://testserver", "X-SH-User": UID}
SESSION = {"access_token": "valid", "refresh_token": "refresh", "expires_in": 3600, "user": USER}


@pytest.fixture
def upstream(monkeypatch):
    calls = []

    def handle(request):
        calls.append(request)
        assert request.headers["apikey"] == "sb_publishable_test"
        path = request.url.path
        body = json.loads(request.content) if request.content else {}
        if path == "/auth/v1/user":
            token = request.headers.get("authorization")
            if token == "Bearer valid":
                return httpx.Response(200, json=USER)
            if token == "Bearer other":
                return httpx.Response(200, json=dict(USER, id=OTHER))
            return httpx.Response(401, json={"code": "bad_jwt"})
        if path == "/auth/v1/signup":
            return httpx.Response(200, json=SESSION)
        if path == "/auth/v1/token":
            if body.get("password") == "incorrect":
                return httpx.Response(400, json={"code": "invalid_credentials"})
            return httpx.Response(200, json=SESSION)
        if path == "/auth/v1/logout":
            return httpx.Response(204)
        if path == "/rest/v1/rpc/sh_learning_snapshot":
            assert request.headers["authorization"] in ("Bearer valid", "Bearer other")
            return httpx.Response(
                200,
                json={
                    "lessons": {},
                    "signs": {},
                    "quiz": {},
                    "favorites": [],
                    "practice": [],
                    "activities": [],
                    "activity": None,
                    "profile": {"display_name": "Learner"},
                },
            )
        if path == "/rest/v1/rpc/sh_record_learning_event":
            assert request.headers["authorization"] == "Bearer valid"
            assert "user_id" not in body["event"]
            return httpx.Response(204)
        raise AssertionError(path)

    client = httpx.AsyncClient
    transport = httpx.MockTransport(handle)
    monkeypatch.setattr(sb.httpx, "AsyncClient", lambda **kw: client(transport=transport, **kw))
    settings = Settings(
        supabase_url="https://project.supabase.co",
        supabase_publishable_key="sb_publishable_test",
        _env_file=None,
    )
    monkeypatch.setattr(sb, "get_settings", lambda: settings)
    return calls


@pytest.fixture
def client(upstream):
    with TestClient(create_app(), base_url="https://testserver", follow_redirects=False) as current:
        yield current


def test_register_login_session_logout(client, upstream):
    body = {"email": USER["email"], "password": "test-only-password", "display_name": "Learner"}
    response = client.post("/api/auth/register", json=body, headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["user"]["id"] == UID
    assert "access_token" not in response.text
    for cookie in response.headers.get_list("set-cookie"):
        assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    assert client.get("/api/auth/session").json()["user"]["id"] == UID
    assert client.get("/app/account").status_code == 200
    assert client.post("/api/auth/logout", json={}, headers=HEADERS).status_code == 204
    assert client.get("/api/auth/session").status_code == 401
    redirect = client.get("/app/progress?lang=en")
    assert redirect.status_code == 303
    assert redirect.headers["location"].startswith("/login?lang=en&next=")
    assert (
        client.post(
            "/api/auth/login", json={"email": USER["email"], "password": "correct"}, headers=HEADERS
        ).status_code
        == 200
    )


def test_wrong_password_and_no_demo_bypass(client):
    response = client.post(
        "/api/auth/login", json={"email": USER["email"], "password": "incorrect"}, headers=HEADERS
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"
    client.cookies.set("signhearing_demo_auth", "1")
    assert client.get("/api/learning/state").status_code == 401
    assert client.get("/app").status_code == 303


def test_expired_session_refreshes_and_validates_new_access_token(client, upstream):
    client.cookies.set("sh_access", "expired")
    client.cookies.set("sh_refresh", "refresh")
    response = client.get("/api/learning/state")
    assert response.status_code == 200
    assert response.cookies["sh_access"] == "valid"
    assert any(r.url.query == b"grant_type=refresh_token" for r in upstream)
    assert [r.headers.get("authorization") for r in upstream if r.url.path == "/auth/v1/user"] == [
        "Bearer expired",
        "Bearer valid",
    ]


@pytest.mark.parametrize("origin", [None, "https://attacker.invalid", "null"])
def test_cookie_mutations_reject_csrf(client, origin):
    headers = {"Origin": origin} if origin else {}
    assert (
        client.post(
            "/api/auth/login", json={"email": USER["email"], "password": "correct"}, headers=headers
        ).status_code
        == 403
    )


def test_progress_requires_verified_user_and_validates_content(client, upstream):
    event = {
        "type": "practice",
        "id": "am",
        "event_id": str(uuid4()),
        "checklist": dict.fromkeys(
            ["handshape", "location", "orientation", "movement", "expression"], True
        ),
    }
    assert client.post("/api/learning/events", json=event, headers=HEADERS).status_code == 401
    client.cookies.set("sh_access", "forged")
    assert client.post("/api/learning/events", json=event, headers=HEADERS).status_code == 401
    client.cookies.set("sh_access", "valid")
    assert client.post("/api/learning/events", json=event, headers=HEADERS).status_code == 200
    assert client.post("/api/learning/events", json=event, headers=HEADERS).status_code == 200
    writes = [
        json.loads(r.content) for r in upstream if r.url.path.endswith("sh_record_learning_event")
    ]
    assert writes[0] == writes[1]  # same idempotency key reaches the database
    assert (
        client.post(
            "/api/learning/events", json=dict(event, user_id=OTHER), headers=HEADERS
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/learning/events", json=dict(event, id="unknown-sign"), headers=HEADERS
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/learning/events", json=dict(event, checklist={}), headers=HEADERS
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/learning/events",
            json={
                "type": "quiz",
                "id": "video",
                "event_id": str(uuid4()),
                "score": 999,
                "total": 1,
            },
            headers=HEADERS,
        ).status_code
        == 422
    )


def test_account_switch_cannot_write_old_tab_data(client, upstream):
    client.cookies.set("sh_access", "other")
    response = client.post(
        "/api/learning/events", json={"type": "sign", "id": "am"}, headers=HEADERS
    )
    assert response.status_code == 409
    assert not any(r.url.path.endswith("sh_record_learning_event") for r in upstream)


def test_missing_config_and_upstream_outage_do_not_fake_success(monkeypatch):
    monkeypatch.setattr(sb, "get_settings", lambda: Settings(_env_file=None))
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": USER["email"], "password": "correct"},
            headers={"Origin": "http://testserver"},
        )
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "supabase_not_configured"


def test_streak_vietnam_midnight_duplicate_days_and_login():
    def activity(at, kind="practice"):
        return {"at": at, "type": kind}

    records = [
        activity("2026-11-05T17:01:00Z"),
        activity("2026-11-06T16:59:00Z"),
        activity("2026-11-06T17:00:00Z"),
        activity("2026-11-07T17:00:00Z"),
        activity("2026-11-08T01:00:00Z", "login"),
    ]
    now = datetime(2026, 11, 8, 10, tzinfo=UTC)
    result = streak_for(records, now)
    assert result["current"] == result["longest"] == 3
    assert len(result["days"]) == 30
    assert result["days"][-1] == {"date": "2026-11-08", "count": 1}
    assert streak_for(records[:-2], now)["current"] == 2  # yesterday still keeps the chain
    assert streak_for(records, datetime(2026, 11, 10, tzinfo=UTC))["current"] == 0
    assert streak_for([], now)["longest"] == 0


def test_auth_and_progress_responses_are_not_cacheable(client):
    for path in ("/api/auth/session", "/api/learning/state"):
        response = client.get(path)
        assert response.headers["cache-control"] == "private, no-store"


def test_request_timings_expose_only_phase_durations(client):
    client.cookies.set("sh_access", "valid")
    response = client.get("/app/courses")
    timing = response.headers["server-timing"]
    phases = dict(part.strip().split(";dur=") for part in timing.split(","))
    assert set(phases) == {"auth", "snapshot", "render", "app"}
    assert all(float(duration) >= 0 for duration in phases.values())
    assert "valid" not in timing and USER["email"] not in timing
    # Timings belong to the current request, not a previous authenticated page.
    health = client.get("/api/health")
    assert health.headers["server-timing"].startswith("app;dur=")


def test_connection_pool_keeps_each_users_credentials_on_their_own_requests(client, upstream):
    for token, uid in (("valid", UID), ("other", OTHER), ("valid", UID)):
        client.cookies.set("sh_access", token)
        response = client.get("/api/learning/state")
        assert response.json()["user"]["id"] == uid
        assert [r.headers["authorization"] for r in upstream[-2:]] == [
            "Bearer " + token, "Bearer " + token,
        ]


def test_serverless_without_lifespan_reuses_one_client_for_auth_and_snapshot(upstream, monkeypatch):
    factory = sb.httpx.AsyncClient
    clients = []

    def counted_client(**options):
        current = factory(**options)
        clients.append(current)
        return current

    monkeypatch.setattr(sb.httpx, "AsyncClient", counted_client)
    # Deliberately omit TestClient's context manager to model an adapter without lifespan.
    client = TestClient(create_app(), base_url="https://testserver")
    client.cookies.set("sh_access", "valid")
    assert client.get("/app/courses").status_code == 200
    assert len(clients) == 1
    assert clients[0].is_closed


def test_only_version_matched_public_assets_are_cached_long_term(client):
    asset = legacy.static_file("/static/app/core.js")
    version = legacy.asset_version(asset)
    response = client.get("/static/app/core.js?v=" + version)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    for suffix in ("", "?v=old-version"):
        assert client.get("/static/app/core.js" + suffix).headers["cache-control"] == "no-cache"
    client.cookies.set("sh_access", "valid")
    page = client.get("/app/courses")
    assert f'/static/app/core.js?v={version}' in page.text
    assert page.headers["cache-control"] == "private, no-store"


def test_asset_versions_follow_content_updates(tmp_path):
    asset = tmp_path / "asset.js"
    asset.write_text("before", encoding="utf-8")
    before = legacy.asset_version(asset)
    asset.write_text("after change", encoding="utf-8")
    assert legacy.asset_version(asset) != before


@pytest.mark.parametrize("route", ["/app", "/app/dictionary", "/app/account"])
@pytest.mark.parametrize("locale", ["vi", "en"])
def test_learning_pages_bootstrap_state_with_one_identity_check(client, upstream, route, locale):
    client.cookies.set("sh_access", "valid")
    response = client.get(route + "?lang=" + locale)
    assert response.status_code == 200
    assert 'is-auth-ready' in response.text
    assert 'data-auth-loading' not in response.text
    encoded = response.text.split('<script type="application/json" id="sh-state">')[1].split(
        '</script>'
    )[0]
    snapshot = json.loads(encoded)
    assert snapshot["user"]["id"] == UID
    assert snapshot["profile"]["display_name"] == "Learner"
    assert snapshot["streak"]["current"] == 0
    assert "access_token" not in encoded and "refresh_token" not in encoded
    assert [r.url.path for r in upstream] == [
        "/auth/v1/user", "/rest/v1/rpc/sh_learning_snapshot",
    ]
    assert response.headers["cache-control"] == "private, no-store"
    assert "Cookie" in response.headers["vary"].split(", ")


def test_bootstrap_escapes_user_content_and_preserves_refreshed_cookies(client, monkeypatch):
    name = '</script><script>alert("name")</script>'
    monkeypatch.setitem(USER["user_metadata"], "display_name", name)
    client.cookies.set("sh_access", "expired")
    client.cookies.set("sh_refresh", "refresh")
    response = client.get("/app")
    assert response.cookies["sh_access"] == "valid"
    encoded = response.text.split('<script type="application/json" id="sh-state">')[1].split(
        '</script>'
    )[0]
    assert '<script>' not in encoded
    assert json.loads(encoded)["user"]["user_metadata"]["display_name"] == name


def test_snapshot_outage_keeps_recovery_screen_without_ready_or_fake_progress(client, monkeypatch):
    from unittest.mock import AsyncMock

    client.cookies.set("sh_access", "valid")
    monkeypatch.setattr(
        sb, "rpc", AsyncMock(side_effect=sb.SupabaseError(503, "learning_unavailable"))
    )
    response = client.get("/app")
    assert response.status_code == 200
    assert 'is-auth-ready' not in response.text
    assert 'data-auth-loading' in response.text
    encoded = response.text.split('<script type="application/json" id="sh-state">')[1].split(
        '</script>'
    )[0]
    assert json.loads(encoded) == {"error": "learning_unavailable"}


def test_backend_reads_named_environment_variables(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://env-project.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_from_env")
    settings = Settings(_env_file=None)
    assert settings.supabase_url == "https://env-project.supabase.co"
    assert settings.supabase_publishable_key == "sb_publishable_from_env"
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Settings(supabase_publishable_key="sb_secret_test", _env_file=None)


def test_local_next_proxy_and_vercel_forwarded_origin(monkeypatch):
    from starlette.requests import Request

    def request(host, origin, forwarded=""):
        return Request(
            {
                "type": "http",
                "scheme": "https",
                "path": "/api/auth/login",
                "server": (host, 443),
                "headers": [
                    (b"host", host.encode()),
                    (b"origin", origin.encode()),
                    (b"content-type", b"application/json"),
                    (b"x-forwarded-host", forwarded.encode()),
                ],
            }
        )

    monkeypatch.setattr(sb, "get_settings", lambda: Settings(_env_file=None))
    sb.same_origin(request("127.0.0.1:8001", "http://127.0.0.1:3000"))
    with pytest.raises(sb.SupabaseError):
        sb.same_origin(request("127.0.0.1:8001", "https://attacker.invalid"))
    monkeypatch.setenv("VERCEL", "1")
    sb.same_origin(
        request("backend.internal", "https://signhearing.example", "signhearing.example")
    )
    with pytest.raises(sb.SupabaseError):
        sb.same_origin(
            request("backend.internal", "https://attacker.invalid", "signhearing.example")
        )


def test_upstream_outage_and_confirmation_required_are_explicit(client, monkeypatch):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        sb, "call", AsyncMock(side_effect=sb.SupabaseError(503, "supabase_unavailable"))
    )
    response = client.post(
        "/api/auth/login", json={"email": USER["email"], "password": "correct"}, headers=HEADERS
    )
    assert response.status_code == 503
    assert not response.cookies.get("sh_access")
    monkeypatch.setattr(sb, "call", AsyncMock(return_value={"user": USER}))
    response = client.post(
        "/api/auth/register",
        json={"email": USER["email"], "password": "test-only-password"},
        headers=HEADERS,
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_confirmation_required"
    assert not response.cookies.get("sh_access")
