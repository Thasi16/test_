"""Diagnostic launcher: execute original worker with passive allocation probes."""
import builtins
import os
import runpy
import sys
from memory_metrics import record

record("python_before_worker_imports")
original_import = builtins.__import__
seen = set()


def measured_import(name, *a, **kw):
    first = name in ("numpy", "cv2", "tensorflow", "mediapipe", "jax", "matplotlib") and name not in seen
    if first:
        seen.add(name)
        record("before_import_" + name)
    result = original_import(name, *a, **kw)
    if first:
        record("after_import_" + name)
    return result


def trace(frame, event, value):
    if event not in ("call", "return"):
        return
    name = frame.f_code.co_name
    filename = frame.f_code.co_filename.replace("\\", "/")
    selected = name in ("prepare", "decode_video", "remove_invalid_frames", "sample_frames",
                        "resize_frames", "extract_raw_landmarks", "preprocess_landmarks",
                        "to_siformer", "predict", "build_landmark_detector")
    selected |= name == "__init__" and filename.endswith("/siformer_loader.py")
    if selected and "/ai_inference/" in filename:
        arrays = {}
        if event == "return":
            values = value.values() if isinstance(value, dict) else value if isinstance(value, tuple) else [value]
            for index, item in enumerate(values):
                if hasattr(item, "nbytes") and hasattr(item, "shape"):
                    arrays[str(index)] = {"bytes": int(item.nbytes), "shape": list(item.shape)}
        record(event + ":" + name, {"arrays": arrays, "worker": sys.argv[1]})


builtins.__import__ = measured_import
sys.setprofile(trace)
try:
    runpy.run_module(sys.argv[1], run_name="__main__")
finally:
    sys.setprofile(None)
    record("worker_stopped")
