from alembic import context

from backend.app.db import DB_PATH, make_engine
from backend.app.models.projects import Base
from backend.app.models.phases import ProjectPhase
from backend.app.models.sites import CandidateSite  # Register candidate metadata.
from backend.app.models.legacy_facilities import LegacyFacility  # Compatibility-only metadata.
from backend.app.models.public_registry import (  # Normalized approved public registry.
    FacilityAlias,
    FacilityCapacityDisclosure,
    FacilityOperator,
    FacilitySource,
    FacilityVerification,
    PublicFacilityRecord,
    PublicFacilitySnapshot,
)
from backend.app.models.environmental import (  # Station-linked environmental time series.
    EnvironmentalObservation,
    EnvironmentalRollup,
    FacilityStationLink,
    MetricDefinition,
    MonitoringStation,
)
from backend.app.models.registration import (  # Private submissions and review workflow.
    AuditEvent,
    FacilitySubmission,
    FacilitySubmissionRevision,
    OperatorOrganisation,
    PublicationSnapshot,
    ReviewEvent,
    SubmissionEvidence,
    SubmissionExactGeometry,
)
from backend.app.data.models import (  # Register the data plane.
    AuthorityEvidence,
    DataSource,
    DeveloperEvidence,
    IngestionRun,
    MetricResult,
    Observation,
    RawSnapshot,
    ScoreRun,
)

config = context.config


def include_object(obj, name, type_, reflected, compare_to):
    # Legacy tables must never become DROP candidates during autogeneration.
    if type_ == "table" and name not in Base.metadata.tables:
        return False
    # The compatibility-only facilities table predates Alembic and may contain
    # locally created indexes. Ignore only reflected extras on that one table;
    # managed registry/environmental tables must still report index drift.
    if type_ == "index" and reflected and compare_to is None:
        table = getattr(obj, "table", None)
        if table is not None and table.name == "facilities":
            return False
    return True


engine = make_engine(config.attributes.get("db_path", DB_PATH))
try:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata,
                          include_object=include_object, compare_type=True, transactional_ddl=True)
        with context.begin_transaction():
            context.run_migrations()
finally:
    engine.dispose()
