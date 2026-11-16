"""Configure Preview only; read secrets from ignored local files.

Requires official Vercel CLI login, an already linked Free Redis and private Blob.
Never prints credentials or puts their values in process command arguments.
"""
import json
import secrets
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
PROJECT = "prj_wtJlUbLLBMgSXUpA0dyMYOjRHxpo"
SCOPE = "thasi1"
BRANCH = "deploy/vercel-siformer-cpu"


def main():
    linked = json.loads((ROOT / ".vercel/project.json").read_text())
    if linked["projectId"] != PROJECT:
        raise SystemExit("Wrong project; no environment changes applied")
    preview = dotenv_values(ROOT / ".runtime/preview.env")
    existing = dotenv_values(ROOT / ".runtime/production-readonly.env")
    local = dotenv_values(ROOT / ".runtime/container.env")
    redis = urlsplit(preview.get("REDIS_URL") or preview.get("KV_URL") or "")
    if not redis.hostname or not redis.hostname.endswith(".upstash.io") or not redis.password:
        raise SystemExit("Expected provisioned Upstash Redis URL")
    # Upstash requires TLS, even if an integration's compatibility URL says redis.
    redis_url = urlunsplit(("rediss", redis.netloc, redis.path, redis.query, redis.fragment))
    values = {
        "AI_TOKEN_SECRET": local["AI_TOKEN_SECRET"],
        "AI_STATE_BACKEND": "redis",
        "AI_REDIS_URL": redis_url,
        "AI_STATE_NAMESPACE": "signhearing:ai:preview:v2:",
        "AI_ALLOWED_ORIGINS": "[]",  # exact deployment domains added by runtime
        "AI_BLOB_ORIGIN": "https://0zk2agghomgabrcy.private.blob.vercel-storage.com",
        "BLOB_READ_WRITE_TOKEN": preview["BLOB_READ_WRITE_TOKEN"],
        "APP_ENV": "preview",
        "CRON_SECRET": secrets.token_urlsafe(48),
    }
    for key in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"):
        values[key] = existing.get(key) or ""
        if not values[key] or values[key] == "[SENSITIVE]":
            raise SystemExit("Existing public Supabase config unavailable: " + key)
    if not values["SUPABASE_PUBLISHABLE_KEY"].startswith("sb_publishable_"):
        raise SystemExit("Expected Supabase publishable credential")
    private = {"AI_TOKEN_SECRET", "AI_REDIS_URL", "BLOB_READ_WRITE_TOKEN", "CRON_SECRET"}
    executable = shutil.which("npx.cmd") or shutil.which("npx")
    if not executable:
        raise SystemExit("npx unavailable")
    for key, value in values.items():
        command = [executable, "--yes", "vercel@65.16.0", "env", "add", key,
                   "--environment", "preview",
                   "--project", PROJECT, "--scope", SCOPE, "--cwd", str(ROOT),
                   "--force", "--yes", "--sensitive" if key in private else "--no-sensitive"]
        result = subprocess.run(command, input=value, capture_output=True, text=True, cwd=ROOT)
        if result.returncode:
            diagnostic = result.stdout + result.stderr
            for hidden in list(values.values()) + list(preview.values()):
                if hidden and len(hidden) > 12:
                    diagnostic = diagnostic.replace(hidden, "[REDACTED]")
            print(diagnostic[:1800])
            raise SystemExit("Preview configuration failed for " + key + "; credential output suppressed")
        print("Configured Preview: " + key, flush=True)
    report = {"project": PROJECT, "team": SCOPE, "branch": BRANCH, "target": "preview",
              "keys": sorted(values), "production_mutated": False, "branch_scope": None,
              "redis_plan": "free", "redis_auto_upgrade": False, "blob_access": "private"}
    (ROOT / "ai_inference/reports/vercel-preview-configuration.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
