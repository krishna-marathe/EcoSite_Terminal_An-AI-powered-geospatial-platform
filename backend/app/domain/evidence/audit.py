from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ...models.evidence import Assertion, EvidenceArtifact
from ...models.phases import ProjectPhase
from ...schemas.evidence import AuditFinding, EvidenceAuditReport


def audit_project_evidence(session: Session, project_id: str, *, comparative_mode: bool = False) -> EvidenceAuditReport:
    """Run deterministic scientific and regulatory audit on a project's evidence graph."""
    now_utc = datetime.now(timezone.utc).isoformat()
    today_str = date.today().isoformat()

    artifacts = session.scalars(
        select(EvidenceArtifact)
        .where(EvidenceArtifact.project_id == project_id)
        .where(EvidenceArtifact.status == "active")
    ).all()

    assertions = session.scalars(
        select(Assertion)
        .where(Assertion.project_id == project_id)
        .where(Assertion.status_record == "active")
        .options(
            selectinload(Assertion.artifact_links).selectinload(Assertion.artifact_links.property.mapper.class_.artifact),
            selectinload(Assertion.reviews),
        )
    ).all()

    phases = session.scalars(
        select(ProjectPhase)
        .where(ProjectPhase.project_id == project_id)
        .where(ProjectPhase.status == "active")
    ).all()

    findings: list[AuditFinding] = []
    blocking_reasons: list[str] = []

    has_synthetic_evidence = False
    has_unreviewed_extractions = False

    # 1. Audit Artifacts
    for artifact in artifacts:
        if artifact.synthetic_demo:
            has_synthetic_evidence = True
            findings.append(
                AuditFinding(
                    severity="warning",
                    code="SYNTHETIC_EVIDENCE",
                    message=f"Artifact '{artifact.filename}' ({artifact.id}) is synthetic demonstration data; it cannot support verified compliance.",
                    entity_type="artifact",
                    entity_id=artifact.id,
                )
            )
        if artifact.valid_until and artifact.valid_until < today_str:
            findings.append(
                AuditFinding(
                    severity="warning",
                    code="ARTIFACT_EXPIRED",
                    message=f"Artifact '{artifact.filename}' ({artifact.id}) expired on {artifact.valid_until}.",
                    entity_type="artifact",
                    entity_id=artifact.id,
                )
            )

    # 2. Audit Assertions
    field_scope_map: dict[tuple[str, str | None, str | None], list[Assertion]] = {}

    for assertion in assertions:
        scope_key = (assertion.field_key, assertion.site_id, assertion.phase_id)
        field_scope_map.setdefault(scope_key, []).append(assertion)

        # Unconfirmed automated extractions
        if assertion.verification_method in ("EXTRACTED_RULE_BASED", "EXTRACTED_MODEL"):
            if not assertion.reviews:
                has_unreviewed_extractions = True
                findings.append(
                    AuditFinding(
                        severity="warning",
                        code="EXTRACTION_UNCONFIRMED",
                        message=f"Assertion '{assertion.field_key}' ({assertion.id}) was extracted by automated parser but has not received human reviewer confirmation.",
                        entity_type="assertion",
                        entity_id=assertion.id,
                    )
                )

        # Self-declarations with zero supporting artifacts
        if assertion.status == "DECLARED" and not assertion.artifact_links:
            findings.append(
                AuditFinding(
                    severity="warning",
                    code="UNSUPPORTED_SELF_DECLARATION",
                    message=f"Assertion '{assertion.field_key}' ({assertion.id}) is a self-declared claim without linked document evidence.",
                    entity_type="assertion",
                    entity_id=assertion.id,
                )
            )

        # Simulated review notice
        if assertion.reviews:
            latest_review = assertion.reviews[-1]
            if latest_review.is_simulated:
                findings.append(
                    AuditFinding(
                        severity="info",
                        code="SIMULATED_REVIEW_ONLY",
                        message=f"Assertion '{assertion.field_key}' ({assertion.id}) was reviewed by a simulated account ({latest_review.reviewer_id}); this does not establish official utility or regulatory verification.",
                        entity_type="assertion",
                        entity_id=assertion.id,
                    )
                )

        # Expiry
        if assertion.effective_to and assertion.effective_to < today_str:
            findings.append(
                AuditFinding(
                    severity="warning",
                    code="ASSERTION_EXPIRED",
                    message=f"Assertion '{assertion.field_key}' ({assertion.id}) expired on {assertion.effective_to}.",
                    entity_type="assertion",
                    entity_id=assertion.id,
                )
            )

    # 3. Check for conflicting un-superseded assertions in the same scope
    for (field_key, site_id, phase_id), group in field_scope_map.items():
        if len(group) > 1:
            # Check if any assertion in group supersedes another
            superseded_ids = {a.supersedes_assertion_id for a in group if a.supersedes_assertion_id}
            active_unsuperseded = [a for a in group if a.id not in superseded_ids]
            if len(active_unsuperseded) > 1:
                # Compare values
                unique_values = {a.value for a in active_unsuperseded}
                if len(unique_values) > 1:
                    conflict_ids = ", ".join(a.id for a in active_unsuperseded)
                    msg = f"Conflicting active assertions for '{field_key}' in site={site_id}, phase={phase_id}: IDs [{conflict_ids}]."
                    blocking_reasons.append(msg)
                    findings.append(
                        AuditFinding(
                            severity="blocker",
                            code="CONFLICTING_ASSERTIONS",
                            message=msg,
                            entity_type="project",
                            entity_id=project_id,
                        )
                    )

    # 4. Critical resource gap audit against active development phases
    if phases:
        power_assertions = [a for a in assertions if a.field_key in ("sanctioned_grid_mw", "grid_power_mw", "contract_demand_mva")]
        water_assertions = [a for a in assertions if a.field_key in ("peak_summer_water_kld", "water_allocation_kld", "average_water_kld")]

        if not power_assertions:
            findings.append(
                AuditFinding(
                    severity="warning",
                    code="RESOURCE_POWER_EVIDENCE_MISSING",
                    message=f"Project has {len(phases)} active development phase(s) but no evidenced power sanction assertion exists.",
                    entity_type="project",
                    entity_id=project_id,
                )
            )
        if not water_assertions:
            findings.append(
                AuditFinding(
                    severity="warning",
                    code="RESOURCE_WATER_EVIDENCE_MISSING",
                    message=f"Project has {len(phases)} active development phase(s) but no evidenced water allocation/study assertion exists.",
                    entity_type="project",
                    entity_id=project_id,
                )
            )

    # 5. Comparative assertion blocking logic (derived from OpenDC-LCA audit.py)
    comparative_blocked = False
    if comparative_mode or blocking_reasons:
        if has_synthetic_evidence:
            msg = "Public comparative assertions cannot rely on synthetic demonstration evidence."
            blocking_reasons.append(msg)
            findings.append(
                AuditFinding(
                    severity="blocker",
                    code="UNSUPPORTED_COMPARATIVE_ASSERTION",
                    message=msg,
                    entity_type="project",
                    entity_id=project_id,
                )
            )
        if has_unreviewed_extractions:
            msg = "Comparative assertions require all automated extractions to be reviewed by a human."
            blocking_reasons.append(msg)
            findings.append(
                AuditFinding(
                    severity="blocker",
                    code="COMPARISON_REQUIRES_HUMAN_REVIEW",
                    message=msg,
                    entity_type="project",
                    entity_id=project_id,
                )
            )

    if any(f.severity == "blocker" for f in findings):
        comparative_blocked = True

    return EvidenceAuditReport(
        project_id=project_id,
        audited_at=now_utc,
        artifact_count=len(artifacts),
        assertion_count=len(assertions),
        has_synthetic_evidence=has_synthetic_evidence,
        has_unreviewed_extractions=has_unreviewed_extractions,
        comparative_assertion_blocked=comparative_blocked,
        blocking_reasons=list(dict.fromkeys(blocking_reasons)),
        findings=findings,
    )
