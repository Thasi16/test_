from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Metadata registry for future approved models. No business tables are invented."""
