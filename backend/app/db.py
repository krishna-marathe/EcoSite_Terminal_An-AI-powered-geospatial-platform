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


def make_engine(path: Path | str):
    path = Path(path).expanduser().resolve()
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


def resolve_migration_target(config) -> Path:
    """Resolve and validate the target SQLite database path for Alembic migrations.

    Precedence and rules:
    1. Explicit config.attributes['db_path'] (Path or str).
    2. Explicit config.get_main_option('sqlalchemy.url') (sqlite file URL).
    3. If both are provided, they must resolve to the identical absolute path, else ValueError.
    4. If neither is provided in config, falls back to the ECOSITE_DB_PATH environment variable.
    5. If no target can be determined, raises ValueError (missing target).
    6. If the target resolves to the normal database (backend/data/ecosite.db), it is blocked
       unless ECOSITE_ALLOW_NORMAL_DB_MIGRATION=1 is set.
    7. Targets inside the backup directory (backend/data/backups) are strictly prohibited.
    """
    attr_target = config.attributes.get("db_path") if hasattr(config, "attributes") else None
    attr_path = None
    if attr_target is not None:
        if isinstance(attr_target, str) and not attr_target.strip():
            raise ValueError("Explicit db_path cannot be empty.")
        attr_path = Path(attr_target).expanduser().resolve()

    url_str = config.get_main_option("sqlalchemy.url") if hasattr(config, "get_main_option") else None
    url_path = None
    if url_str is not None and url_str.strip():
        from sqlalchemy.engine import make_url

        try:
            parsed = make_url(url_str.strip())
        except Exception as exc:
            raise ValueError(f"Malformed sqlalchemy.url: {exc}") from exc

        if parsed.get_backend_name() != "sqlite":
            raise ValueError(
                f"Unsupported database URL scheme: '{parsed.get_backend_name()}'. "
                "Only SQLite URLs are supported for Alembic migrations."
            )
        if not parsed.database or parsed.database.strip() in ("", ":memory:"):
            raise ValueError("Configured SQLite URL must specify a file path, not in-memory or empty database.")
        url_path = Path(parsed.database.strip()).expanduser().resolve()

    if attr_path is not None and url_path is not None:
        if attr_path != url_path:
            raise ValueError(
                f"Conflicting migration targets specified: config.attributes['db_path'] is '{attr_path}', "
                f"but sqlalchemy.url specifies '{url_path}'."
            )
        chosen_path = attr_path
    elif attr_path is not None:
        chosen_path = attr_path
    elif url_path is not None:
        chosen_path = url_path
    else:
        env_val = os.getenv("ECOSITE_DB_PATH")
        if env_val is not None and env_val.strip():
            chosen_path = Path(env_val.strip()).expanduser().resolve()
        else:
            chosen_path = None

    if chosen_path is None:
        raise ValueError(
            "No migration database target specified. Set config.attributes['db_path'], "
            "sqlalchemy.url, or the ECOSITE_DB_PATH environment variable."
        )

    normal_db_path = (ROOT / "data" / "ecosite.db").resolve()
    backup_dir_path = (ROOT / "data" / "backups").resolve()

    try:
        is_backup = chosen_path.is_relative_to(backup_dir_path)
    except AttributeError:
        is_backup = str(chosen_path).startswith(str(backup_dir_path))

    if is_backup:
        raise PermissionError(
            f"Migration target '{chosen_path}' is inside the backups directory. "
            "Migrating database backups directly is prohibited."
        )

    if chosen_path == normal_db_path:
        allow_normal = os.getenv("ECOSITE_ALLOW_NORMAL_DB_MIGRATION", "").strip().lower() in ("1", "true", "yes")
        if not allow_normal:
            raise PermissionError(
                f"Migration of the normal database ('{chosen_path}') is protected. "
                "Direct migration is blocked to prevent accidental data modification. "
                "To authorize, set ECOSITE_ALLOW_NORMAL_DB_MIGRATION=1 with a verified backup."
            )

    return chosen_path
