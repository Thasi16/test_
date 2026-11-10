"""Supabase PKCE adapter; the existing Supabase session remains the only session."""

import base64
import hashlib
import json
import logging
import os
import re
import secrets
import time
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

from fastapi import Request, Response

from app.services import supabase as sb

CALLBACK = "/api/auth/google/callback"
COOKIE = "sh_google_oauth"
SECURE_COOKIE = "__Host-sh_google_oauth"
TTL = 600


def secure(request: Request) -> bool:
    return (
        request.url.scheme == "https"
        or sb.get_settings().app_env == "production"
        or os.environ.get("VERCEL") == "1"
    )


def cookie_name(request: Request) -> str:
    return SECURE_COOKIE if secure(request) else COOKIE


def clear(response: Response, request: Request):
    response.delete_cookie(
        cookie_name(request), path="/", secure=secure(request), httponly=True, samesite="lax"
    )


def destination(value: str, lang: str) -> str:
    """Allow only absolute paths in the existing protected learning area."""
    try:
        parsed = urlsplit(value)
        decoded = unquote(parsed.path)
        if (
            len(value) > 1500
            or parsed.scheme
            or parsed.netloc
            or not re.fullmatch(r"/app(?:/[A-Za-z0-9_/-]*)?", decoded)
            or any(segment in (".", "..") for segment in decoded.split("/"))
            or any(ord(c) < 32 or ord(c) == 127 or c == "\\" for c in unquote(value))
        ):
            raise ValueError
        query = [(k, v) for k, v in parse_qsl(parsed.query) if k != "lang"]
        query.append(("lang", lang))
        return urlunsplit(("", "", decoded, urlencode(query), parsed.fragment))
    except ValueError:
        return "/app?" + urlencode({"lang": lang})


def public_origin(request: Request) -> str:
    settings = sb.get_settings()
    host = (
        (
            os.environ.get("VERCEL_PROJECT_PRODUCTION_URL")
            if os.environ.get("VERCEL_ENV") == "production"
            else os.environ.get("VERCEL_URL")
        )
        or os.environ.get("VERCEL_URL")
        or os.environ.get("VERCEL_PROJECT_PRODUCTION_URL")
    )
    value = settings.site_url or ("https://" + host if host else "")
    # same_origin() has already validated this browser Origin, including the local rewrite.
    if not value and settings.app_env == "development" and os.environ.get("VERCEL") != "1":
        value = request.headers.get("origin", "")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        raise sb.SupabaseError(503, "oauth_origin_not_configured") from None
    if (
        not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
        or parsed.scheme not in ("http", "https")
        or port == 0
        or (secure(request) and parsed.scheme != "https")
    ):
        raise sb.SupabaseError(503, "oauth_origin_not_configured")
    return value.rstrip("/")


async def start(request: Request, response: Response, next_path: str, lang: str) -> str:
    sb.same_origin(request)
    origin = public_origin(request)
    config = await sb.call("GET", "/auth/v1/settings")
    if not config.get("external", {}).get("google"):
        raise sb.SupabaseError(503, "google_not_configured")
    verifier = secrets.token_urlsafe(64)
    state = secrets.token_urlsafe(32)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    )
    context = {
        "verifier": verifier,
        "state": state,
        "lang": lang,
        "next": destination(next_path, lang),
        "issued": int(time.time()),
    }
    encoded = base64.urlsafe_b64encode(json.dumps(context).encode()).decode()
    if len(encoded) > 3500:
        # Browsers reject cookies above ~4 KB. Never lose the verifier because
        # a highly encoded next URL expanded while being serialized.
        context["next"] = destination("/app", lang)
        encoded = base64.urlsafe_b64encode(json.dumps(context).encode()).decode()
    # Host-only, short-lived, browser-bound context survives serverless cold starts.
    # No signing key is needed: PKCE binds the code to this random verifier, state
    # binds the callback to this browser, and redirects are validated again on use.
    response.set_cookie(
        cookie_name(request),
        encoded,
        max_age=TTL,
        path="/",
        httponly=True,
        secure=secure(request),
        samesite="lax",
    )
    return (
        sb.get_settings().supabase_url
        + "/auth/v1/authorize?"
        + urlencode(
            {
                "provider": "google",
                "redirect_to": origin + CALLBACK + "?" + urlencode({"state": state}),
                "code_challenge": challenge,
                "code_challenge_method": "s256",
                "prompt": "select_account",
            }
        )
    )


def context_for(request: Request) -> dict:
    try:
        raw = request.cookies.get(cookie_name(request), "")
        if len(raw) > 3500:
            raise ValueError
        context = json.loads(base64.b64decode(raw, altchars=b"-_", validate=True))
        age = time.time() - context["issued"]
        if (
            not 0 <= age <= TTL
            or not re.fullmatch(r"[A-Za-z0-9_-]{86}", context["verifier"])
            or not re.fullmatch(r"[A-Za-z0-9_-]{43}", context["state"])
            or context["lang"] not in ("vi", "en")
            or not isinstance(context["next"], str)
        ):
            raise ValueError
        return context
    except (ValueError, KeyError, TypeError):
        raise sb.SupabaseError(401, "oauth_expired") from None


async def exchange(request: Request, context: dict) -> dict:
    states = request.query_params.getlist("state")
    if (
        len(states) != 1
        or not re.fullmatch(r"[A-Za-z0-9_-]{43}", states[0])
        or not secrets.compare_digest(states[0], context["state"])
    ):
        raise sb.SupabaseError(401, "oauth_state_invalid")
    if request.query_params.get("error"):
        code = (
            "oauth_cancelled"
            if request.query_params["error"] == "access_denied"
            else "oauth_failed"
        )
        raise sb.SupabaseError(401, code)
    codes = request.query_params.getlist("code")
    if len(codes) != 1 or not codes[0] or len(codes[0]) > 2048:
        raise sb.SupabaseError(401, "oauth_failed")
    session = await sb.call(
        "POST",
        "/auth/v1/token?grant_type=pkce",
        payload={
            "auth_code": codes[0],
            "code_verifier": context["verifier"],
        },
    )
    if (
        not isinstance(session, dict)
        or not session.get("access_token")
        or not session.get("refresh_token")
        or not isinstance(session.get("expires_in", 3600), int)
    ):
        raise sb.SupabaseError(401, "oauth_failed")
    user = await sb.call("GET", "/auth/v1/user", token=session["access_token"])
    # Only the server-verified user is authoritative. Do not link/merge by email.
    google = [i for i in user.get("identities", []) if i.get("provider") == "google"]
    if (
        not user.get("id")
        or not user.get("email_confirmed_at")
        or not any(i.get("identity_data", {}).get("email_verified") is True for i in google)
    ):
        raise sb.SupabaseError(401, "oauth_identity_unverified")
    session["user"] = user
    return session


class RedactCallbackQuery(logging.Filter):
    """Uvicorn access logs otherwise include the single-use authorization code."""

    def filter(self, record):
        if isinstance(record.args, tuple) and len(record.args) == 5:
            args = list(record.args)
            if str(args[2]).split("?", 1)[0] == CALLBACK:
                args[2] = CALLBACK
                record.args = tuple(args)
        return True
