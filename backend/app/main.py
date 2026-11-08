from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, learning
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.db.session import get_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No connection, schema creation or seed at application startup.
    yield
    if get_engine.cache_info().currsize:
        get_engine().dispose()
        get_engine.cache_clear()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="SignHearing API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "HEAD", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(learning.router)
    return app


app = create_app()
