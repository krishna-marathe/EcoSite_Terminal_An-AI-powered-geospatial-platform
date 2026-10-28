import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from threading import Barrier
from unittest.mock import patch
from uuid import UUID, uuid4

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from backend.app import db, main as api
from backend.app.models.projects import Project
from backend.app.routers import projects

ROOT = Path(__file__).resolve().parents[2]


def migration_config(path):
    config = Config(str(ROOT / "backend/alembic.ini"))
    config.attributes["db_path"] = path
    return config


class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "projects.db"
        self.enterContext(patch.object(api, "DB_PATH", self.path))
        self.enterContext(patch.object(db, "DB_PATH", self.path))
        command.upgrade(migration_config(self.path), "head")

        async def local_app(scope, receive, send):
            # Starlette 0.41 TestClient has no configurable client address.
            if scope["type"] == "http":
                scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)
        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))
        self.body = dict(name="  India compute pilot  ", organization_label="EcoSite", archetype="colocation")

    def create(self):
        response = self.client.post("/api/v1/projects", json=self.body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_crud_archive_restore_and_pagination(self):
        project = self.create()
        UUID(project["id"])
        self.assertEqual(project["name"], "India compute pilot")
        self.assertEqual((project["stage"], project["status"], project["revision"]), ("concept", "active", 1))
        self.assertTrue(project["created_at"].endswith("Z"))
        url = "/api/v1/projects/" + project["id"]
        self.assertEqual(self.client.get(url).json(), project)
        updated = self.client.patch(url, json={"expected_revision": 1, "stage": "feasibility", "name": "Revised"})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["revision"], 2)
        self.assertEqual(updated.json()["created_at"], project["created_at"])
        archived = self.client.delete(url + "?expected_revision=2")
        self.assertEqual(archived.status_code, 200)
        self.assertEqual((archived.json()["revision"], archived.json()["status"]), (3, "archived"))
        self.assertEqual(self.client.get("/api/v1/projects").json()["total"], 0)
        self.assertEqual(self.client.get("/api/v1/projects?include_archived=true").json()["total"], 1)
        self.assertEqual(self.client.get(url).json()["status"], "archived")
        self.assertEqual(self.client.patch(url, json={"expected_revision": 3, "status": "active"}).json()["revision"], 4)
        self.create()
        result = self.client.get("/api/v1/projects?page_size=1&page=2").json()
        self.assertEqual((result["total"], len(result["items"])), (2, 1))
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 2)

    def test_bound_strings_preserve_legacy_facilities(self):
        with closing(sqlite3.connect(self.path)) as connection:
            before = connection.execute("SELECT * FROM facilities ORDER BY id").fetchall()
        self.body["name"] = "x'); DROP TABLE facilities; --"
        project = self.create()
        self.assertEqual(project["name"], self.body["name"])
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute("SELECT * FROM facilities ORDER BY id").fetchall(), before)
        self.assertEqual(len(self.client.get("/api/v1/facilities").json()), 6)

    def test_persistence_in_fresh_process_and_restart(self):
        project = self.create()
        script = "from backend.app.db import project_session; from backend.app.models.projects import Project; from pathlib import Path; import json,sys; "
        script += "\nwith project_session(Path(sys.argv[1])) as s: print(json.dumps({'name':s.get(Project,sys.argv[2]).name,'revision':s.get(Project,sys.argv[2]).revision}))"
        completed = subprocess.run([sys.executable, "-c", script, str(self.path), project["id"]], cwd=ROOT, text=True, capture_output=True, check=True)
        self.assertEqual(json.loads(completed.stdout), {"name": "India compute pilot", "revision": 1})
        api.startup()
        self.assertEqual(self.client.get("/api/v1/projects/" + project["id"]).json(), project)

    def test_stale_writes_and_archive_return_409_without_changes(self):
        project = self.create()
        url = "/api/v1/projects/" + project["id"]
        self.assertEqual(self.client.patch(url, json={"expected_revision": 1, "name": "Winner"}).status_code, 200)
        for response in [self.client.patch(url, json={"expected_revision": 1, "name": "Stale"}), self.client.delete(url + "?expected_revision=1")]:
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()["detail"]["code"], "revision_conflict")
        self.assertEqual(self.client.get(url).json()["name"], "Winner")
        self.assertEqual(self.client.get(url).json()["status"], "active")

    def test_concurrent_revisions_have_one_winner(self):
        project = self.create()
        barrier = Barrier(2)
        original = projects.revise
        def synchronized(*args):
            barrier.wait(timeout=10)
            return original(*args)
        with patch.object(projects, "revise", side_effect=synchronized), ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda name: self.client.patch("/api/v1/projects/" + project["id"], json={"expected_revision": 1, "name": name}), ["A", "B"]))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])
        self.assertEqual(self.client.get("/api/v1/projects/" + project["id"]).json()["revision"], 2)

    def test_validation_and_missing_records(self):
        invalid = [{}, {**self.body, "name": " "}, {**self.body, "name": "x" * 201}, {**self.body, "organization_label": None}, {**self.body, "archetype": "unknown"}, {**self.body, "stage": "unknown"}, {**self.body, "owner_id": "fake"}, {**self.body, "revision": 99}]
        for body in invalid:
            self.assertEqual(self.client.post("/api/v1/projects", json=body).status_code, 422)
        project = self.create()
        url = "/api/v1/projects/" + project["id"]
        for body in [{}, {"expected_revision": 1}, {"expected_revision": True, "name": "X"}, {"expected_revision": 0, "name": "X"}, {"expected_revision": 1, "name": None}, {"expected_revision": 1, "status": "deleted"}, {"expected_revision": 1, "id": str(uuid4())}]:
            self.assertEqual(self.client.patch(url, json=body).status_code, 422)
        self.assertEqual(self.client.delete(url).status_code, 422)
        self.assertEqual(self.client.get("/api/v1/projects/not-a-uuid").status_code, 422)
        missing = "/api/v1/projects/" + str(uuid4())
        self.assertEqual(self.client.get(missing).status_code, 404)
        self.assertEqual(self.client.patch(missing, json={"expected_revision": 1, "name": "X"}).status_code, 404)
        self.assertEqual(self.client.delete(missing + "?expected_revision=1").status_code, 404)
        for query in ["page=0", "page_size=101"]:
            self.assertEqual(self.client.get("/api/v1/projects?" + query).status_code, 422)
        self.assertEqual(self.client.get(url).json()["revision"], 1)

    def test_failed_transaction_rolls_back_and_closes_handles(self):
        with self.assertRaises(RuntimeError):
            with db.project_session(self.path) as session:
                session.add(Project(**self.body))
                session.flush()
                raise RuntimeError("injected failure")
        self.assertEqual(self.client.get("/api/v1/projects").json()["total"], 0)
        with self.assertRaises(IntegrityError):
            with db.project_session(self.path) as session:
                session.add(Project(**{**self.body, "status": "invalid"}))
                session.flush()
        self.assertEqual(self.client.get("/api/v1/projects").json()["total"], 0)
        self.path.unlink()
        self.assertFalse(self.path.exists())

    def test_api_failure_rolls_back_without_exposing_sql(self):
        original = projects.revise
        def fail_after_update(session, *args):
            result = original(session, *args)
            session.execute(text("INSERT INTO missing_table VALUES ('sensitive-sql')"))
            return result
        project = self.create()
        url = "/api/v1/projects/" + project["id"]
        with patch.object(projects, "revise", side_effect=fail_after_update):
            response = self.client.patch(url, json={"expected_revision": 1, "name": "Should rollback"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("sensitive", response.text)
        self.assertEqual(self.client.get(url).json(), project)

    def test_local_only_host_origin_and_remote_clients(self):
        self.assertEqual(self.client.post("/api/v1/projects", json=self.body, headers={"Origin": "https://evil.example"}).status_code, 403)
        self.assertEqual(self.client.get("/api/v1/projects", headers={"Host": "evil.example"}).status_code, 403)
        self.assertEqual(self.client.get("/api/v1/projects", headers={"Host": "[invalid"}).status_code, 403)
        # The unwrapped TestClient's non-loopback client must fail closed.
        with TestClient(api.app, base_url="http://127.0.0.1") as remote:
            self.assertEqual(remote.get("/api/v1/projects").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/projects", json=self.body, headers={"Origin": "http://localhost:5173"}).status_code, 201)

    def test_missing_or_incompatible_migration_is_controlled(self):
        empty = Path(self.temp) / "unmigrated.db"
        with patch.object(db, "DB_PATH", empty):
            response = self.client.get("/api/v1/projects")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "schema_not_ready")
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.execute("UPDATE alembic_version SET version_num='future'")
        self.assertEqual(self.client.get("/api/v1/projects").status_code, 503)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "migration.db"

    def test_empty_database_upgrade_idempotent_and_pragmas(self):
        config = migration_config(self.path)
        command.upgrade(config, "head")
        command.upgrade(config, "head")
        command.check(config)
        engine = db.make_engine(self.path)
        try:
            with engine.connect() as connection:
                self.assertEqual(connection.scalar(text("PRAGMA foreign_keys")), 1)
                self.assertEqual(connection.scalar(text("PRAGMA busy_timeout")), 5000)
                self.assertEqual(connection.scalar(text("SELECT version_num FROM alembic_version")), db.SCHEMA_REVISION)
                self.assertEqual(
                    set(connection.scalars(text("SELECT name FROM sqlite_master WHERE type='table'"))),
                    {
                        "projects",
                        "candidate_sites",
                        "project_phases",
                        "data_sources",
                        "ingestion_runs",
                        "raw_snapshots",
                        "observations",
                        "authority_evidence",
                        "score_runs",
                        "metric_results",
                        "evidence_artifacts",
                        "assertions",
                        "assertion_evidence_links",
                        "assertion_reviews",
                        "power_commitments",
                        "water_commitments",
                        "alembic_version",
                    },
                )
        finally:
            engine.dispose()
        self.path.unlink()

    def test_legacy_table_schema_payloads_and_indexes_preserved(self):
        with patch.object(api, "DB_PATH", self.path):
            api.ensure_database()
            api.upsert_facility(api.Facility.model_validate(api.PILOT["facilities"][0]))
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.execute("CREATE INDEX custom_legacy_name ON facilities(name)")
            before = connection.execute("SELECT * FROM facilities ORDER BY id").fetchall()
            schema = connection.execute("SELECT type,name,sql FROM sqlite_master WHERE tbl_name='facilities' ORDER BY name").fetchall()
        config = migration_config(self.path)
        command.upgrade(config, "head")
        command.check(config)
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute("SELECT * FROM facilities ORDER BY id").fetchall(), before)
            self.assertEqual(connection.execute("SELECT type,name,sql FROM sqlite_master WHERE tbl_name='facilities' ORDER BY name").fetchall(), schema)
            self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")

    def test_migration_failure_rolls_back_ddl_and_can_retry(self):
        with patch("alembic.op.create_index", side_effect=RuntimeError("injected migration failure")):
            with self.assertRaises(RuntimeError):
                command.upgrade(migration_config(self.path), "head")
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertIsNone(connection.execute("SELECT name FROM sqlite_master WHERE name='projects'").fetchone())
        command.upgrade(migration_config(self.path), "head")
        with db.project_session(self.path) as session:
            self.assertEqual(session.scalar(text("SELECT COUNT(*) FROM projects")), 0)

    def test_absolute_path_is_shared_from_different_working_directories(self):
        env = dict(os.environ, ECOSITE_DB_PATH=str(self.path))
        script = "from backend.app import db,main; print(db.DB_PATH); print(main.DB_PATH)"
        result = subprocess.run([sys.executable, "-c", script], cwd=ROOT, env=env, capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout.splitlines(), [str(self.path), str(self.path)])
        script = "from app.db import DB_PATH; print(DB_PATH)"
        result = subprocess.run([sys.executable, "-c", script], cwd=ROOT / "backend", env=env, capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout.strip(), str(self.path))

    def test_cli_upgrade_works_from_repository_and_backend(self):
        for cwd in (ROOT, ROOT / "backend"):
            path = Path(self.temp) / (cwd.name + " # percent%") / "cli.db"
            env = dict(os.environ, ECOSITE_DB_PATH=str(path))
            result = subprocess.run([sys.executable, "-m", "alembic", "-c", str(ROOT / "backend/alembic.ini"), "upgrade", "head"], cwd=cwd, env=env, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            with db.project_session(path) as session:
                self.assertEqual(session.scalar(text("SELECT COUNT(*) FROM projects")), 0)

    def test_explicit_disposable_database_selection(self):
        # 1. Via config.attributes["db_path"] as Path
        path_a = Path(self.temp) / "explicit_a.db"
        cfg_a = Config(str(ROOT / "backend/alembic.ini"))
        cfg_a.attributes["db_path"] = path_a
        self.assertEqual(db.resolve_migration_target(cfg_a), path_a.resolve())
        command.upgrade(cfg_a, "head")
        self.assertTrue(path_a.exists())

        # 2. Via config.attributes["db_path"] as str
        path_b = Path(self.temp) / "explicit_b.db"
        cfg_b = Config(str(ROOT / "backend/alembic.ini"))
        cfg_b.attributes["db_path"] = str(path_b)
        self.assertEqual(db.resolve_migration_target(cfg_b), path_b.resolve())
        command.upgrade(cfg_b, "head")
        self.assertTrue(path_b.exists())

        # 3. Via config.set_main_option("sqlalchemy.url", ...)
        path_c = Path(self.temp) / "explicit_c.db"
        cfg_c = Config(str(ROOT / "backend/alembic.ini"))
        cfg_c.set_main_option("sqlalchemy.url", f"sqlite:///{path_c.as_posix()}")
        self.assertEqual(db.resolve_migration_target(cfg_c), path_c.resolve())
        command.upgrade(cfg_c, "head")
        self.assertTrue(path_c.exists())

        # 4. Matching db_path and sqlalchemy.url
        path_d = Path(self.temp) / "explicit_d.db"
        cfg_d = Config(str(ROOT / "backend/alembic.ini"))
        cfg_d.attributes["db_path"] = path_d
        cfg_d.set_main_option("sqlalchemy.url", f"sqlite:///{path_d.as_posix()}")
        self.assertEqual(db.resolve_migration_target(cfg_d), path_d.resolve())
        command.upgrade(cfg_d, "head")
        self.assertTrue(path_d.exists())

    def test_conflicting_migration_targets_rejected(self):
        path_1 = Path(self.temp) / "one.db"
        path_2 = Path(self.temp) / "two.db"
        cfg = Config(str(ROOT / "backend/alembic.ini"))
        cfg.attributes["db_path"] = path_1
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{path_2.as_posix()}")
        with self.assertRaises(ValueError) as ctx:
            db.resolve_migration_target(cfg)
        self.assertIn("Conflicting migration targets", str(ctx.exception))

        with self.assertRaises(ValueError):
            command.upgrade(cfg, "head")

    def test_missing_targets_and_invalid_urls_rejected(self):
        cfg = Config(str(ROOT / "backend/alembic.ini"))
        with patch.dict(os.environ, {}, clear=True):
            # No db_path, no sqlalchemy.url, no ECOSITE_DB_PATH
            with self.assertRaises(ValueError) as ctx:
                db.resolve_migration_target(cfg)
            self.assertIn("No migration database target specified", str(ctx.exception))

            # Empty string db_path
            cfg.attributes["db_path"] = "   "
            with self.assertRaises(ValueError) as ctx:
                db.resolve_migration_target(cfg)
            self.assertIn("cannot be empty", str(ctx.exception))
            cfg.attributes.pop("db_path")

            # Non-sqlite URL
            cfg.set_main_option("sqlalchemy.url", "postgresql://user:pass@localhost/mydb")
            with self.assertRaises(ValueError) as ctx:
                db.resolve_migration_target(cfg)
            self.assertIn("Unsupported database URL scheme", str(ctx.exception))

            # In-memory SQLite URL
            cfg.set_main_option("sqlalchemy.url", "sqlite:///:memory:")
            with self.assertRaises(ValueError) as ctx:
                db.resolve_migration_target(cfg)
            self.assertIn("must specify a file path", str(ctx.exception))

    def test_normal_database_and_backups_protection(self):
        normal_path = (ROOT / "backend" / "data" / "ecosite.db").resolve()
        cfg_normal = Config(str(ROOT / "backend/alembic.ini"))
        cfg_normal.attributes["db_path"] = normal_path

        # Direct migration of normal database must be blocked without explicit env var
        with patch.dict(os.environ, {"ECOSITE_ALLOW_NORMAL_DB_MIGRATION": ""}):
            with self.assertRaises(PermissionError) as ctx:
                db.resolve_migration_target(cfg_normal)
            self.assertIn("is protected", str(ctx.exception))

            with self.assertRaises(PermissionError):
                command.upgrade(cfg_normal, "head")

        # Explicit confirmation permits resolution
        with patch.dict(os.environ, {"ECOSITE_ALLOW_NORMAL_DB_MIGRATION": "1"}):
            self.assertEqual(db.resolve_migration_target(cfg_normal), normal_path)

        # Migration targeting any backup file is strictly prohibited
        backup_path = (ROOT / "backend" / "data" / "backups" / "test_backup.db").resolve()
        cfg_backup = Config(str(ROOT / "backend/alembic.ini"))
        cfg_backup.attributes["db_path"] = backup_path
        with patch.dict(os.environ, {"ECOSITE_ALLOW_NORMAL_DB_MIGRATION": "1"}):
            with self.assertRaises(PermissionError) as ctx:
                db.resolve_migration_target(cfg_backup)
            self.assertIn("backups directory", str(ctx.exception))
