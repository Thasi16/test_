from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})


def get_session() -> Iterator[Session]:
    """Request-owned session; callers explicitly commit approved writes."""
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with factory() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


def check_connection() -> None:
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))
