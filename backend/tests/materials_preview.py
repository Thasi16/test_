"""Loopback-only UI test server; no Supabase requests or real account writes."""

import sys
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import Settings
from app.services import supabase as sb

settings = Settings(_env_file=None)
sb.get_settings = lambda: settings
snapshot = {
    "lessons": {},
    "signs": {},
    "quiz": {},
    "practice": [],
    "favorites": [],
    "activities": [],
    "activity": None,
    "profile": {"display_name": "Local QA"},
}


async def identity(request):
    return sb.Identity(
        "local-ui-test-only",
        {"id": "11111111-1111-4111-8111-111111111111", "email": "qa@example.invalid"},
    )


async def rpc(name, who, payload=None):
    if name == "sh_learning_snapshot":
        return deepcopy(snapshot)
    assert name == "sh_record_learning_event"
    event = payload["event"]
    if event["type"] == "sign":
        snapshot["signs"][event["id"]] = {"at": datetime.now(UTC).isoformat()}
    elif event["type"] == "favorite":
        snapshot["favorites"] = [slug for slug in snapshot["favorites"] if slug != event["id"]]
        if event["on"]:
            snapshot["favorites"].append(event["id"])
    elif event["type"] == "lesson":
        snapshot["lessons"][event["id"]] = {"state": event["state"]}
    return {}


async def no_upstream(*args, **kwargs):
    raise sb.SupabaseError(503, "supabase_not_configured")


if __name__ == "__main__":
    sb.identity, sb.rpc, sb.call = identity, rpc, no_upstream
    import uvicorn

    from app.main import create_app

    uvicorn.run(create_app(), host="127.0.0.1", port=8011, log_level="warning")
