"""The compatibility ABI is confined to MediaPipe; credentials stay in ASGI."""
from pathlib import Path
import pytest
from ai_inference.app.config import PACKAGED_MODEL, Settings
from ai_inference.app.inference import InferencePool


def test_native_library_path_is_pinned(tmp_path):
    with pytest.raises(ValueError):
        Settings(mp_math_library=str(tmp_path / "other.so"), _env_file=None)


def test_worker_environment_keeps_tensorflow_unmodified_and_secrets_private(monkeypatch):
    library = str(PACKAGED_MODEL.parent / "native/libwindows_float.so")
    settings = Settings(mp_math_library=library, _env_file=None)
    monkeypatch.setenv("AI_TOKEN_SECRET", "private-test-placeholder")
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "private-test-placeholder")
    monkeypatch.setenv("AI_REDIS_URL", "private-test-placeholder")
    monkeypatch.setenv("LD_PRELOAD", "/untrusted/system.so")
    monkeypatch.setenv("MALLOC_MMAP_THRESHOLD_", "131072")
    pool = InferencePool(settings)
    model = pool._worker_environment("ai_inference.model_worker")
    media = pool._worker_environment("ai_inference.landmark_worker")
    assert "LD_PRELOAD" not in model
    assert media["LD_PRELOAD"] == library
    for env in (model, media):
        assert env["MALLOC_MMAP_THRESHOLD_"] == "131072"
        assert not any(name in env for name in ("AI_TOKEN_SECRET", "BLOB_READ_WRITE_TOKEN", "AI_REDIS_URL"))
