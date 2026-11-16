"""Operator-only real HTTP stress test; capabilities are never printed or saved."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import struct
import sys
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from ai_inference.app.config import Settings
from backend.app.services.ai_tokens import issue


def main(args):
    settings = Settings(_env_file=args.env_file)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    secret = settings.ai_token_secret.get_secret_value()
    origin = args.origin
    samples = sorted(args.inputs.glob("*.mp4")) + sorted(args.inputs.glob("*-frames.json"))
    run_id = str(time.time_ns())

    def send(path, number):
        content = path.read_bytes()
        token = issue(secret, "memory-" + run_id + "-" + str(number), origin, "")
        req = Request(args.url + "/infer", data=content, headers={
            "Authorization": "Bearer " + token, "Origin": origin,
            "Content-Type": "application/json" if path.suffix == ".json" else "video/mp4"})
        tick = time.perf_counter()
        try:
            with urlopen(req, timeout=100) as response:
                status, result = response.status, json.load(response)
        except HTTPError as error:
            status, result = error.code, json.load(error)
        return {"number": number, "sample": path.name, "bytes": len(content),
                "timestamp": time.time(), "status": status,
                "wall_ms": (time.perf_counter() - tick) * 1000, "response": result}

    ready = False
    for _ in range(180):
        try:
            with urlopen(args.url + "/ready", timeout=2) as response:
                ready = json.load(response)["ready"]
        except Exception:
            pass
        if ready:
            break
        time.sleep(0.5)
    if not ready:
        raise RuntimeError("Runtime did not become ready")

    rows = []
    for index in range(args.count):
        row = send(samples[index % len(samples)], index)
        rows.append(row)
        if index + 1 in (1, 10, 30):
            print(json.dumps({"completed": index + 1, "status": row["status"]}), flush=True)
    # Valid MP4 with a standards-compliant 'free' box. Decoded content is unchanged.
    near = args.output.parent / "near-upload-limit.mp4"
    original = (args.inputs / "an.mp4").read_bytes()
    padding = 20 * 1024 * 1024 - 1024 - len(original)
    near.write_bytes(original + struct.pack(">I4s", padding, b"free") + b"\0" * (padding - 8))
    large = send(near, args.count)
    with ThreadPoolExecutor(max_workers=4) as executor:
        concurrent = list(executor.map(lambda i: send(args.inputs / "an.mp4", args.count + 1 + i), range(4)))
    with urlopen(args.url + "/ready", timeout=3) as response:
        final_ready = json.load(response)
    report = {"count": args.count, "requests": rows, "near_upload_limit": large,
              "concurrent": concurrent, "final_ready": final_ready,
              "auth": "operator diagnostic HMAC, not a live Supabase login"}
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"sequential_200": sum(r["status"] == 200 for r in rows),
                      "large_status": large["status"],
                      "concurrent_statuses": [r["status"] for r in concurrent],
                      "final_ready": final_ready["ready"]}), flush=True)
    if any(r["status"] != 200 for r in rows) or large["status"] != 200:
        raise SystemExit(1)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--url", required=True)
    p.add_argument("--inputs", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--env-file", type=Path, required=True)
    p.add_argument("--origin", default="https://test-signhearing.vercel.app")
    p.add_argument("--count", type=int, default=30)
    main(p.parse_args())
