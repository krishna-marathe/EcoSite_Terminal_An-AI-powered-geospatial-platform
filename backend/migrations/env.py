from alembic import context

from backend.app.db import make_engine, resolve_migration_target
from backend.app.models.projects import Base
from backend.app.models.phases import ProjectPhase
from backend.app.models.sites import CandidateSite  # Register candidate metadata.
from backend.app.data.models import (  # Register the data plane.
    AuthorityEvidence,
    DataSource,
    IngestionRun,
    MetricResult,
    Observation,
    RawSnapshot,
    ScoreRun,
)
from backend.app.models.evidence import (  # Register evidence foundation.
    Assertion,
    AssertionEvidenceLink,
    AssertionReview,
    EvidenceArtifact,
)

config = context.config


def include_object(obj, name, type_, reflected, compare_to):
    # Legacy tables must never become DROP candidates during autogeneration.
    return not (type_ == "table" and name not in Base.metadata.tables)


target_path = resolve_migration_target(config)
engine = make_engine(target_path)
try:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata,
                          include_object=include_object, compare_type=True, transactional_ddl=True)
        with context.begin_transaction():
            context.run_migrations()
finally:
    engine.dispose()
