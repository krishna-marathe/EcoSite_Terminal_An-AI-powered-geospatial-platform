"""Add private operator submission, review, audit and publication linkage."""

from alembic import op
import sqlalchemy as sa


revision = "04c_001"
down_revision = "04b_001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "operator_organisations",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("registration_number", sa.String(100), nullable=True),
        sa.Column("facility_operator_id", sa.String(36), sa.ForeignKey("facility_operators.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'verified', 'suspended')", name="ck_operator_organisations_status"),
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_operator_organisations_name"),
        sa.UniqueConstraint("registration_number"),
    )
    op.create_index("ix_operator_organisations_facility_operator_id", "operator_organisations", ["facility_operator_id"])
    op.create_index("ix_operator_organisations_status", "operator_organisations", ["status"])

    op.create_table(
        "facility_submissions",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("operator_organisation_id", sa.String(100), sa.ForeignKey("operator_organisations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("current_revision", sa.Integer(), nullable=False),
        sa.Column("assigned_reviewer_id", sa.String(100), nullable=True),
        sa.Column("submitted_at", sa.String(32), nullable=True),
        sa.Column("decided_at", sa.String(32), nullable=True),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint(
            "status IN ('draft', 'submitted', 'under_review', 'information_requested', 'resubmitted', 'approved', 'rejected', 'withdrawn')",
            name="ck_facility_submissions_status",
        ),
        sa.CheckConstraint("current_revision >= 1", name="ck_facility_submissions_revision"),
    )
    op.create_index("ix_facility_submissions_operator_organisation_id", "facility_submissions", ["operator_organisation_id"])
    op.create_index("ix_facility_submissions_status", "facility_submissions", ["status"])
    op.create_index("ix_facility_submissions_assigned_reviewer_id", "facility_submissions", ["assigned_reviewer_id"])
    op.create_index("ix_facility_submissions_queue", "facility_submissions", ["status", "submitted_at"])

    op.create_table(
        "facility_submission_revisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("submission_id", sa.String(100), sa.ForeignKey("facility_submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("facility_name", sa.String(200), nullable=False),
        sa.Column("facility_type", sa.String(20), nullable=False),
        sa.Column("ownership_category", sa.String(20), nullable=False),
        sa.Column("state_code", sa.String(5), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("locality", sa.String(200), nullable=False),
        sa.Column("operational_since", sa.Integer(), nullable=True),
        sa.Column("capacity_disclosures", sa.JSON(), nullable=False),
        sa.Column("actor_id", sa.String(100), nullable=False),
        sa.Column("actor_role", sa.String(24), nullable=False),
        sa.Column("change_reason", sa.String(500), nullable=True),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_facility_submission_revisions_number"),
        sa.CheckConstraint("facility_type IN ('colocation', 'hyperscale', 'enterprise', 'edge', 'government', 'other')", name="ck_facility_submission_revisions_type"),
        sa.CheckConstraint("ownership_category IN ('private', 'government', 'ppp', 'other', 'unknown')", name="ck_facility_submission_revisions_ownership"),
        sa.CheckConstraint("state_code IN ('IN-MH', 'IN-TG', 'IN-KA', 'IN-TN')", name="ck_facility_submission_revisions_state"),
        sa.CheckConstraint("actor_role IN ('operator', 'ministry_reviewer', 'system')", name="ck_facility_submission_revisions_actor"),
        sa.UniqueConstraint("submission_id", "revision", name="uq_facility_submission_revisions_number"),
    )
    op.create_index("ix_facility_submission_revisions_submission_id", "facility_submission_revisions", ["submission_id"])

    op.create_table(
        "submission_exact_geometries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("revision_id", sa.String(36), sa.ForeignKey("facility_submission_revisions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("geometry_type", sa.String(20), nullable=False),
        sa.Column("geometry_json", sa.JSON(), nullable=False),
        sa.Column("geometry_sha256", sa.String(64), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("geometry_type IN ('Point', 'Polygon', 'MultiPolygon')", name="ck_submission_exact_geometries_type"),
        sa.CheckConstraint("visibility = 'OPERATOR_PRIVATE'", name="ck_submission_exact_geometries_visibility"),
        sa.CheckConstraint("length(geometry_sha256) = 64", name="ck_submission_exact_geometries_hash"),
        sa.UniqueConstraint("revision_id", name="uq_submission_exact_geometries_revision"),
    )
    op.create_index("ix_submission_exact_geometries_revision_id", "submission_exact_geometries", ["revision_id"])

    op.create_table(
        "submission_evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("revision_id", sa.String(36), sa.ForeignKey("facility_submission_revisions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("evidence_type", sa.String(100), nullable=False),
        sa.Column("storage_path", sa.String(1000), nullable=True),
        sa.Column("external_url", sa.String(1000), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("issuer", sa.String(200), nullable=True),
        sa.Column("issued_at", sa.String(32), nullable=True),
        sa.Column("evidence_class", sa.String(30), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("evidence_class IN ('DECLARED', 'DOCUMENTED', 'AUTHORITY_VERIFIED')", name="ck_submission_evidence_class"),
        sa.CheckConstraint("visibility IN ('OPERATOR_PRIVATE', 'MINISTRY', 'REGULATOR_RESTRICTED')", name="ck_submission_evidence_visibility"),
        sa.CheckConstraint("storage_path IS NOT NULL OR external_url IS NOT NULL", name="ck_submission_evidence_location"),
        sa.CheckConstraint("file_size_bytes IS NULL OR file_size_bytes >= 0", name="ck_submission_evidence_size"),
        sa.CheckConstraint("sha256 IS NULL OR length(sha256) = 64", name="ck_submission_evidence_hash"),
    )
    op.create_index("ix_submission_evidence_revision_id", "submission_evidence", ["revision_id"])

    op.create_table(
        "review_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("submission_id", sa.String(100), sa.ForeignKey("facility_submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision_id", sa.String(36), sa.ForeignKey("facility_submission_revisions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("actor_id", sa.String(100), nullable=False),
        sa.Column("actor_role", sa.String(24), nullable=False),
        sa.Column("from_status", sa.String(24), nullable=False),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("reason", sa.String(2000), nullable=True),
        sa.Column("requested_fields", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("action IN ('assign', 'start_review', 'request_information', 'resubmit', 'approve', 'reject', 'withdraw', 'comment')", name="ck_review_events_action"),
        sa.CheckConstraint("actor_role IN ('operator', 'ministry_reviewer', 'system')", name="ck_review_events_actor"),
    )
    op.create_index("ix_review_events_submission_id", "review_events", ["submission_id"])
    op.create_index("ix_review_events_revision_id", "review_events", ["revision_id"])
    op.create_index("ix_review_events_submission_time", "review_events", ["submission_id", "created_at"])

    op.create_table(
        "publication_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("submission_id", sa.String(100), sa.ForeignKey("facility_submissions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("revision_id", sa.String(36), sa.ForeignKey("facility_submission_revisions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("review_event_id", sa.String(36), sa.ForeignKey("review_events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("public_facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("public_snapshot_id", sa.String(36), sa.ForeignKey("public_facility_snapshots.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("publication_version", sa.Integer(), nullable=False),
        sa.Column("payload_sha256", sa.String(64), nullable=False),
        sa.Column("published_by", sa.String(100), nullable=False),
        sa.Column("published_at", sa.String(32), nullable=False),
        sa.CheckConstraint("publication_version >= 1", name="ck_publication_snapshots_version"),
        sa.UniqueConstraint("submission_id", "publication_version", name="uq_publication_snapshots_version"),
        sa.UniqueConstraint("public_snapshot_id", name="uq_publication_snapshots_public_snapshot"),
        sa.UniqueConstraint("review_event_id"),
    )
    op.create_index("ix_publication_snapshots_submission_id", "publication_snapshots", ["submission_id"])
    op.create_index("ix_publication_snapshots_revision_id", "publication_snapshots", ["revision_id"])
    op.create_index("ix_publication_snapshots_public_facility_id", "publication_snapshots", ["public_facility_id"])
    op.create_index("ix_publication_snapshots_public_snapshot_id", "publication_snapshots", ["public_snapshot_id"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("submission_id", sa.String(100), sa.ForeignKey("facility_submissions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_id", sa.String(100), nullable=False),
        sa.Column("actor_role", sa.String(24), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("request_id", sa.String(100), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.String(32), nullable=False),
        sa.CheckConstraint("actor_role IN ('operator', 'ministry_reviewer', 'system')", name="ck_audit_events_actor"),
    )
    op.create_index("ix_audit_events_submission_id", "audit_events", ["submission_id"])
    op.create_index("ix_audit_events_entity_time", "audit_events", ["entity_type", "entity_id", "occurred_at"])

    # Submission headers are mutable only through the reviewed state machine.
    op.execute("""CREATE TRIGGER trg_facility_submissions_revision_step
        BEFORE UPDATE OF current_revision ON facility_submissions
        WHEN NEW.current_revision != OLD.current_revision + 1
        BEGIN SELECT RAISE(ABORT, 'submission revision must increment by one'); END""")
    op.execute("""CREATE TRIGGER trg_facility_submissions_revision_exists
        BEFORE UPDATE OF current_revision ON facility_submissions
        WHEN NOT EXISTS (
            SELECT 1 FROM facility_submission_revisions r
            WHERE r.submission_id = OLD.id AND r.revision = NEW.current_revision
        )
        BEGIN SELECT RAISE(ABORT, 'submission revision row must exist before header update'); END""")
    op.execute("""CREATE TRIGGER trg_facility_submissions_status_revision
        BEFORE UPDATE OF status ON facility_submissions
        WHEN NEW.status != OLD.status AND NEW.current_revision != OLD.current_revision + 1
        BEGIN SELECT RAISE(ABORT, 'status transition requires a new immutable revision'); END""")
    op.execute("""CREATE TRIGGER trg_facility_submissions_status_transition
        BEFORE UPDATE OF status ON facility_submissions
        WHEN NEW.status != OLD.status AND NOT (
            (OLD.status = 'draft' AND NEW.status IN ('submitted', 'withdrawn')) OR
            (OLD.status IN ('submitted', 'resubmitted', 'under_review') AND NEW.status IN ('under_review', 'information_requested', 'approved', 'rejected', 'withdrawn')) OR
            (OLD.status = 'information_requested' AND NEW.status IN ('resubmitted', 'withdrawn'))
        )
        BEGIN SELECT RAISE(ABORT, 'invalid submission status transition'); END""")

    # Append-only records: corrections create a new revision/event, never rewrite history.
    for table in (
        "facility_submission_revisions", "submission_exact_geometries", "submission_evidence",
        "review_events", "publication_snapshots", "audit_events",
    ):
        op.execute(f"""CREATE TRIGGER trg_{table}_immutable_update
            BEFORE UPDATE ON {table}
            BEGIN SELECT RAISE(ABORT, '{table} is immutable'); END""")
        op.execute(f"""CREATE TRIGGER trg_{table}_immutable_delete
            BEFORE DELETE ON {table}
            BEGIN SELECT RAISE(ABORT, '{table} is immutable'); END""")

    # Publication is valid only when all private/public records agree in one transaction.
    op.execute("""CREATE TRIGGER trg_publication_snapshots_approval_link
        BEFORE INSERT ON publication_snapshots
        WHEN NOT EXISTS (
            SELECT 1
            FROM facility_submissions s
            JOIN facility_submission_revisions r
              ON r.id = NEW.revision_id AND r.submission_id = s.id
            JOIN review_events e
              ON e.id = NEW.review_event_id
             AND e.submission_id = s.id
             AND e.revision_id = r.id
             AND e.action = 'approve'
             AND e.to_status = 'approved'
            JOIN public_facility_snapshots p
              ON p.id = NEW.public_snapshot_id
             AND p.facility_id = NEW.public_facility_id
             AND p.approval_basis = 'ministry_review'
             AND p.payload_sha256 = NEW.payload_sha256
            WHERE s.id = NEW.submission_id
              AND s.status = 'approved'
              AND s.current_revision = r.revision
        )
        BEGIN SELECT RAISE(ABORT, 'publication requires matching approved submission, review and public snapshot'); END""")


def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")

