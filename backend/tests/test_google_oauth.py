"""OAuth contracts with a strict Supabase mock. Never contacts a real project."""

import base64
import hashlib
import json
import logging
import time
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services import oauth
from app.services import supabase as sb

UID = "11111111-1111-4111-8111-111111111111"
USER = {
    "id": UID,
    "email": "learner@example.invalid",
    "email_confirmed_at": "2026-11-01T00:00:00Z",
    "identities": [{"provider": "google", "identity_data": {"email_verified": True}}],
}
SESSION = {"access_token": "valid", "refresh_token": "refresh", "expires_in": 3600, "user": USER}
ORIGIN = {"Origin": "https://testserver"}


@pytest.fixture
def upstream(monkeypatch):
    calls = []
    options = {"google": True, "user": USER}
    used = set()

    def handle(request):
        calls.append(request)
        assert request.headers["apikey"] == "sb_publishable_test"
        body = json.loads(request.content) if request.content else {}
        if request.url.path == "/auth/v1/settings":
            return httpx.Response(200, json={"external": {"google": options["google"]}})
        if request.url.path == "/auth/v1/token":
            if request.url.params["grant_type"] == "pkce":
                code = body["auth_code"]
                if code in used or code == "expired":
                    return httpx.Response(400, json={"code": "flow_state_expired"})
                assert hashlib.sha256(body["code_verifier"].encode()).digest() == options["digest"]
                used.add(code)
            return httpx.Response(200, json=SESSION)
        if request.url.path == "/auth/v1/user":
            if request.headers["authorization"] != "Bearer valid":
                return httpx.Response(401, json={"code": "bad_jwt"})
            return httpx.Response(200, json=options["user"])
        if request.url.path == "/auth/v1/logout":
            return httpx.Response(204)
        if request.url.path == "/rest/v1/rpc/sh_learning_snapshot":
            return httpx.Response(
                200,
                json={
                    "lessons": {"1": "completed"},
                    "signs": {},
                    "quiz": {},
                    "practice": [],
                    "favorites": [],
                    "activities": [],
                    "profile": {"display_name": "Existing"},
                },
            )
        raise AssertionError(request.url.path)

    cls = httpx.AsyncClient
    monkeypatch.setattr(
        sb.httpx,
        "AsyncClient",
        lambda **kw: cls(
            transport=httpx.MockTransport(handle),
            **kw,
        ),
    )
    settings = Settings(
        supabase_url="https://project.supabase.co",
        supabase_publishable_key="sb_publishable_test",
        _env_file=None,
    )
    monkeypatch.setattr(sb, "get_settings", lambda: settings)
    monkeypatch.delenv("VERCEL", raising=False)
    return calls, options, settings


@pytest.fixture
def client(upstream):
    with TestClient(create_app(), base_url="https://testserver", follow_redirects=False) as client:
        yield client


def begin(client, upstream, **body):
    response = client.post("/api/auth/google", json=body, headers=ORIGIN)
    assert response.status_code == 200
    query = parse_qs(urlsplit(response.json()["url"]).query)
    upstream[1]["digest"] = base64.urlsafe_b64decode(query["code_challenge"][0] + "=")
    return response, query["redirect_to"][0], query


def callback(client, url, code="good"):
    parsed = urlsplit(url)
    return client.get(parsed.path + "?" + parsed.query + "&" + urlencode({"code": code}))


