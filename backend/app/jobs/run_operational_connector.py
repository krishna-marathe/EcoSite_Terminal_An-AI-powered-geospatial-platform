"""Manual operational connector command; this module never auto-starts."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from .. import db
from ..data.connectors.cpcb_datagov import CpcbDataGovConnector
from ..data.connectors.configured_public_feed import ImdPublicFeedConnector, NwdpGroundwaterConnector
from ..data.connectors.operational import ConnectorNotConfigured
from .environmental_ingestion import run_connector
from .sqlalchemy_ingestion_store import SqlAlchemyIngestionStore


def build_connector(source: str):
    if source == "cpcb":
        return CpcbDataGovConnector.from_environment()
    if source == "imd":
        return ImdPublicFeedConnector.from_environment(os.environ)
    if source == "nwdp":
        return NwdpGroundwaterConnector.from_environment(os.environ)
    raise ValueError(f"Unsupported operational source {source!r}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=("cpcb", "imd", "nwdp"), required=True)
    parser.add_argument("--check", action="store_true", help="Validate configuration without network or writes")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and parse without persistence")
    parser.add_argument("--db", type=Path, default=db.DB_PATH)
    parser.add_argument("--raw-root", type=Path, default=db.ROOT / "data" / "raw" / "operational")
    args = parser.parse_args(argv)

    try:
        connector = build_connector(args.source)  # Configuration fails before any write.
    except ConnectorNotConfigured as error:
        detail = str(error)
        if args.source == "cpcb" and "missing" in detail:
            detail = "CPCB connector required server settings are missing"
        print(f"Configuration error: {detail}", file=sys.stderr)
        return 2
    if args.check:
        print(json.dumps({"source": connector.source_id, "configured": True}))
        return 0
    if args.dry_run:
        response = connector.fetch()
        observations = connector.parse(response)
        print(json.dumps({"source": connector.source_id, "observations": len(observations)}))
        return 0

    engine = db.make_engine(args.db)
    try:
        store = SqlAlchemyIngestionStore(lambda: Session(engine, expire_on_commit=False), args.raw_root)
        result = run_connector(connector, store)
        print(json.dumps(result.__dict__, sort_keys=True))
    finally:
        engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

