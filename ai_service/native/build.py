"""Create a verified, auditable native compatibility artifact inside Docker."""
import ctypes
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
library = root / "libwindows_float.so"
native = ctypes.CDLL(str(library)).atan2f
native.argtypes = (ctypes.c_float, ctypes.c_float)
native.restype = ctypes.c_float
# Observed input to the unchanged AlignmentPointsRectsCalculator, frame zero.
assert native(15.676010131835938, -0.301300048828125) == 1.5900144577026367
receipt = {
    "source_sha256": hashlib.sha256((root / "float_math.c").read_bytes()).hexdigest(),
    "binary_sha256": hashlib.sha256(library.read_bytes()).hexdigest(),
    "scope": "MediaPipe worker only",
    "abi": "float atan2f(float, float)",
}
(root / "manifest.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
