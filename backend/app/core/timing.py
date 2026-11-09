"""Per-request durations only; never include URLs, tokens or account data."""

from contextlib import contextmanager
from contextvars import ContextVar
from time import perf_counter

_timings: ContextVar[dict[str, float] | None] = ContextVar("request_timings", default=None)


@contextmanager
def request_timings():
    values: dict[str, float] = {}
    token = _timings.set(values)
    try:
        yield values
    finally:
        _timings.reset(token)


@contextmanager
def measure(name: str):
    started = perf_counter()
    try:
        yield
    finally:
        values = _timings.get()
        if values is not None:
            values[name] = values.get(name, 0) + (perf_counter() - started) * 1000


def server_timing(values: dict[str, float]) -> str:
    return ", ".join(f"{name};dur={duration:.2f}" for name, duration in values.items())
