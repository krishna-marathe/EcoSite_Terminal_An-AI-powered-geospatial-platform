from alembic import context

from backend.app.db import DB_PATH, make_engine
from backend.app.models.projects import Base
from backend.app.models.phases import ProjectPhase
from backend.app.models.sites import CandidateSite  # Register candidate metadata.

config = context.config


def include_object(obj, name, type_, reflected, compare_to):
    # Legacy tables must never become DROP candidates during autogeneration.
    return not (type_ == "table" and name not in Base.metadata.tables)


engine = make_engine(config.attributes.get("db_path", DB_PATH))
try:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata,
                          include_object=include_object, compare_type=True, transactional_ddl=True)
        with context.begin_transaction():
            context.run_migrations()
finally:
    engine.dispose()
