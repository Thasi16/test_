"""Explicit database readiness probe, never called by landing rendering or liveness."""

from app.db.session import check_connection, get_engine

if __name__ == "__main__":
    check_connection()
    get_engine().dispose()
    print("PASS: PostgreSQL SELECT 1")