def test_pkce_session_refresh_logout_and_old_history(client, upstream):
    response, url, query = begin(client, upstream, next="/app/progress?tab=history", lang="en")
    assert query["provider"] == ["google"]
    assert query["code_challenge_method"] == ["s256"]
    assert query["prompt"] == ["select_account"]
    assert url.startswith("https://testserver" + oauth.CALLBACK + "?state=")
    assert "verifier" not in response.text and "access_token" not in response.text
    cookie = response.headers["set-cookie"]
    assert "__Host-" in cookie and "HttpOnly" in cookie and "Secure" in cookie
    assert "SameSite=lax" in cookie and "Max-Age=600" in cookie
    response = callback(client, url)
    assert response.status_code == 303
    assert response.headers["location"] == "/app/progress?tab=history&lang=en"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["cache-control"] == "private, no-store"
    assert client.cookies.get("sh_access") == "valid"
    assert not client.cookies.get(oauth.SECURE_COOKIE)
    assert client.get("/api/auth/session").json()["user"]["id"] == UID
    snapshot = client.get("/api/learning/state").json()
    assert snapshot["lessons"] == {"1": "completed"}
    assert snapshot["user"]["id"] == UID
    assert client.get("/app").status_code == 200
    client.cookies.set("sh_access", "expired", domain="testserver.local", path="/")
    assert client.get("/api/auth/session").cookies["sh_access"] == "valid"
    assert client.post("/api/auth/logout", json={}, headers=ORIGIN).status_code == 204
    assert client.get("/api/auth/session").status_code == 401
    _, second, _ = begin(client, upstream)
    assert callback(client, second, code="second-login").status_code == 303
    assert client.get("/api/auth/session").status_code == 200
    # No direct profile writes, email lookups, account merging or admin keys.
    assert all(r.url.path.startswith(("/auth/v1/", "/rest/v1/rpc/")) for r in upstream[0])


@pytest.mark.parametrize(
    "next_path",
    [
        "https://evil.invalid",
        "//evil.invalid",
        "/\\evil.invalid",
        "/app/../login",
        "/app/%2e%2e/elsewhere",
        "/app/%252e%252e/elsewhere",
        "/app/%5cevil",
        "/app\r\nLocation: evil",
        "/api/auth/logout",
        "javascript:alert(1)",
    ],
)
def test_open_redirect_rejected(client, upstream, next_path):
    _, url, _ = begin(client, upstream, next=next_path)
    assert callback(client, url).headers["location"] == "/app?lang=vi"


@pytest.mark.parametrize("state", ["wrong", "é" * 43, "", "x" * 43])
def test_state_mismatch_never_exchanges_code(client, upstream, state):
    begin(client, upstream)
    response = client.get(oauth.CALLBACK, params={"state": state, "code": "good"})
    assert "oauth_state_invalid" in response.headers["location"]
    assert not client.cookies.get("sh_access")
    assert not any(r.url.path == "/auth/v1/token" for r in upstream[0])


def test_cancellation_cleans_context_and_does_not_echo_provider_error(client, upstream):
    _, url, _ = begin(client, upstream, lang="en")
    response = client.get(url + "&error=access_denied&error_description=secret-detail")
    assert "oauth_cancelled" in response.headers["location"]
    assert "lang=en" in response.headers["location"]
    assert "secret-detail" not in str(response.headers)
    assert not client.cookies.get(oauth.SECURE_COOKIE)
    assert not client.cookies.get("sh_access")


@pytest.mark.parametrize("cookie", [None, "invalid", "W10=", "e30="])
def test_missing_or_malformed_cookie(client, cookie):
    if cookie:
        client.cookies.set(oauth.SECURE_COOKIE, cookie)
    response = client.get(oauth.CALLBACK + "?code=secret-code")
    assert "oauth_expired" in response.headers["location"]
    assert "secret-code" not in str(response.headers)
    assert not client.cookies.get("sh_access")


def test_expired_context(client, upstream, monkeypatch):
    _, url, _ = begin(client, upstream)
    now = time.time()
    monkeypatch.setattr(oauth.time, "time", lambda: now + oauth.TTL + 1)
    assert "oauth_expired" in callback(client, url).headers["location"]


def test_replay_and_expired_code(client, upstream):
    _, url, _ = begin(client, upstream)
    assert "oauth_failed" in callback(client, url, code="expired").headers["location"]
    _, url, _ = begin(client, upstream)
    saved = client.cookies.get(oauth.SECURE_COOKIE)
    assert callback(client, url).headers["location"].startswith("/app")
    # Even restoring an old cookie cannot reuse Supabase's single-use code.
    client.cookies.set(oauth.SECURE_COOKIE, saved, domain="testserver.local", path="/")
    response = callback(client, url)
    assert "oauth_failed" in response.headers["location"]
    assert "sh_access=" not in str(response.headers)


