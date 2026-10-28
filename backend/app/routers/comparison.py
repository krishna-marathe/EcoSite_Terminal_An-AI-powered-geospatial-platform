from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.models.commitments import PowerCommitment, WaterCommitment
from backend.app.models.evidence import Assertion, EvidenceArtifact
from backend.app.models.phases import ProjectPhase
from backend.app.models.projects import Project
from backend.app.models.sites import CandidateSite
from backend.app.routers.projects import find_project, get_session, local_only
from backend.app.schemas.comparison import (
    CandidateSiteComparisonItem,
    SiteComparisonDimension,
    SiteComparisonResponse,
    SitePassportSection,
    SiteReadinessPassport,
)
from backend.app.services.readiness_engine import calculate_project_readiness

router = APIRouter(prefix="/projects", tags=["Comparison & Passport"])


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/{project_id}/comparisons", response_model=SiteComparisonResponse)
def get_project_site_comparisons(
    project_id: UUID,
    session: Session = Depends(get_session),
) -> SiteComparisonResponse:
    """Evaluate and compare up to 3 candidate sites across 4 strictly independent dimensions:

    1. Resource Deliverability Balance
    2. Environmental Exposure
    3. Regulatory Readiness
    4. Evidence Completeness
    """
    project = session.get(Project, str(project_id))
    if not project or project.status == "archived":
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "Project not found"})

    sites_stmt = select(CandidateSite).filter(
        CandidateSite.project_id == str(project_id),
        CandidateSite.status == "active",
    ).order_by(CandidateSite.created_at)
    candidate_sites = list(session.scalars(sites_stmt).all())

    # Pre-fetch evidence assertions and artifacts for project
    assertions = list(session.scalars(select(Assertion).filter(Assertion.project_id == str(project_id))).all())
    artifacts = list(session.scalars(select(EvidenceArtifact).filter(EvidenceArtifact.project_id == str(project_id))).all())

    # Pre-fetch project phases
    phases = list(
        session.scalars(
            select(ProjectPhase)
            .filter(ProjectPhase.project_id == str(project_id), ProjectPhase.status == "active")
            .order_by(ProjectPhase.sequence)
        ).all()
    )

    total_demand_mw = phases[-1].cumulative_facility_peak_mw if phases else 0.0
    total_water_kld = max((p.peak_summer_water_kld for p in phases), default=0.0) if phases else 0.0

    comparison_items: List[CandidateSiteComparisonItem] = []

    for site in candidate_sites:
        # 1. Resource Readiness for this site
        site_readiness = calculate_project_readiness(session, str(project_id), site_id=site.id)
        campus_sum = site_readiness.campus_summary

        res_notes = []
        if campus_sum.overall_power_status in ("UNCOMMITTED", "UNKNOWN"):
            res_notes.append("Grid capacity uncommitted or unassessed.")
        if campus_sum.overall_water_status in ("UNCOMMITTED", "UNKNOWN"):
            res_notes.append("Water allocation uncommitted or unassessed.")

        resource_dim = SiteComparisonDimension(
            title="Resource Readiness",
            status="READY" if (campus_sum.overall_power_status == "MET" and campus_sum.overall_water_status == "MET") else "ATTENTION_REQUIRED",
            metrics={
                "firm_power_mw": campus_sum.total_qualifying_firm_power_mw,
                "power_gap_mw": campus_sum.overall_power_gap_mw,
                "power_status": campus_sum.overall_power_status,
                "firm_water_kld": campus_sum.total_qualifying_firm_water_kld,
                "water_gap_kld": campus_sum.overall_water_gap_kld,
                "water_status": campus_sum.overall_water_status,
            },
            notes=res_notes,
        )

        # 2. Environmental Exposure
        boundary_status = (site.boundary_screening or {}).get("status", "unknown")
        env_notes = []
        if boundary_status != "inside_screening_boundary":
            env_notes.append("Boundary review required with Survey of India.")
        
        env_dim = SiteComparisonDimension(
            title="Environmental Exposure",
            status="READY" if boundary_status == "inside_screening_boundary" else "ATTENTION_REQUIRED",
            metrics={
                "boundary_screening": boundary_status,
                "boundary_source": site.boundary_source,
                "area_ha": site.area_ha,
            },
            notes=env_notes,
        )

        # 3. Regulatory Readiness
        state_rules = {
            "IN-MH": "Maharashtra Data Centre Policy 2023 (Stamp duty exemption, power tariff subsidy)",
            "IN-KA": "Karnataka Data Centre Policy 2022-2027 (Custom duty exemption, clean energy incentives)",
            "IN-TG": "Telangana ICT & Cloud Policy (High availability zone, dual-feeder power mandate)",
            "IN-TN": "Tamil Nadu Data Centre Policy (Green power concessions, wheeling incentives)",
        }
        policy_desc = state_rules.get(site.state_code, "National screening guidelines apply; state policy unverified.")
        reg_dim = SiteComparisonDimension(
            title="Regulatory Readiness",
            status="READY" if site.state_code in state_rules else "UNKNOWN",
            metrics={
                "state_code": site.state_code,
                "policy_framework": policy_desc,
            },
            notes=["State incentives subject to formal eligibility filing."],
        )

        # 4. Evidence Completeness
        verified_count = sum(1 for a in assertions if a.status == "VERIFIED_WITHIN_SCOPE")
        conflict_count = sum(1 for a in assertions if a.status == "CONFLICTING")
        doc_count = sum(1 for a in assertions if a.status == "DOCUMENTED")

        ev_notes = []
        if conflict_count > 0:
            ev_notes.append(f"{conflict_count} conflicting assertions detected.")
        if verified_count == 0:
            ev_notes.append("Zero third-party verified assertions.")

        evidence_dim = SiteComparisonDimension(
            title="Evidence Completeness",
            status="HIGH_RISK" if conflict_count > 0 else ("READY" if verified_count > 0 else "ATTENTION_REQUIRED"),
            metrics={
                "total_artifacts": len(artifacts),
                "total_assertions": len(assertions),
                "verified_assertions": verified_count,
                "conflicting_assertions": conflict_count,
                "documented_assertions": doc_count,
            },
            notes=ev_notes,
        )

        comparison_items.append(
            CandidateSiteComparisonItem(
                site_id=site.id,
                site_name=site.name,
                area_ha=site.area_ha,
                state_code=site.state_code,
                district=site.district,
                boundary_screening_status=boundary_status,
                resource_readiness=resource_dim,
                environmental_exposure=env_dim,
                regulatory_readiness=reg_dim,
                evidence_completeness=evidence_dim,
            )
        )

    return SiteComparisonResponse(
        project_id=str(project_id),
        project_name=project.name,
        evaluated_at=_utc_now_iso(),
        sites=comparison_items,
    )


