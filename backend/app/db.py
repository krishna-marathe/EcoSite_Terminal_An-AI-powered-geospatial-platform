"""SQLite ownership shared by project sessions and Alembic; legacy sqlite3 stays intact."""
import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.getenv("ECOSITE_DB_PATH", str(ROOT / "data" / "ecosite.db"))).expanduser().resolve()
SCHEMA_REVISION = "04c_001"


class SchemaNotReady(Exception):
    pass


def make_engine(path: Path):
    path = path.expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(URL.create("sqlite", database=str(path)), poolclass=NullPool,
                           connect_args={"check_same_thread": False, "timeout": 5})

    @event.listens_for(engine, "connect")
    def configure_connection(connection, _record):
        # Explicit BEGIN also makes SQLite DDL transactional on Python 3.11.
        connection.isolation_level = None
        cursor = connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
        finally:
            cursor.close()

    @event.listens_for(engine, "begin")
    def begin(connection):
        connection.exec_driver_sql("BEGIN IMMEDIATE" if connection.get_execution_options().get("sqlite_immediate") else "BEGIN")

    return engine


@contextmanager
def project_session(path: Path):
    engine = make_engine(path)
    try:
        with engine.connect() as connection:
            exists = connection.scalar(text("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='alembic_version'"))
            if not exists or connection.scalar(text("SELECT version_num FROM alembic_version")) != SCHEMA_REVISION:
                raise SchemaNotReady("Run the reviewed Alembic upgrade before using projects.")
        with Session(engine, expire_on_commit=False) as session, session.begin():
            yield session
    finally:
        engine.dispose()
