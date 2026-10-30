"""Deterministic database initialization and bootstrap script for EcoSite Terminal.

Runs Alembic migrations to schema revision 04c_001 and seeds:
1. Data sources (data/data-sources.json)
2. Approved public data centre registry (data/public_data_centres.json)
3. CPCB/SPCB environmental monitoring stations, facility links & baseline observations
4. Synthetic pilot facilities for legacy compatibility (shared/pilot.json)
"""
from __future__ import annotations

import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db import DB_PATH, SCHEMA_REVISION


def bootstrap_database(db_path: Path | None = None) -> bool:
    target_path = (db_path or DB_PATH).expanduser().resolve()
    target_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Check if Alembic migration is required
    needs_alembic = False
    with sqlite3.connect(target_path) as conn:
        has_alembic = conn.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='alembic_version'"
        ).fetchone()[0]
        if not has_alembic:
            needs_alembic = True
        else:
            ver = conn.execute("SELECT version_num FROM alembic_version").fetchone()
            if not ver or ver[0] != SCHEMA_REVISION:
                needs_alembic = True

    if needs_alembic:
        print(f"[EcoSite DB] Running Alembic migrations on {target_path.name}...")
        from alembic import command
        from alembic.config import Config

        cfg = Config(str(ROOT / "backend" / "alembic.ini"))
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{target_path.as_posix()}")
        command.upgrade(cfg, "head")

    # 2. Seed data sources
    from backend.app.data.registry import seed_data_sources

    with sqlite3.connect(target_path) as conn:
        seed_data_sources(conn)
        has_registry = conn.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='public_data_centres'"
        ).fetchone()[0]
        reg_count = conn.execute("SELECT count(*) FROM public_data_centres").fetchone()[0] if has_registry else 0
        has_stations = conn.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='monitoring_stations'"
        ).fetchone()[0]
        st_count = conn.execute("SELECT count(*) FROM monitoring_stations").fetchone()[0] if has_stations else 0

    # 3. Seed public data centres registry
    if reg_count == 0:
        seed_json = ROOT / "data" / "public_data_centres.json"
        if seed_json.exists():
            print(f"[EcoSite DB] Importing approved public data-centre registry from {seed_json.name}...")
            from backend.scripts.import_public_registry import import_public_registry

            import_public_registry(target_path, seed_json)

    # 4. Seed environmental monitoring stations & observations
    if st_count == 0:
        print("[EcoSite DB] Seeding environmental monitoring stations and baseline observations...")
        from backend.scripts.seed_environmental_monitoring import run_seed as seed_env_monitoring

        seed_env_monitoring(target_path)

    return True


def main() -> None:
    t0 = time.time()
    print(f"[EcoSite DB] Initializing database at {DB_PATH}...")
    bootstrap_database(DB_PATH)
    print(f"[EcoSite DB] Initialization completed in {time.time() - t0:.2f}s.")


if __name__ == "__main__":
    main()
