"""Linux-only metrics. Records sizes and process identities, never request data."""
import json
import os
import time
from pathlib import Path


def process_memory(pid):
    result = {"pid": pid}
    try:
        for name in ("status", "smaps_rollup"):
            for line in Path(f"/proc/{pid}/{name}").read_text().splitlines():
                key, _, value = line.partition(":")
                if key in ("VmRSS", "VmHWM", "Rss", "Pss", "Pss_Anon", "Pss_File", "Private_Dirty", "Private_Clean"):
                    result[key + "_bytes"] = int(value.split()[0]) * 1024
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        result["exited"] = True
    return result


def cgroup_memory():
    result = {}
    root = Path("/sys/fs/cgroup")
    for name in ("memory.current", "memory.peak", "memory.max"):
        try:
            value = (root / name).read_text().strip()
            result[name] = int(value) if value.isdigit() else value
        except OSError:
            pass
    for name in ("memory.stat", "memory.events"):
        try:
            values = dict(line.split() for line in (root / name).read_text().splitlines())
            result[name] = {k: int(v) for k, v in values.items()}
        except OSError:
            pass
    return result


def record(stage, extra=None):
    folder = os.environ.get("PROFILE_OUTPUT")
    if not folder:
        return
    data = {"timestamp": time.time(), "stage": stage, "process": process_memory(os.getpid()),
            "cgroup": cgroup_memory(), "extra": extra or {}}
    path = Path(folder) / f"worker-{os.getpid()}.jsonl"
    # One append syscall per record, no shared mutable request buffers.
    fd = os.open(path, os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600)
    try:
        os.write(fd, (json.dumps(data) + "\n").encode())
    finally:
        os.close(fd)
