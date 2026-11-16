"""Start the original ASGI app with diagnostic worker launchers and RSS sampling."""
import argparse
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from memory_metrics import process_memory, cgroup_memory, record


def main(args):
    sys.path.insert(0, "/opt/signhearing")
    args.output.mkdir(parents=True, exist_ok=True)
    os.environ["PROFILE_OUTPUT"] = str(args.output)
    record("server_python_baseline")
    original = subprocess.Popen

    def profiled_popen(command, *a, **kw):
        if len(command) >= 4 and command[-1] in ("ai_inference.model_worker", "ai_inference.landmark_worker"):
            env = dict(kw["env"], PROFILE_OUTPUT=str(args.output),
                       PYTHONPATH=str(Path(__file__).parent) + ":/opt/signhearing")
            if args.arenas:
                env["MALLOC_ARENA_MAX"] = str(args.arenas)
            if args.allocator_tuned:
                env.update(MALLOC_ARENA_MAX="2", MALLOC_MMAP_THRESHOLD_="131072",
                           MALLOC_TRIM_THRESHOLD_="131072")
            if args.math_library and command[-1] == "ai_inference.landmark_worker":
                env["LD_PRELOAD"] = args.math_library
            kw["env"] = env
            command = command[:2] + [str(Path(__file__).with_name("profile_worker.py")), command[-1]]
        return original(command, *a, **kw)

    subprocess.Popen = profiled_popen
    from ai_inference.app.main import app
    import uvicorn
    record("server_fastapi_imported")

    def monitor():
        with (args.output / "samples.jsonl").open("a", encoding="utf-8") as output:
            while True:
                pids = [os.getpid()] + [p.pid for p in app.state.pool.processes]
                temporary = list(Path("/tmp").glob("signhearing-infer-*"))
                try:
                    size = sum(p.stat().st_size for d in temporary for p in d.rglob("*") if p.is_file())
                except FileNotFoundError:
                    size = 0
                sample = {"timestamp": time.time(), "processes": [process_memory(pid) for pid in pids],
                          "cgroup": cgroup_memory(), "temporary_file_bytes": size,
                          "ready": app.state.pool.available()}
                output.write(json.dumps(sample) + "\n")
                output.flush()
                time.sleep(0.1)

    threading.Thread(target=monitor, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=args.port, access_log=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--port", type=int, default=80)
    parser.add_argument("--arenas", type=int)
    parser.add_argument("--allocator-tuned", action="store_true")
    parser.add_argument("--math-library")
    main(parser.parse_args())
