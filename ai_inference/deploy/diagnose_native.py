"""Read-only native detector diagnostics; never imported by production workers."""
import argparse
import base64
import hashlib
import importlib.metadata
import json
import os
import platform
import sys
from pathlib import Path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def inventory():
    import cv2
    import numpy as np
    import mediapipe as mp
    from mediapipe.python import _framework_bindings as native
    packages = {}
    for name in ("mediapipe", "numpy", "protobuf", "opencv-contrib-python", "jax", "jaxlib", "scipy", "pillow"):
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            packages[name] = None
    extensions = []
    for directory in (Path(mp.__file__).parent / "python", Path(cv2.__file__).parent):
        for path in directory.rglob("*"):
            if path.suffix in (".pyd", ".so"):
                extensions.append({"name": path.name, "bytes": path.stat().st_size, "sha256": digest(path)})
    return {
        "platform": platform.platform(), "python": sys.version,
        "packages": packages, "native_extensions": extensions,
        "binding_modules": dir(native), "opencv_build": cv2.getBuildInformation(),
        "numpy_config": str(np.__config__.show(mode="dicts")),
        "environment": {k: os.environ.get(k) for k in (
            "OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
            "TF_ENABLE_ONEDNN_OPTS", "OPENCV_CPU_DISABLE", "MALLOC_ARENA_MAX")},
    }


def capture(args):
    import numpy as np
    from mediapipe.python import packet_getter, solution_base
    from mediapipe.python._framework_bindings import calculator_graph, validated_graph_config
    from ai_inference.landmark_worker import prepare
    from ai_inference.landmarks.landmark_encoder import build_landmark_detector, extract_raw_landmarks

    args.output.mkdir(parents=True, exist_ok=True)
    original = calculator_graph.CalculatorGraph
    events = {}
    types = {}
    failures = {}
    graph_bytes = []

    def observer(name, packet):
        if packet.is_empty():
            return
        kind = types[name]
        try:
            if kind == "float":
                value = packet_getter.get_float(packet)
            elif kind == "bool":
                value = packet_getter.get_bool(packet)
            elif kind == "int":
                value = packet_getter.get_int(packet)
            elif "vector" in kind:
                values = packet_getter.get_proto_list(packet)
                value = [base64.b64encode(p.SerializeToString()).decode("ascii") for p in values]
            else:
                value = base64.b64encode(packet_getter.get_proto(packet).SerializeToString()).decode("ascii")
            events.setdefault(name, []).append({"timestamp": packet.timestamp.value, "value": value})
        except Exception as error:
            failures[name] = type(error).__name__ + ": " + str(error)[:160]

    def observed_graph(*a, **kw):
        cfg = kw["graph_config"]
        graph_bytes.append(cfg.SerializeToString())
        (args.output / "expanded-graph.pbtxt").write_text(str(cfg), encoding="utf-8")
        validated = validated_graph_config.ValidatedGraphConfig()
        validated.initialize(graph_config=cfg)
        graph = original(*a, **kw)
        names = set()
        for node in cfg.node:
            for stream in node.output_stream:
                names.add(stream.split(":")[-1])
        # Passive observation only: no calculators/options/thresholds are changed.
        for name in sorted(names):
            try:
                kind = validated.registered_stream_type_name(name)
            except RuntimeError:
                continue
            if (kind in ("float", "bool", "int") or any(t in kind for t in (
                    "NormalizedLandmarkList", "LandmarkList", "Detection", "NormalizedRect"))):
                types[name] = kind
                graph.observe_output_stream(name, observer, False)
        return graph

    calculator_graph.CalculatorGraph = observed_graph
    cfg_path = Path(__file__).resolve().parents[1] / "landmarks/preprocessing.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    if args.threads is not None:
        cfg["landmark_extraction"]["num_threads"] = args.threads
    try:
        with build_landmark_detector(cfg["landmark_extraction"]) as detector:
            clip = prepare(args.input)
            raw = extract_raw_landmarks(clip, detector)
            np.savez_compressed(args.output / "detector.npz", frames=clip["frames"],
                                indices=clip["frame_indices"], valid=clip["valid_mask"],
                                raw=raw["landmarks"], detection=raw["detection_mask"])
    finally:
        calculator_graph.CalculatorGraph = original
    result = {"inventory": inventory(), "stream_types": types, "events": events,
              "unsupported_streams": failures,
              "expanded_graph_sha256": [hashlib.sha256(x).hexdigest() for x in graph_bytes]}
    (args.output / "native.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"streams": len(events), "unsupported": len(failures),
                      "output": str(args.output)}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--threads", type=int, choices=range(1, 9))
    capture(parser.parse_args())