def test_unverified_identity_and_access_token_rejected(client, upstream):
    upstream[1]["user"] = dict(
        USER,
        identities=[
            {
                "provider": "google",
                "identity_data": {"email_verified": False},
            }
        ],
    )
    _, url, _ = begin(client, upstream)
    assert "oauth_identity_unverified" in callback(client, url).headers["location"]
    assert not client.cookies.get("sh_access")
    _, url, _ = begin(client, upstream)
    upstream[1]["user"] = dict(USER, email_confirmed_at=None)
    assert "oauth_identity_unverified" in callback(client, url, "unconfirmed").headers["location"]


def test_google_not_configured_and_csrf(client, upstream):
    upstream[1]["google"] = False
    response = client.post("/api/auth/google", json={}, headers=ORIGIN)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "google_not_configured"
    assert not client.cookies.get(oauth.SECURE_COOKIE)
    for headers in (
        {},
        {"Origin": "https://evil.invalid"},
        dict(
            ORIGIN,
            **{
                "Sec-Fetch-Site": "cross-site",
            },
        ),
    ):
        assert client.post("/api/auth/google", json={}, headers=headers).status_code == 403


def test_local_rewrite_and_vercel_origins(client, upstream, monkeypatch):
    with TestClient(create_app(), base_url="http://127.0.0.1:8001") as local:
        response = local.post(
            "/api/auth/google",
            json={},
            headers={
                "Origin": "http://127.0.0.1:3000",
            },
        )
        assert "Secure" not in response.headers["set-cookie"]
        query = parse_qs(urlsplit(response.json()["url"]).query)
        assert query["redirect_to"][0].startswith("http://127.0.0.1:3000/")
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", "production.example")
    monkeypatch.setenv("VERCEL_URL", "preview.example")
    _, url, _ = begin(client, upstream)
    assert url.startswith("https://production.example/")
    upstream[2].site_url = "https://custom.example"
    _, url, _ = begin(client, upstream)
    assert url.startswith("https://custom.example/")


def test_callback_access_log_redaction():
    record = logging.LogRecord(
        "uvicorn.access",
        20,
        "",
        0,
        "%s %s %s %s %s",
        (
            "127.0.0.1",
            "GET",
            oauth.CALLBACK + "?code=sensitive&state=private",
            "1.1",
            303,
        ),
        None,
    )
    oauth.RedactCallbackQuery().filter(record)
    assert "sensitive" not in record.getMessage() and "private" not in record.getMessage()


def test_long_encoded_next_keeps_verifier_cookie_within_browser_limit(client, upstream):
    response, url, _ = begin(client, upstream, next="/app?name=" + "é" * 1300)
    assert len(response.headers["set-cookie"]) < 4096
    assert callback(client, url).headers["location"] == "/app?lang=vi"


@pytest.mark.parametrize("value", ["https://[bad", "https://host:bad", "http://insecure.example"])
def test_invalid_deployment_origin_fails_clearly(client, upstream, value):
    upstream[2].site_url = value
    response = client.post("/api/auth/google", json={}, headers=ORIGIN)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "oauth_origin_not_configured"


@pytest.mark.parametrize(
    "lang,label", [("vi", "Tiếp tục với Google"), ("en", "Continue with Google")]
)
def test_login_localization_and_assets(client, lang, label):
    response = client.get("/login?lang=" + lang)
    assert response.status_code == 200
    assert label in response.text and "data-google-login" in response.text
    assert "data-auth-toggle" in response.text and 'type="password"' in response.text
    assert "login-mascot-wrap" in response.text and "data-login-transition" in response.text
    assert "{{login.oauth" not in response.text
    assert client.get("/static/google.svg").status_code == 200
