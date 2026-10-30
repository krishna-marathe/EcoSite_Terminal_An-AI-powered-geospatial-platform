from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.models.commitments import PowerCommitment, WaterCommitment
from backend.app.models.evidence import Assertion, AssertionEvidenceLink, EvidenceArtifact
from backend.app.models.phases import ProjectPhase
from backend.app.models.projects import Project
from backend.app.schemas.commitments import (
    CampusReadinessSummary,
    PhasePowerReadiness,
    PhaseReadinessFinding,
    PhaseReadinessSummary,
    PhaseWaterReadiness,
    ProjectReadinessReport,
    ReadinessStatus,
)


def _parse_date(d_str: Optional[str]) -> Optional[date]:
    if not d_str:
        return None
    try:
        return datetime.fromisoformat(d_str.replace("Z", "+00:00")).date()
    except (ValueError, TypeError):
        try:
            return datetime.strptime(d_str[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None


def is_commitment_expired(commitment_expiry: Optional[str], reference_date: Optional[date]) -> bool:
    if not commitment_expiry or not reference_date:
        return False
    exp = _parse_date(commitment_expiry)
    if exp is None:
        return False
    return exp < reference_date


def is_commitment_not_yet_effective(commitment_effective: Optional[str], reference_date: Optional[date]) -> bool:
    if not commitment_effective or not reference_date:
        return False
    eff = _parse_date(commitment_effective)
    if eff is None:
        return False
    return eff > reference_date


def _get_power_entitlement_key(
    pc: PowerCommitment,
    artifacts_by_id: Optional[Dict[str, EvidenceArtifact]] = None,
) -> str:
    """Derive stable entitlement key to prevent double-counting overlapping commitments.

    Two independent sanctions from the same provider and substation are NOT
    treated as duplicates solely because provider/substation strings match.
    Deduplication applies when commitments share an underlying assertion, artifact,
    or documented unique sanction/order reference in notes.
    """
    if pc.assertion_id:
        return f"assertion:{pc.assertion_id}"
    if pc.evidence_artifact_id:
        if artifacts_by_id and pc.evidence_artifact_id in artifacts_by_id:
            art = artifacts_by_id[pc.evidence_artifact_id]
            if art.reference:
                return f"sanction_ref:{art.reference.strip().lower()}"
        return f"artifact:{pc.evidence_artifact_id}"
    if pc.notes:
        m = re.search(r'(?:sanction|order|entitlement|ref|reference)[:\s#]+([A-Za-z0-9_\-\/]+)', pc.notes, re.IGNORECASE)
        if m:
            return f"sanction_ref:{m.group(1).lower()}"
    if pc.substation_name:
        sub_norm = pc.substation_name.strip().lower()
        prov_norm = (pc.utility_provider or "").strip().lower()
        volt_norm = f"{pc.voltage_kv}" if pc.voltage_kv is not None else ""
        return f"grid_conn:{prov_norm}:{sub_norm}:{volt_norm}"
    return f"commitment:{pc.id}"


def _get_water_entitlement_key(
    wc: WaterCommitment,
    artifacts_by_id: Optional[Dict[str, EvidenceArtifact]] = None,
) -> str:
    """Derive stable entitlement key to prevent double-counting overlapping water allocations."""
    if wc.assertion_id:
        return f"assertion:{wc.assertion_id}"
    if wc.evidence_artifact_id:
        if artifacts_by_id and wc.evidence_artifact_id in artifacts_by_id:
            art = artifacts_by_id[wc.evidence_artifact_id]
            if art.reference:
                return f"alloc_ref:{art.reference.strip().lower()}"
        return f"artifact:{wc.evidence_artifact_id}"
    if wc.allocation_reference:
        ref_norm = wc.allocation_reference.strip().lower()
        if wc.authority_issuer:
            return f"alloc:{wc.authority_issuer.strip().lower()}:{ref_norm}"
        return f"alloc:{ref_norm}"
    if wc.notes:
        m = re.search(r'(?:allocation|order|permit|noc|ref|reference)[:\s#]+([A-Za-z0-9_\-\/]+)', wc.notes, re.IGNORECASE)
        if m:
            return f"alloc_ref:{m.group(1).lower()}"
    return f"commitment:{wc.id}"


def _verify_power_evidence_trust(
    pc: PowerCommitment,
    assertions_by_id: Dict[str, Assertion],
    artifacts_by_id: Dict[str, EvidenceArtifact],
    reference_date: Optional[date] = None,
) -> Tuple[bool, bool, bool, bool, bool, bool]:
    """Inspect underlying DB assertion and artifact state.

    Returns:
        (is_independently_verified, is_documented, is_simulated, is_synthetic, is_conflicting, is_expired)
    """
    is_synthetic = bool(pc.is_synthetic)
    is_simulated = False
    is_independently_verified = False
    is_documented = False
    is_conflicting = False
    is_expired = False

    artifact = artifacts_by_id.get(pc.evidence_artifact_id) if pc.evidence_artifact_id else None
    if artifact:
        if artifact.synthetic_demo:
            is_synthetic = True
        if is_commitment_expired(artifact.valid_until, reference_date):
            is_expired = True

    assertion = assertions_by_id.get(pc.assertion_id) if pc.assertion_id else None
    if assertion:
        for link in assertion.artifact_links:
            if link.artifact and link.artifact.synthetic_demo:
                is_synthetic = True

        if assertion.status == "CONFLICTING":
            is_conflicting = True
        elif assertion.status in ("EXPIRED", "SUPERSEDED") or is_commitment_expired(assertion.effective_to, reference_date):
            is_expired = True
        elif assertion.status == "VERIFIED_WITHIN_SCOPE":
            has_independent_approval = False
            for r in assertion.reviews:
                if r.is_simulated or r.review_status == "SIMULATED_VERIFICATION":
                    is_simulated = True
                elif r.review_status == "APPROVED" and not r.is_simulated:
                    has_independent_approval = True

            if assertion.verification_method == "SIMULATED_REVIEW" or is_simulated or is_synthetic:
                is_simulated = True
                is_documented = True
            elif has_independent_approval and assertion.verification_method == "INDEPENDENT_REVIEW":
                is_independently_verified = True
            else:
                is_documented = True
        elif assertion.status == "DOCUMENTED":
            is_documented = True
    elif artifact and not is_expired:
        is_documented = True
    elif pc.verification_state == "DOCUMENTED":
        is_documented = True

    if pc.verification_state == "SIMULATED":
        is_simulated = True

    return is_independently_verified, is_documented, is_simulated, is_synthetic, is_conflicting, is_expired


def _verify_water_evidence_trust(
    wc: WaterCommitment,
    assertions_by_id: Dict[str, Assertion],
    artifacts_by_id: Dict[str, EvidenceArtifact],
    reference_date: Optional[date] = None,
) -> Tuple[bool, bool, bool, bool, bool, bool]:
    """Inspect underlying DB water assertion and artifact state.

    Returns:
        (is_independently_verified, is_documented, is_simulated, is_synthetic, is_conflicting, is_expired)
    """
    is_synthetic = bool(wc.is_synthetic)
    is_simulated = False
    is_independently_verified = False
    is_documented = False
    is_conflicting = False
    is_expired = False

    artifact = artifacts_by_id.get(wc.evidence_artifact_id) if wc.evidence_artifact_id else None
    if artifact:
        if artifact.synthetic_demo:
            is_synthetic = True
        if is_commitment_expired(artifact.valid_until, reference_date):
            is_expired = True

    assertion = assertions_by_id.get(wc.assertion_id) if wc.assertion_id else None
    if assertion:
        for link in assertion.artifact_links:
            if link.artifact and link.artifact.synthetic_demo:
                is_synthetic = True

        if assertion.status == "CONFLICTING":
            is_conflicting = True
        elif assertion.status in ("EXPIRED", "SUPERSEDED") or is_commitment_expired(assertion.effective_to, reference_date):
            is_expired = True
        elif assertion.status == "VERIFIED_WITHIN_SCOPE":
            has_independent_approval = False
            for r in assertion.reviews:
                if r.is_simulated or r.review_status == "SIMULATED_VERIFICATION":
                    is_simulated = True
                elif r.review_status == "APPROVED" and not r.is_simulated:
                    has_independent_approval = True

            if assertion.verification_method == "SIMULATED_REVIEW" or is_simulated or is_synthetic:
                is_simulated = True
                is_documented = True
            elif has_independent_approval and assertion.verification_method == "INDEPENDENT_REVIEW":
                is_independently_verified = True
            else:
                is_documented = True
        elif assertion.status == "DOCUMENTED":
            is_documented = True
    elif artifact and not is_expired:
        is_documented = True
    elif wc.verification_state == "DOCUMENTED":
        is_documented = True

    if wc.verification_state == "SIMULATED":
        is_simulated = True

    return is_independently_verified, is_documented, is_simulated, is_synthetic, is_conflicting, is_expired


def evaluate_phase_power(
    phase: ProjectPhase,
    previous_phase: Optional[ProjectPhase],
    active_power_commitments: List[PowerCommitment],
    has_project_power_inventory: bool,
    assertions_by_id: Dict[str, Assertion],
    artifacts_by_id: Dict[str, EvidenceArtifact],
) -> Tuple[PhasePowerReadiness, List[PhaseReadinessFinding]]:
    """Calculate deterministic power readiness for a single phase with evidence trust barriers."""
    findings: List[PhaseReadinessFinding] = []
    phase_ref_date = phase.commissioning_date if isinstance(phase.commissioning_date, date) else _parse_date(str(phase.commissioning_date))

    demand_mw = float(phase.cumulative_facility_peak_mw) if phase.cumulative_facility_peak_mw is not None else None
    if previous_phase is not None and demand_mw is not None:
        prev_demand = float(previous_phase.cumulative_facility_peak_mw) if previous_phase.cumulative_facility_peak_mw is not None else 0.0
        incremental_demand_mw = max(0.0, demand_mw - prev_demand)
    else:
        incremental_demand_mw = demand_mw

    # If no commitment inventory has been assessed at all for the project:
    if not has_project_power_inventory:
        findings.append(
            PhaseReadinessFinding(
                code="COMMITMENT_INVENTORY_NOT_ASSESSED",
                domain="POWER",
                severity="CRITICAL",
                message="No power commitments have been registered for this project. Capacity is UNKNOWN; missing records do not prove a physical grid deficit.",
            )
        )
        readiness = PhasePowerReadiness(
            phase_sequence=phase.sequence,
            demand_mw=demand_mw,
            incremental_demand_mw=round(incremental_demand_mw, 4) if incremental_demand_mw is not None else None,
            verified_capacity_mw=0.0,
            documented_capacity_mw=0.0,
            qualifying_firm_capacity_mw=0.0,
            proposed_capacity_mw=0.0,
            unverified_capacity_mw=0.0,
            power_gap_mw=None,
            power_surplus_mw=0.0,
            status="UNKNOWN",
            qualifying_commitments_count=0,
            total_commitments_count=0,
        )
        return readiness, findings

    proposed_mw = 0.0
    unverified_mw = 0.0
    total_count = 0
    seen_evidence_ids: Set[str] = set()

    # Entitlement grouping to prevent double counting
    # entitlement_key -> {"SANCTIONED": max_val, "ENERGIZED": max_val, "is_verified": bool, "is_documented": bool}
    firm_entitlements: Dict[str, Dict[str, Any]] = {}

    seen_commitment_ids: Set[str] = set()

    for pc in active_power_commitments:
        if pc.id in seen_commitment_ids:
            continue
        seen_commitment_ids.add(pc.id)

        # Priority 4: Strict scope checking
        if pc.scope_type == "PHASE":
            if pc.phase_id is None:
                findings.append(
                    PhaseReadinessFinding(
                        code="NULL_PHASE_SCOPE_EXCLUDED",
                        domain="POWER",
                        severity="WARNING",
                        message=f"Power commitment '{pc.id}' has scope_type 'PHASE' but phase_id is null; excluded from phase readiness.",
                    )
                )
                continue
            if pc.phase_id != phase.id:
                # Scoped to a different phase (Phase 1 sanction does not satisfy Phase 2)
                continue
        elif pc.scope_type == "CAMPUS":
            if pc.phase_id is not None:
                findings.append(
                    PhaseReadinessFinding(
                        code="AMBIGUOUS_SCOPE_EXCLUDED",
                        domain="POWER",
                        severity="WARNING",
                        message=f"Power commitment '{pc.id}' has scope_type 'CAMPUS' with phase_id set; ambiguous scope excluded.",
                    )
                )
                continue
            # Campus-wide commitment applies across phases
        else:
            # e.g. SITE without phase binding, or ambiguous
            findings.append(
                PhaseReadinessFinding(
                    code="AMBIGUOUS_SCOPE_EXCLUDED",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Power commitment '{pc.id}' has scope_type '{pc.scope_type}' without explicit phase binding; excluded from phase readiness.",
                )
            )
            continue

        total_count += 1
        cap = float(pc.capacity_mw)

        # Detect duplicate evidence references
        if pc.evidence_artifact_id:
            if pc.evidence_artifact_id in seen_evidence_ids:
                findings.append(
                    PhaseReadinessFinding(
                        code="DUPLICATE_EVIDENCE_REFERENCE",
                        domain="POWER",
                        severity="WARNING",
                        message=f"Power commitment '{pc.id}' references evidence '{pc.evidence_artifact_id}' already applied in another commitment.",
                    )
                )
            seen_evidence_ids.add(pc.evidence_artifact_id)

        # Substation proximity without firm sanction warning
        if pc.substation_name and pc.status not in ("SANCTIONED", "ENERGIZED"):
            findings.append(
                PhaseReadinessFinding(
                    code="SUBSTATION_PROXIMITY_NOT_SPARE_CAPACITY",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Nearby substation '{pc.substation_name}' recorded for commitment '{pc.id}' does not establish available grid MW.",
                )
            )

        # Priority 4: Effective date check (not yet effective at commissioning date)
        if is_commitment_not_yet_effective(pc.effective_date, phase_ref_date):
            findings.append(
                PhaseReadinessFinding(
                    code="COMMITMENT_NOT_YET_EFFECTIVE",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Power commitment '{pc.id}' ({cap} MW) becomes effective on {pc.effective_date}, after phase commissioning date {phase_ref_date}.",
                )
            )
            continue

        # Priority 1: Evidence trust evaluation against database records
        is_verified, is_doc, is_sim, is_synth, is_conflict, is_exp = _verify_power_evidence_trust(
            pc, assertions_by_id, artifacts_by_id, phase_ref_date
        )

        if is_conflict:
            findings.append(
                PhaseReadinessFinding(
                    code="CONFLICTING_EVIDENCE_EXCLUDED",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Power commitment '{pc.id}' ({cap} MW) references conflicting evidence in database; excluded from firm capacity.",
                )
            )
            unverified_mw += cap
            continue

        # Priority 4: Expired commitment check
        if pc.status == "EXPIRED" or is_exp or is_commitment_expired(pc.expiry_date, phase_ref_date):
            findings.append(
                PhaseReadinessFinding(
                    code="EXPIRED_POWER_COMMITMENT",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Power commitment '{pc.id}' ({cap} MW) expired or expires before commissioning date {phase_ref_date}.",
                )
            )
            continue

        if is_synth:
            findings.append(
                PhaseReadinessFinding(
                    code="SYNTHETIC_COMMITMENT_EXCLUDED",
                    domain="POWER",
                    severity="INFO",
                    message=f"Synthetic demo power commitment '{pc.id}' ({cap} MW) is excluded from firm capacity.",
                )
            )
            continue

        if is_sim:
            findings.append(
                PhaseReadinessFinding(
                    code="SIMULATED_REVIEW_EXCLUDED",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Power commitment '{pc.id}' ({cap} MW) is backed by simulated review only; excluded from independently verified capacity.",
                )
            )

        # Distinguish proposed / requested power vs firm sanction
        if pc.status in ("PROPOSED", "REQUESTED", "GRID_ALLOCATION_PROPOSED", "UNKNOWN"):
            proposed_mw += cap
            findings.append(
                PhaseReadinessFinding(
                    code="PROPOSED_POWER_EXCLUDED",
                    domain="POWER",
                    severity="INFO",
                    message=f"Proposed/requested power '{pc.id}' ({cap} MW, status: {pc.status}) excluded from firm qualifying capacity.",
                )
            )
            continue

        # Distinguish unverified commitments
        if not is_verified and not is_doc:
            unverified_mw += cap
            findings.append(
                PhaseReadinessFinding(
                    code="UNVERIFIED_EVIDENCE_EXCLUDED",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Power commitment '{pc.id}' ({cap} MW) lacks verified or documented evidence and is excluded from firm capacity.",
                )
            )
            continue

        # Firm candidate (SANCTIONED or ENERGIZED)
        if pc.status in ("SANCTIONED", "ENERGIZED"):
            ent_key = _get_power_entitlement_key(pc, artifacts_by_id)
            if ent_key not in firm_entitlements:
                firm_entitlements[ent_key] = {
                    "SANCTIONED": 0.0,
                    "ENERGIZED": 0.0,
                    "is_verified": False,
                    "is_documented": False,
                    "commitments": [],
                }
            entry = firm_entitlements[ent_key]
            entry["commitments"].append(pc.id)
            if is_verified:
                entry["is_verified"] = True
            if is_doc:
                entry["is_documented"] = True

            if pc.status == "SANCTIONED":
                if entry["SANCTIONED"] > 0:
                    findings.append(
                        PhaseReadinessFinding(
                            code="DUPLICATE_ENTITLEMENT_DEDUPLICATED",
                            domain="POWER",
                            severity="WARNING",
                            message=f"Multiple sanctioned commitments share entitlement '{ent_key}'; deduplicated to prevent double counting.",
                        )
                    )
                entry["SANCTIONED"] = max(entry["SANCTIONED"], cap)
            elif pc.status == "ENERGIZED":
                if entry["ENERGIZED"] > 0:
                    findings.append(
                        PhaseReadinessFinding(
                            code="DUPLICATE_ENTITLEMENT_DEDUPLICATED",
                            domain="POWER",
                            severity="WARNING",
                            message=f"Multiple energized commitments share entitlement '{ent_key}'; deduplicated to prevent double counting.",
                        )
                    )
                entry["ENERGIZED"] = max(entry["ENERGIZED"], cap)

    # Priority 2: Process deduplicated entitlements (SANCTIONED vs ENERGIZED)
    verified_firm_mw = 0.0
    documented_firm_mw = 0.0
    qualifying_count = 0

    for ent_key, entry in firm_entitlements.items():
        sanc = entry["SANCTIONED"]
        energ = entry["ENERGIZED"]

        if sanc > 0 and energ > 0:
            # Overlapping entitlement: do not sum!
            ent_cap = max(sanc, energ)
            findings.append(
                PhaseReadinessFinding(
                    code="SANCTIONED_ENERGIZED_OVERLAP_DEDUPLICATED",
                    domain="POWER",
                    severity="WARNING",
                    message=f"Sanctioned ({sanc} MW) and Energized ({energ} MW) share entitlement '{ent_key}'; capped at {ent_cap} MW to prevent double counting.",
                )
            )
        else:
            ent_cap = sanc if sanc > 0 else energ

        if ent_cap > 0:
            if entry["is_verified"]:
                verified_firm_mw += ent_cap
                qualifying_count += 1
            else:
                documented_firm_mw += ent_cap

    # Round all values
    verified_firm_mw = round(verified_firm_mw, 4)
    documented_firm_mw = round(documented_firm_mw, 4)
    qualifying_firm_mw = round(verified_firm_mw + documented_firm_mw, 4)
    proposed_mw = round(proposed_mw, 4)
    unverified_mw = round(unverified_mw, 4)

    # Priority 1: Documented vs Verified finding
    if documented_firm_mw > 0 and verified_firm_mw < (demand_mw or 0.0):
        findings.append(
            PhaseReadinessFinding(
                code="DOCUMENTED_NOT_INDEPENDENTLY_VERIFIED",
                domain="POWER",
                severity="WARNING",
                message=f"Phase {phase.sequence} has {documented_firm_mw} MW supported by document artifacts/extractions (DOCUMENTED) that lack independent third-party verification; verified deliverable capacity is {verified_firm_mw} MW.",
            )
        )

    # Priority 3: Gap and Status calculation
    if demand_mw is None or demand_mw <= 0:
        power_gap_mw = None
        power_surplus_mw = 0.0
        status: ReadinessStatus = "INSUFFICIENT_DATA"
        findings.append(
            PhaseReadinessFinding(
                code="INSUFFICIENT_DATA",
                domain="POWER",
                severity="CRITICAL",
                message=f"Phase {phase.sequence} power demand is unknown or non-positive; gap cannot be calculated.",
            )
        )
    else:
        if qualifying_firm_mw >= demand_mw:
            power_gap_mw = 0.0
            power_surplus_mw = round(qualifying_firm_mw - demand_mw, 4)
            status = "MET"
        elif qualifying_firm_mw > 0:
            power_gap_mw = round(demand_mw - qualifying_firm_mw, 4)
            power_surplus_mw = 0.0
            status = "PARTIAL"
            findings.append(
                PhaseReadinessFinding(
                    code="POWER_DEFICIT",
                    domain="POWER",
                    severity="CRITICAL",
                    message=f"Phase {phase.sequence} has an evidence-backed capacity gap of {power_gap_mw} MW (qualifying firm: {qualifying_firm_mw} MW vs demand: {demand_mw} MW). Reflects uncommitted documented balance, not confirmed physical grid deficit.",
                )
            )
        else:
            power_gap_mw = round(demand_mw, 4)
            power_surplus_mw = 0.0
            status = "UNCOMMITTED"
            findings.append(
                PhaseReadinessFinding(
                    code="POWER_UNCOMMITTED",
                    domain="POWER",
                    severity="CRITICAL",
                    message=f"Phase {phase.sequence} has 0 qualifying firm MW committed for {demand_mw} MW peak demand. Evidence-backed capacity gap of {demand_mw} MW.",
                )
            )

    readiness = PhasePowerReadiness(
        phase_sequence=phase.sequence,
        demand_mw=demand_mw,
        incremental_demand_mw=round(incremental_demand_mw, 4) if incremental_demand_mw is not None else None,
        verified_capacity_mw=verified_firm_mw,
        documented_capacity_mw=documented_firm_mw,
        qualifying_firm_capacity_mw=qualifying_firm_mw,
        proposed_capacity_mw=proposed_mw,
        unverified_capacity_mw=unverified_mw,
        power_gap_mw=power_gap_mw,
        power_surplus_mw=power_surplus_mw,
        status=status,
        qualifying_commitments_count=qualifying_count,
        total_commitments_count=total_count,
    )
    return readiness, findings


def evaluate_phase_water(
    phase: ProjectPhase,
    active_water_commitments: List[WaterCommitment],
    has_project_water_inventory: bool,
    assertions_by_id: Dict[str, Assertion],
    artifacts_by_id: Dict[str, EvidenceArtifact],
) -> Tuple[PhaseWaterReadiness, List[PhaseReadinessFinding]]:
    """Calculate deterministic water readiness for a single phase with gross demand semantics."""
    findings: List[PhaseReadinessFinding] = []
    phase_ref_date = phase.commissioning_date if isinstance(phase.commissioning_date, date) else _parse_date(str(phase.commissioning_date))

    peak_summer_demand_kld = float(phase.peak_summer_water_kld) if phase.peak_summer_water_kld is not None else None
    avg_demand_kld = float(phase.average_water_kld) if phase.average_water_kld is not None else None

    # Priority 5: Explicitly document gross-demand-only calculation and unassessed reuse
    findings.append(
        PhaseReadinessFinding(
            code="GROSS_DEMAND_ONLY_REUSE_UNASSESSED",
            domain="WATER",
            severity="INFO",
            message=f"Phase {phase.sequence} water readiness evaluates gross peak-summer demand ({peak_summer_demand_kld if peak_summer_demand_kld is not None else 'unspecified'} KLD); internal recycling is not deducted without certified water balance.",
        )
    )

    if not has_project_water_inventory:
        findings.append(
            PhaseReadinessFinding(
                code="COMMITMENT_INVENTORY_NOT_ASSESSED",
                domain="WATER",
                severity="CRITICAL",
                message="No water commitments have been registered for this project. Capacity is UNKNOWN; missing records do not prove a physical water deficit.",
            )
        )
        readiness = PhaseWaterReadiness(
            phase_sequence=phase.sequence,
            peak_summer_demand_kld=peak_summer_demand_kld,
            average_demand_kld=avg_demand_kld,
            verified_allocated_kld=0.0,
            documented_allocated_kld=0.0,
            qualifying_firm_allocated_kld=0.0,
            proposed_kld=0.0,
            unverified_kld=0.0,
            water_gap_kld=None,
            water_surplus_kld=0.0,
            status="UNKNOWN",
            qualifying_commitments_count=0,
            total_commitments_count=0,
        )
        return readiness, findings

    proposed_kld = 0.0
    unverified_kld = 0.0
    total_count = 0
    seen_evidence_ids: Set[str] = set()

    # Entitlement grouping to prevent double counting
    firm_entitlements: Dict[str, Dict[str, Any]] = {}

    seen_commitment_ids: Set[str] = set()

    for wc in active_water_commitments:
        if wc.id in seen_commitment_ids:
            continue
        seen_commitment_ids.add(wc.id)

        # Priority 4: Strict scope checking
        if wc.scope_type == "PHASE":
            if wc.phase_id is None:
                findings.append(
                    PhaseReadinessFinding(
                        code="NULL_PHASE_SCOPE_EXCLUDED",
                        domain="WATER",
                        severity="WARNING",
                        message=f"Water commitment '{wc.id}' has scope_type 'PHASE' but phase_id is null; excluded from phase readiness.",
                    )
                )
                continue
            if wc.phase_id != phase.id:
                continue
        elif wc.scope_type == "CAMPUS":
            if wc.phase_id is not None:
                findings.append(
                    PhaseReadinessFinding(
                        code="AMBIGUOUS_SCOPE_EXCLUDED",
                        domain="WATER",
                        severity="WARNING",
                        message=f"Water commitment '{wc.id}' has scope_type 'CAMPUS' with phase_id set; ambiguous scope excluded.",
                    )
                )
                continue
        else:
            findings.append(
                PhaseReadinessFinding(
                    code="AMBIGUOUS_SCOPE_EXCLUDED",
                    domain="WATER",
                    severity="WARNING",
                    message=f"Water commitment '{wc.id}' has scope_type '{wc.scope_type}' without explicit phase binding; excluded from phase readiness.",
                )
            )
            continue

        total_count += 1
        qty = float(wc.allocated_kld)

        if wc.evidence_artifact_id:
            if wc.evidence_artifact_id in seen_evidence_ids:
                findings.append(
                    PhaseReadinessFinding(
                        code="DUPLICATE_EVIDENCE_REFERENCE",
                        domain="WATER",
                        severity="WARNING",
                        message=f"Water commitment '{wc.id}' references evidence '{wc.evidence_artifact_id}' already applied in another commitment.",
                    )
                )
            seen_evidence_ids.add(wc.evidence_artifact_id)

        # Priority 4: Effective and expiry date checks
        if is_commitment_not_yet_effective(wc.effective_date, phase_ref_date):
            findings.append(
                PhaseReadinessFinding(
                    code="COMMITMENT_NOT_YET_EFFECTIVE",
                    domain="WATER",
                    severity="WARNING",
                    message=f"Water commitment '{wc.id}' ({qty} KLD) becomes effective on {wc.effective_date}, after phase commissioning date {phase_ref_date}.",
                )
            )
            continue

        # Priority 1: Evidence trust evaluation
        is_verified, is_doc, is_sim, is_synth, is_conflict, is_exp = _verify_water_evidence_trust(
            wc, assertions_by_id, artifacts_by_id, phase_ref_date
        )

        if is_conflict:
            findings.append(
                PhaseReadinessFinding(
                    code="CONFLICTING_EVIDENCE_EXCLUDED",
                    domain="WATER",
                    severity="WARNING",
                    message=f"Water commitment '{wc.id}' ({qty} KLD) references conflicting evidence in database; excluded from firm capacity.",
                )
            )
            unverified_kld += qty
            continue

        if wc.status == "EXPIRED" or is_exp or is_commitment_expired(wc.expiry_date, phase_ref_date):
            findings.append(
                PhaseReadinessFinding(
                    code="EXPIRED_WATER_COMMITMENT",
                    domain="WATER",
                    severity="WARNING",
                    message=f"Water commitment '{wc.id}' ({qty} KLD) expired or expires before commissioning date {phase_ref_date}.",
                )
            )
            continue

        if is_synth:
            findings.append(
                PhaseReadinessFinding(
                    code="SYNTHETIC_COMMITMENT_EXCLUDED",
                    domain="WATER",
                    severity="INFO",
                    message=f"Synthetic demo water commitment '{wc.id}' ({qty} KLD) excluded from firm capacity.",
                )
            )
            continue

        if is_sim:
            findings.append(
                PhaseReadinessFinding(
                    code="SIMULATED_REVIEW_EXCLUDED",
                    domain="WATER",
                    severity="WARNING",
                    message=f"Water commitment '{wc.id}' ({qty} KLD) is backed by simulated review only; excluded from independently verified capacity.",
                )
            )

        # Priority 5: Groundwater regulatory authorization check
        if wc.source_type == "GROUNDWATER_NOC":
            if not is_verified and not is_doc:
                findings.append(
                    PhaseReadinessFinding(
                        code="GROUNDWATER_PERMIT_UNVERIFIED",
                        domain="WATER",
                        severity="CRITICAL",
                        message=f"Groundwater extraction claimed for commitment '{wc.id}' ({qty} KLD) lacks documented regulatory clearance from competent authority (CGWA/SGWA/State Ground Water Authority); excluded.",
                    )
                )
                unverified_kld += qty
                continue

            if not wc.authority_issuer:
                findings.append(
                    PhaseReadinessFinding(
                        code="GROUNDWATER_AUTHORITY_UNSPECIFIED",
                        domain="WATER",
                        severity="WARNING",
                        message=f"Groundwater commitment '{wc.id}' does not specify issuing regulatory authority (CGWA, SGWA, HWRA, UPGWD, GSDA, or WRD).",
                    )
                )

        # Proposed status exclusion
        if wc.status in ("PROPOSED", "UNKNOWN"):
            proposed_kld += qty
            findings.append(
                PhaseReadinessFinding(
                    code="PROPOSED_WATER_EXCLUDED",
                    domain="WATER",
                    severity="INFO",
                    message=f"Proposed water allocation '{wc.id}' ({qty} KLD, status: {wc.status}) excluded from firm capacity.",
                )
            )
            continue

        # Unverified exclusion
        if not is_verified and not is_doc:
            unverified_kld += qty
            findings.append(
                PhaseReadinessFinding(
                    code="UNVERIFIED_EVIDENCE_EXCLUDED",
                    domain="WATER",
                    severity="WARNING",
                    message=f"Water commitment '{wc.id}' ({qty} KLD) lacks verified evidence and is excluded from firm capacity.",
                )
            )
            continue

        # Firm allocated / operational water
        if wc.status in ("ALLOCATED", "OPERATIONAL"):
            ent_key = _get_water_entitlement_key(wc)
            if ent_key not in firm_entitlements:
                firm_entitlements[ent_key] = {
                    "ALLOCATED": 0.0,
                    "OPERATIONAL": 0.0,
                    "is_verified": False,
                    "is_documented": False,
                }
            entry = firm_entitlements[ent_key]
            if is_verified:
                entry["is_verified"] = True
            if is_doc:
                entry["is_documented"] = True

            if wc.status == "ALLOCATED":
                if entry["ALLOCATED"] > 0:
                    findings.append(
                        PhaseReadinessFinding(
                            code="DUPLICATE_ENTITLEMENT_DEDUPLICATED",
                            domain="WATER",
                            severity="WARNING",
                            message=f"Multiple allocation commitments share entitlement '{ent_key}'; deduplicated to prevent double counting.",
                        )
                    )
                entry["ALLOCATED"] = max(entry["ALLOCATED"], qty)
            elif wc.status == "OPERATIONAL":
                if entry["OPERATIONAL"] > 0:
                    findings.append(
                        PhaseReadinessFinding(
                            code="DUPLICATE_ENTITLEMENT_DEDUPLICATED",
                            domain="WATER",
                            severity="WARNING",
                            message=f"Multiple operational water commitments share entitlement '{ent_key}'; deduplicated to prevent double counting.",
                        )
                    )
                entry["OPERATIONAL"] = max(entry["OPERATIONAL"], qty)

    # Priority 2: Process deduplicated entitlements (ALLOCATED vs OPERATIONAL)
    verified_firm_kld = 0.0
    documented_firm_kld = 0.0
    qualifying_count = 0

    for ent_key, entry in firm_entitlements.items():
        alloc = entry["ALLOCATED"]
        oper = entry["OPERATIONAL"]

        if alloc > 0 and oper > 0:
            ent_qty = max(alloc, oper)
            findings.append(
                PhaseReadinessFinding(
                    code="ALLOCATION_OPERATIONAL_OVERLAP_DEDUPLICATED",
                    domain="WATER",
                    severity="WARNING",
                    message=f"Allocated ({alloc} KLD) and Operational ({oper} KLD) share entitlement '{ent_key}'; capped at {ent_qty} KLD to prevent double counting.",
                )
            )
        else:
            ent_qty = alloc if alloc > 0 else oper

        if ent_qty > 0:
            qualifying_count += 1
            if entry["is_verified"]:
                verified_firm_kld += ent_qty
            else:
                documented_firm_kld += ent_qty

    verified_firm_kld = round(verified_firm_kld, 4)
    documented_firm_kld = round(documented_firm_kld, 4)
    qualifying_firm_kld = round(verified_firm_kld + documented_firm_kld, 4)
    proposed_kld = round(proposed_kld, 4)
    unverified_kld = round(unverified_kld, 4)

    # Priority 1: Documented vs Verified finding
    if documented_firm_kld > 0 and verified_firm_kld < (peak_summer_demand_kld or 0.0):
        findings.append(
            PhaseReadinessFinding(
                code="DOCUMENTED_NOT_INDEPENDENTLY_VERIFIED",
                domain="WATER",
                severity="WARNING",
                message=f"Phase {phase.sequence} has {documented_firm_kld} KLD supported by documented commitments that lack independent third-party verification; verified deliverable allocation is {verified_firm_kld} KLD.",
            )
        )

    # Priority 3: Gap and Status calculation
    if peak_summer_demand_kld is None or peak_summer_demand_kld <= 0:
        water_gap_kld = None
        water_surplus_kld = 0.0
        status: ReadinessStatus = "INSUFFICIENT_DATA"
        findings.append(
            PhaseReadinessFinding(
                code="INSUFFICIENT_DATA",
                domain="WATER",
                severity="CRITICAL",
                message=f"Phase {phase.sequence} peak summer water demand is unknown or non-positive; gap cannot be calculated.",
            )
        )
    else:
        if qualifying_firm_kld >= peak_summer_demand_kld:
            water_gap_kld = 0.0
            water_surplus_kld = round(qualifying_firm_kld - peak_summer_demand_kld, 4)
            status = "MET"
        elif qualifying_firm_kld > 0:
            water_gap_kld = round(peak_summer_demand_kld - qualifying_firm_kld, 4)
            water_surplus_kld = 0.0
            status = "PARTIAL"
            findings.append(
                PhaseReadinessFinding(
                    code="WATER_DEFICIT",
                    domain="WATER",
                    severity="CRITICAL",
                    message=f"Phase {phase.sequence} has an evidence-backed water deficit of {water_gap_kld} KLD during peak summer (qualifying: {qualifying_firm_kld} KLD vs demand: {peak_summer_demand_kld} KLD). Reflects uncommitted documented balance, not confirmed physical utility shortage.",
                )
            )
        else:
            water_gap_kld = round(peak_summer_demand_kld, 4)
            water_surplus_kld = 0.0
            status = "UNCOMMITTED"
            findings.append(
                PhaseReadinessFinding(
                    code="WATER_UNCOMMITTED",
                    domain="WATER",
                    severity="CRITICAL",
                    message=f"Phase {phase.sequence} has 0 qualifying firm KLD committed for {peak_summer_demand_kld} KLD peak summer demand. Evidence-backed capacity gap of {peak_summer_demand_kld} KLD. Reflects uncommitted documented balance, not confirmed physical utility shortage.",
                )
            )

    readiness = PhaseWaterReadiness(
        phase_sequence=phase.sequence,
        peak_summer_demand_kld=peak_summer_demand_kld,
        average_demand_kld=avg_demand_kld,
        verified_allocated_kld=verified_firm_kld,
        documented_allocated_kld=documented_firm_kld,
        qualifying_firm_allocated_kld=qualifying_firm_kld,
        proposed_kld=proposed_kld,
        unverified_kld=unverified_kld,
        water_gap_kld=water_gap_kld,
        water_surplus_kld=water_surplus_kld,
        status=status,
        qualifying_commitments_count=qualifying_count,
        total_commitments_count=total_count,
    )
    return readiness, findings


def calculate_project_readiness(
    session: Session,
    project_id: str,
    site_id: Optional[str] = None,
) -> ProjectReadinessReport:
    """Evaluate deterministic resource readiness across all active phases of a project."""
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError(f"Project '{project_id}' not found.")

    # 1. Fetch active phases in strict sequence order
    phase_query = select(ProjectPhase).filter(
        ProjectPhase.project_id == project_id,
        ProjectPhase.status == "active",
    ).order_by(ProjectPhase.sequence)
    phases: List[ProjectPhase] = list(session.scalars(phase_query).all())

    # 2. Fetch active commitments
    power_q = select(PowerCommitment).filter(
        PowerCommitment.project_id == project_id,
        PowerCommitment.status_record == "active",
    )
    if site_id:
        power_q = power_q.filter((PowerCommitment.site_id == site_id) | (PowerCommitment.site_id.is_(None)))
    active_power: List[PowerCommitment] = list(session.scalars(power_q).all())

    water_q = select(WaterCommitment).filter(
        WaterCommitment.project_id == project_id,
        WaterCommitment.status_record == "active",
    )
    if site_id:
        water_q = water_q.filter((WaterCommitment.site_id == site_id) | (WaterCommitment.site_id.is_(None)))
    active_water: List[WaterCommitment] = list(session.scalars(water_q).all())

    # Preload assertions and artifacts for evidence trust verification
    assertions_by_id = {
        a.id: a
        for a in session.scalars(
            select(Assertion)
            .filter(Assertion.project_id == project_id)
            .options(
                selectinload(Assertion.artifact_links).selectinload(AssertionEvidenceLink.artifact),
                selectinload(Assertion.reviews),
            )
        ).all()
    }
    artifacts_by_id = {
        art.id: art for art in session.scalars(select(EvidenceArtifact).filter(EvidenceArtifact.project_id == project_id)).all()
    }

    has_power_inventory = len(active_power) > 0
    has_water_inventory = len(active_water) > 0

    phase_summaries: List[PhaseReadinessSummary] = []
    all_findings: List[PhaseReadinessFinding] = []

    previous_phase: Optional[ProjectPhase] = None
    for ph in phases:
        ph_findings: List[PhaseReadinessFinding] = []

        # Check PUE warnings from phase model
        for w in ph.warnings:
            ph_findings.append(
                PhaseReadinessFinding(
                    code="PUE_INCONSISTENCY_WARNING",
                    domain="CROSS_CUTTING",
                    severity="WARNING",
                    message=w,
                )
            )

        # Evaluate power
        p_readiness, p_findings = evaluate_phase_power(
            phase=ph,
            previous_phase=previous_phase,
            active_power_commitments=active_power,
            has_project_power_inventory=has_power_inventory,
            assertions_by_id=assertions_by_id,
            artifacts_by_id=artifacts_by_id,
        )
        ph_findings.extend(p_findings)

        # Evaluate water
        w_readiness, w_findings = evaluate_phase_water(
            phase=ph,
            active_water_commitments=active_water,
            has_project_water_inventory=has_water_inventory,
            assertions_by_id=assertions_by_id,
            artifacts_by_id=artifacts_by_id,
        )
        ph_findings.extend(w_findings)

        summary = PhaseReadinessSummary(
            phase_id=ph.id,
            phase_sequence=ph.sequence,
            phase_name=ph.name,
            commissioning_date=str(ph.commissioning_date),
            cooling_type=ph.cooling_type,
            design_pue=ph.design_pue,
            power=p_readiness,
            water=w_readiness,
            findings=ph_findings,
        )
        phase_summaries.append(summary)
        all_findings.extend(ph_findings)
        previous_phase = ph

    # Cross-phase deliverability rules: Phase 1 sanction/allocation must not imply full-campus deliverability.
    if len(phase_summaries) > 1:
        p1 = phase_summaries[0]
        later_phases = phase_summaries[1:]
        if p1.power.status == "MET" and any(lp.power.status in ("PARTIAL", "UNCOMMITTED") for lp in later_phases):
            finding = PhaseReadinessFinding(
                code="PHASE_1_SANCTION_ONLY",
                domain="POWER",
                severity="WARNING",
                message="Phase 1 has sufficient qualifying power, but later phases remain in deficit. Phase 1 sanction does not establish campus deliverability.",
            )
            all_findings.append(finding)
            for lp in later_phases:
                if lp.power.status in ("PARTIAL", "UNCOMMITTED"):
                    lp.findings.append(finding)

        if p1.water.status == "MET" and any(lp.water.status in ("PARTIAL", "UNCOMMITTED") for lp in later_phases):
            w_finding = PhaseReadinessFinding(
                code="PHASE_1_ALLOCATION_ONLY",
                domain="WATER",
                severity="WARNING",
                message="Phase 1 has sufficient qualifying water allocation, but later phases remain in deficit. Phase 1 allocation does not establish full-campus deliverability.",
            )
            all_findings.append(w_finding)
            for lp in later_phases:
                if lp.water.status in ("PARTIAL", "UNCOMMITTED"):
                    lp.findings.append(w_finding)

    # Campus summary calculation
    total_it = phases[-1].cumulative_it_mw if phases else None
    total_fac = phases[-1].cumulative_facility_peak_mw if phases else None
    total_peak_water = max((ph.peak_summer_water_kld for ph in phases), default=None) if phases else None

    # Compute overall statuses
    if not phases or not has_power_inventory or total_fac is None:
        if not phases or total_fac is None:
            overall_power_status: ReadinessStatus = "INSUFFICIENT_DATA"
        else:
            overall_power_status: ReadinessStatus = "UNKNOWN"
        overall_power_gap = None
        total_firm_power = 0.0
    else:
        last_phase_summary = phase_summaries[-1]
        overall_power_status = last_phase_summary.power.status
        overall_power_gap = last_phase_summary.power.power_gap_mw
        total_firm_power = last_phase_summary.power.qualifying_firm_capacity_mw

    if not phases or not has_water_inventory or total_peak_water is None:
        if not phases or total_peak_water is None:
            overall_water_status: ReadinessStatus = "INSUFFICIENT_DATA"
        else:
            overall_water_status: ReadinessStatus = "UNKNOWN"
        overall_water_gap = None
        total_firm_water = 0.0
    else:
        last_phase_summary = phase_summaries[-1]
        overall_water_status = last_phase_summary.water.status
        overall_water_gap = last_phase_summary.water.water_gap_kld
        total_firm_water = last_phase_summary.water.qualifying_firm_allocated_kld

    critical_count = sum(1 for f in all_findings if f.severity == "CRITICAL")
    warning_count = sum(1 for f in all_findings if f.severity == "WARNING")

    # Deduplicate findings across summary while preserving order
    seen_finding_signatures: Set[Tuple[str, str, str, str]] = set()
    deduped_findings: List[PhaseReadinessFinding] = []
    for f in all_findings:
        sig = (f.domain, f.code, f.severity, f.message)
        if sig not in seen_finding_signatures:
            seen_finding_signatures.add(sig)
            deduped_findings.append(f)

    campus_summary = CampusReadinessSummary(
        total_phases=len(phases),
        total_cumulative_it_mw=total_it,
        total_cumulative_facility_peak_mw=total_fac,
        total_qualifying_firm_power_mw=total_firm_power,
        overall_power_gap_mw=overall_power_gap,
        overall_power_status=overall_power_status,
        total_peak_summer_water_kld=total_peak_water,
        total_qualifying_firm_water_kld=total_firm_water,
        overall_water_gap_kld=overall_water_gap,
        overall_water_status=overall_water_status,
        critical_findings_count=critical_count,
        warning_findings_count=warning_count,
    )

    return ProjectReadinessReport(
        project_id=project.id,
        project_name=project.name,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
        campus_summary=campus_summary,
        phases=phase_summaries,
        all_findings=deduped_findings,
    )