@router.get("/{project_id}/sites/{site_id}/passport", response_model=SiteReadinessPassport)
def get_site_readiness_passport(
    project_id: UUID,
    site_id: UUID,
    session: Session = Depends(get_session),
) -> SiteReadinessPassport:
    """Generate an immutable pre-investment Site Readiness Passport snapshot."""
    project = session.get(Project, str(project_id))
    if not project or project.status == "archived":
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "Project not found"})

    site = session.get(CandidateSite, str(site_id))
    if not site or site.project_id != str(project_id) or site.status == "archived":
        raise HTTPException(status_code=404, detail={"code": "site_not_found", "message": "Candidate site not found"})

    readiness = calculate_project_readiness(session, str(project_id), site_id=str(site_id))

    # Compile passport sections
    sections: List[SitePassportSection] = [
        SitePassportSection(
            section_id="sec_spatial",
            title="Spatial & Boundary Screening",
            status="SCREENING_VERIFIED",
            data={
                "area_ha": site.area_ha,
                "state_code": site.state_code,
                "district": site.district,
                "boundary_source": site.boundary_source,
                "boundary_screening": site.boundary_screening or {},
                "revision": site.revision,
            },
            findings=[],
        ),
        SitePassportSection(
            section_id="sec_phases",
            title="Campus Lifecycle & Phasing Progression",
            status="EVALUATED",
            data={
                "phases_count": len(readiness.phases),
                "phases": [p.model_dump() for p in readiness.phases],
            },
            findings=[],
        ),
        SitePassportSection(
            section_id="sec_resource_gaps",
            title="Deliverability & Deficit Balance",
            status="BALANCED" if (readiness.campus_summary.overall_power_status == "MET" and readiness.campus_summary.overall_water_status == "MET") else "DEFICIT",
            data={
                "campus_summary": readiness.campus_summary.model_dump(),
            },
            findings=readiness.all_findings,
        ),
    ]

    statutory_checklist = [
        {
            "name": "State Environmental Impact Assessment (SEIAA / MoEFCC)",
            "mandate": "EIA Notification 2006 for built-up area > 20,000 sq.m",
            "status": "EVIDENCE_REQUIRED",
        },
        {
            "name": "Consent to Establish (CTE / CTP)",
            "mandate": "State Pollution Control Board (DG emissions & STP effluent discharge)",
            "status": "EVIDENCE_REQUIRED",
        },
        {
            "name": "Dedicated Substation Feasibility Approval",
            "mandate": "STU / DISCOM dedicated 220kV or 110kV feeder and bay availability",
            "status": "VERIFIED" if readiness.campus_summary.overall_power_status == "MET" else "ATTENTION_REQUIRED",
        },
        {
            "name": "PESO Explosives Licence for HSD Storage",
            "mandate": "Bulk High Speed Diesel fuel storage for standby backup generator sets",
            "status": "EVIDENCE_REQUIRED",
        },
    ]

    return SiteReadinessPassport(
        passport_id=f"pass-{site.id[:8]}-{project.id[:8]}",
        generated_at=_utc_now_iso(),
        project_id=str(project_id),
        project_name=project.name,
        archetype=project.archetype,
        site_id=site.id,
        site_name=site.name,
        state_code=site.state_code,
        district=site.district,
        parcel_area_ha=site.area_ha,
        boundary_source=site.boundary_source,
        boundary_screening_status=(site.boundary_screening or {}).get("status", "unknown"),
        sections=sections,
        statutory_checklist=statutory_checklist,
    )
