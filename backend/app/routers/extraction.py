"""FastAPI router for document upload, ML extraction and review-first confirmation.

Adheres strictly to AGENTS.md, API_CONTRACTS.md, and local-only access.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ml.service import extract_candidates_from_file

from ..models.evidence import Assertion, AssertionEvidenceLink, AssertionReview, EvidenceArtifact
from ..models.projects import utc_timestamp
from ..schemas.evidence import AssertionRead, EvidenceArtifactRead
from ..schemas.extraction import (
    ArtifactDirectUpload,
    DirectExtractionConfirmRequest,
    ExtractionCandidateConfirmRequest,
    ExtractionCandidatePayload,
    ExtractionCandidateRejectRequest,
    ExtractionRunResponse,
)
from ..services.document_storage import (
    MAX_BASE64_LENGTH,
    MAX_FILE_SIZE_BYTES,
    find_stored_artifact_file,
    get_artifact_lock,
    has_reviewed_candidates,
    load_extractions,
    save_extractions,
    store_artifact_bytes,
    validate_file_content,
)
from .evidence import (
    active_project,
    find_artifact,
    serialize_assertion,
    validate_phase_scope,
    validate_site_scope,
)
from .projects import find_project, get_session, local_only

router = APIRouter(tags=["Document Intelligence"], dependencies=[Depends(local_only)])


@router.post("/projects/{project_id}/evidence/upload", response_model=EvidenceArtifactRead, status_code=201)
async def upload_artifact_direct(
    project_id: UUID,
    body: ArtifactDirectUpload,
    request: Request,
    session: Session = Depends(get_session),
):
    """Directly register an evidence artifact and store its document bytes."""
    # Early Content-Length rejection hint
    cl_header = request.headers.get("content-length")
    if cl_header:
        try:
            if int(cl_header) > MAX_BASE64_LENGTH + 65536:
                raise HTTPException(
                    413,
                    detail={
                        "code": "file_too_large",
                        "message": f"Payload size indicated by Content-Length ({cl_header} bytes) exceeds limit (25 MiB).",
                    },
                )
        except ValueError:
            pass

    session.connection(execution_options={"sqlite_immediate": True})
    active_project(session, project_id)
    validate_site_scope(session, str(project_id), body.site_id)

    # Check base64 length constraint before decoding
    if len(body.content_base64) > MAX_BASE64_LENGTH:
        raise HTTPException(
            413,
            detail={
                "code": "file_too_large",
                "message": f"Base64 content exceeds maximum allowed length for 25 MiB.",
            },
        )

    # Decode base64 bytes
    try:
        raw_bytes = base64.b64decode(body.content_base64)
    except Exception as exc:
        raise HTTPException(422, detail={"code": "invalid_base64", "message": f"Malformed base64 content: {exc}"})

    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            413,
            detail={
                "code": "file_too_large",
                "message": f"Decoded file size ({len(raw_bytes)} bytes) exceeds maximum limit of {MAX_FILE_SIZE_BYTES} bytes (25 MiB).",
            },
        )

    try:
        sha256, mime_type, file_size = validate_file_content(body.filename, raw_bytes)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "file_validation_error", "message": str(exc)})

    # Deduplication check within project
    existing = session.scalar(
        select(EvidenceArtifact).where(
            EvidenceArtifact.project_id == str(project_id),
            EvidenceArtifact.sha256 == sha256,
            EvidenceArtifact.status == "active",
        )
    )
    if existing:
        raise HTTPException(
            409,
            detail={
                "code": "duplicate_artifact",
                "message": f"Artifact with SHA-256 {sha256} already registered as '{existing.filename}' ({existing.id}).",
                "existing_artifact_id": existing.id,
            },
        )

    artifact = EvidenceArtifact(
        project_id=str(project_id),
        site_id=str(body.site_id) if body.site_id else None,
        document_type=body.document_type,
        filename=Path(body.filename).name,
        mime_type=mime_type,
        file_size_bytes=file_size,
        sha256=sha256,
        issuer=body.issuer,
        reference=body.reference,
        issued_on=body.issued_on,
        valid_until=body.valid_until,
        visibility=body.visibility,
        confidentiality=body.confidentiality,
        synthetic_demo=body.synthetic_demo,
        uploaded_by=body.uploaded_by,
        uploaded_at=utc_timestamp(),
    )
    session.add(artifact)
    session.flush()

    # Store file bytes safely with atomic rename
    try:
        store_artifact_bytes(
            project_id=str(project_id),
            artifact_id=artifact.id,
            filename=artifact.filename,
            content=raw_bytes,
            expected_sha256=sha256,
        )
    except Exception as exc:
        session.rollback()
        raise HTTPException(500, detail={"code": "storage_failed", "message": f"Failed to persist file: {exc}"})

    return artifact


@router.put("/evidence/{artifact_id}/content", status_code=200)
@router.post("/evidence/{artifact_id}/content", status_code=200)
async def upload_artifact_content(
    artifact_id: UUID,
    request: Request,
    session: Session = Depends(get_session),
):
    """Upload document file bytes for a previously registered evidence artifact with incremental streaming."""
    with get_artifact_lock(str(artifact_id)):
        artifact = find_artifact(session, artifact_id)
        if artifact.status != "active":
            raise HTTPException(409, detail={"code": "artifact_archived", "message": "Cannot upload content to archived artifact."})

        content_type = request.headers.get("content-type", "")
        cl_header = request.headers.get("content-length")

        if "application/json" in content_type:
            # Check Content-Length hint
            if cl_header:
                try:
                    if int(cl_header) > MAX_BASE64_LENGTH + 65536:
                        raise HTTPException(
                            413,
                            detail={
                                "code": "file_too_large",
                                "message": f"Payload size indicated by Content-Length ({cl_header} bytes) exceeds limit (25 MiB).",
                            },
                        )
                except ValueError:
                    pass

            # Incremental stream read up to MAX_BASE64_LENGTH + 65536
            json_chunks = []
            total_json = 0
            async for chunk in request.stream():
                total_json += len(chunk)
                if total_json > MAX_BASE64_LENGTH + 65536:
                    raise HTTPException(
                        413,
                        detail={
                            "code": "file_too_large",
                            "message": f"JSON payload stream exceeds maximum allowed limit for 25 MiB.",
                        },
                    )
                json_chunks.append(chunk)

            try:
                body = json.loads(b"".join(json_chunks).decode("utf-8"))
                if not isinstance(body, dict) or "content_base64" not in body:
                    raise ValueError("JSON payload must contain 'content_base64'")
                b64_str = body["content_base64"]
                if len(b64_str) > MAX_BASE64_LENGTH:
                    raise HTTPException(413, detail={"code": "file_too_large", "message": "Base64 content exceeds 25 MiB limit."})
                raw_bytes = base64.b64decode(b64_str)
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(422, detail={"code": "invalid_payload", "message": f"Invalid base64 payload: {exc}"})

            if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
                raise HTTPException(
                    413,
                    detail={
                        "code": "file_too_large",
                        "message": f"Decoded file size ({len(raw_bytes)} bytes) exceeds maximum limit of {MAX_FILE_SIZE_BYTES} bytes (25 MiB).",
                    },
                )
        else:
            # Raw stream: Check Content-Length hint upfront
            if cl_header:
                try:
                    if int(cl_header) > MAX_FILE_SIZE_BYTES:
                        raise HTTPException(
                            413,
                            detail={
                                "code": "file_too_large",
                                "message": f"Payload size indicated by Content-Length ({cl_header} bytes) exceeds maximum limit of {MAX_FILE_SIZE_BYTES} bytes (25 MiB).",
                            },
                        )
                except ValueError:
                    pass

            # Incremental stream read bounded strictly at MAX_FILE_SIZE_BYTES
            chunks = []
            total_bytes = 0
            async for chunk in request.stream():
                total_bytes += len(chunk)
                if total_bytes > MAX_FILE_SIZE_BYTES:
                    raise HTTPException(
                        413,
                        detail={
                            "code": "file_too_large",
                            "message": f"Uploaded stream exceeds maximum limit of {MAX_FILE_SIZE_BYTES} bytes (25 MiB).",
                        },
                    )
                chunks.append(chunk)
            raw_bytes = b"".join(chunks)

        if len(raw_bytes) == 0:
            raise HTTPException(422, detail={"code": "file_empty", "message": "File content cannot be empty (0 bytes)."})

        try:
            _stored_path, computed_sha256, size = store_artifact_bytes(
                project_id=artifact.project_id,
                artifact_id=artifact.id,
                filename=artifact.filename,
                content=raw_bytes,
                expected_sha256=artifact.sha256,
            )
        except ValueError as exc:
            msg = str(exc)
            code = "sha256_mismatch" if "SHA-256" in msg else "file_validation_error"
            raise HTTPException(422, detail={"code": code, "message": msg})

        return {
            "artifact_id": artifact.id,
            "filename": artifact.filename,
            "sha256": computed_sha256,
            "file_size_bytes": size,
            "stored": True,
        }


@router.get("/evidence/{artifact_id}/content")
@router.get("/evidence/{artifact_id}/file")
def get_artifact_file_content(artifact_id: UUID, session: Session = Depends(get_session)):
    """Retrieve stored document file bytes."""
    artifact = find_artifact(session, artifact_id)
    file_path = find_stored_artifact_file(artifact.project_id, artifact.id)
    if file_path is None or not file_path.exists():
        raise HTTPException(404, detail={"code": "document_file_missing", "message": "No document file uploaded for this artifact."})

    data = file_path.read_bytes()
    return Response(
        content=data,
        media_type=artifact.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{artifact.filename}"'},
    )


@router.post("/evidence/{artifact_id}/extract", response_model=ExtractionRunResponse)
def extract_artifact_candidates(artifact_id: UUID, session: Session = Depends(get_session)):
    """Execute ML document intelligence on a stored document file, protecting reviewed candidates."""
    with get_artifact_lock(str(artifact_id)):
        artifact = find_artifact(session, artifact_id)
        file_path = find_stored_artifact_file(artifact.project_id, artifact.id)
        if file_path is None or not file_path.exists():
            raise HTTPException(
                404,
                detail={
                    "code": "document_file_missing",
                    "message": "No document file has been uploaded for this artifact. Upload content before extraction.",
                },
            )

        # Inspect existing extraction record: block re-extraction if any candidates were reviewed
        existing_extractions = load_extractions(artifact.project_id, artifact.id)
        if existing_extractions is not None and has_reviewed_candidates(existing_extractions):
            raise HTTPException(
                409,
                detail={
                    "code": "extraction_has_reviewed_candidates",
                    "message": "Cannot re-extract: document contains reviewed candidates (accepted, modified or rejected). Re-extraction is blocked to protect review decisions.",
                },
            )

        # Execute ML intelligence service
        ml_output = extract_candidates_from_file(
            file_path=file_path,
            document_id=str(artifact.id),
            document_type_hint=artifact.document_type,
        )

        # Format candidates with deterministic IDs and strict PENDING review status
        formatted_candidates: list[ExtractionCandidatePayload] = []
        for idx, c in enumerate(ml_output.get("extraction_candidates", [])):
            cand_id = f"{artifact.id}-cand-{idx + 1}"
            formatted_candidates.append(
                ExtractionCandidatePayload(
                    extraction_id=cand_id,
                    document_id=str(artifact.id),
                    document_type=c.get("document_type") or artifact.document_type,
                    page_number=int(c.get("page_number", 1)),
                    field_key=c.get("field_key", "unknown_field"),
                    raw_text=c.get("raw_text", ""),
                    normalized_value=c.get("normalized_value"),
                    unit=c.get("unit"),
                    phase_scope=c.get("phase_scope", "UNKNOWN"),
                    method=c.get("method", "RULE_BASED"),
                    model_version=c.get("model_version"),
                    confidence=c.get("confidence"),
                    review_status="PENDING",
                )
            )

        run_response = ExtractionRunResponse(
            artifact_id=artifact.id,
            filename=artifact.filename,
            file_format=ml_output.get("file_format", Path(artifact.filename).suffix.lstrip(".").upper()),
            page_count=ml_output.get("page_count", 1),
            status=ml_output.get("status", "SUCCESS"),
            document_type=artifact.document_type,
            classification=ml_output.get("classification", {}),
            candidate_count=len(formatted_candidates),
            extraction_candidates=formatted_candidates,
            warnings=ml_output.get("warnings", []),
        )

        # Cache run results atomically to local storage
        save_extractions(artifact.project_id, artifact.id, run_response.model_dump())

        return run_response


@router.get("/evidence/{artifact_id}/extractions", response_model=ExtractionRunResponse)
def get_artifact_extractions(artifact_id: UUID, session: Session = Depends(get_session)):
    """Retrieve previously computed extraction candidates for an artifact."""
    artifact = find_artifact(session, artifact_id)
    cached = load_extractions(artifact.project_id, artifact.id)
    if cached is None:
        raise HTTPException(
            404,
            detail={
                "code": "not_extracted",
                "message": "No extraction run has been performed for this artifact yet. Call POST /extract first.",
            },
        )
    return ExtractionRunResponse.model_validate(cached)


@router.post("/evidence/{artifact_id}/extractions/{extraction_id}/confirm", response_model=AssertionRead)
def confirm_candidate_as_assertion(
    artifact_id: UUID,
    extraction_id: str,
    body: ExtractionCandidateConfirmRequest,
    session: Session = Depends(get_session),
):
    """Review and confirm an extraction candidate, converting it into a DOCUMENTED assertion."""
    with get_artifact_lock(str(artifact_id)):
        session.connection(execution_options={"sqlite_immediate": True})
        artifact = find_artifact(session, artifact_id)
        active_project(session, artifact.project_id)

        validate_site_scope(session, artifact.project_id, body.target_site_id)
        validate_phase_scope(session, artifact.project_id, body.target_phase_id)

        # Reload extractions fresh under lock
        cached = load_extractions(artifact.project_id, artifact.id)
        if cached is None:
            raise HTTPException(404, detail={"code": "not_extracted", "message": "Extraction results not found."})

        target_candidate = None
        for cand in cached.get("extraction_candidates", []):
            if cand.get("extraction_id") == extraction_id:
                target_candidate = cand
                break

        if target_candidate is None:
            raise HTTPException(404, detail={"code": "candidate_not_found", "message": f"Candidate '{extraction_id}' not found."})

        # State check: reject repeat confirmation or confirmation of rejected candidate
        current_status = target_candidate.get("review_status", "PENDING")
        if current_status in ("ACCEPTED", "MODIFIED"):
            raise HTTPException(
                409,
                detail={
                    "code": "candidate_already_confirmed",
                    "message": f"Candidate '{extraction_id}' has already been confirmed as assertion '{target_candidate.get('assertion_id')}'.",
                    "assertion_id": target_candidate.get("assertion_id"),
                },
            )
        if current_status == "REJECTED":
            raise HTTPException(
                409,
                detail={
                    "code": "candidate_already_rejected",
                    "message": f"Candidate '{extraction_id}' was previously rejected and cannot be confirmed without reopening.",
                },
            )
        if current_status != "PENDING":
            raise HTTPException(
                409,
                detail={
                    "code": "invalid_candidate_state",
                    "message": f"Candidate '{extraction_id}' is in state '{current_status}' and cannot be confirmed.",
                },
            )

        # Database guard: check if an active assertion already exists in SQLite for this candidate
        cand_marker = f"[cand:{extraction_id}]"
        existing_assertion = (
            session.query(Assertion)
            .join(AssertionEvidenceLink, AssertionEvidenceLink.assertion_id == Assertion.id)
            .filter(
                AssertionEvidenceLink.artifact_id == str(artifact.id),
                Assertion.scope_detail.contains(cand_marker),
                Assertion.status_record == "active",
            )
            .first()
        )
        if existing_assertion is not None:
            if target_candidate.get("review_status") != "ACCEPTED":
                target_candidate["review_status"] = "ACCEPTED"
                target_candidate["assertion_id"] = existing_assertion.id
                try:
                    save_extractions(artifact.project_id, artifact.id, cached)
                except Exception:
                    pass
            raise HTTPException(
                409,
                detail={
                    "code": "candidate_already_confirmed",
                    "message": f"Candidate '{extraction_id}' has already been confirmed as assertion '{existing_assertion.id}'.",
                    "assertion_id": existing_assertion.id,
                },
            )

        # Preserve provenance and values
        field_key = target_candidate["field_key"]
        raw_val = (
            body.modified_value
            if body.modified_value is not None
            else str(
                target_candidate.get("normalized_value")
                if target_candidate.get("normalized_value") is not None
                else target_candidate.get("raw_text", "")
            )
        )
        num_val = (
            body.modified_numeric_value
            if body.modified_numeric_value is not None
            else (
                float(target_candidate["normalized_value"])
                if isinstance(target_candidate.get("normalized_value"), (int, float))
                else None
            )
        )
        unit = body.modified_unit or target_candidate.get("unit") or "UNKNOWN"
        phase_scope = target_candidate.get("phase_scope", "UNKNOWN")
        scope_type = "PHASE" if phase_scope in ("PHASE_1", "PHASE_2", "PHASE_3") else "CAMPUS"

        verification_method = (
            "EXTRACTED_RULE_BASED" if target_candidate.get("method") == "RULE_BASED" else "EXTRACTED_MODEL"
        )

        assertion = Assertion(
            project_id=artifact.project_id,
            site_id=str(body.target_site_id) if body.target_site_id else artifact.site_id,
            phase_id=str(body.target_phase_id) if body.target_phase_id else None,
            field_key=field_key,
            value=raw_val,
            numeric_value=num_val,
            unit=unit,
            scope_type=scope_type,
            scope_detail=f"{phase_scope} (extracted p.{target_candidate.get('page_number', 1)}) [cand:{extraction_id}]",
            status="DOCUMENTED",  # Strict invariant: extractions are DOCUMENTED at most until reviewed
            verification_method=verification_method,
            asserted_by=f"{body.reviewer_id} (ML candidate confirmed)",
            asserted_at=utc_timestamp(),
        )

        assertion.artifact_links.append(
            AssertionEvidenceLink(
                artifact_id=artifact.id,
                page_number=target_candidate.get("page_number", 1),
            )
        )

        # Optional immediate reviewer verification
        if body.review_outcome in ("APPROVED", "SIMULATED_VERIFICATION"):
            review = AssertionReview(
                assertion_id=assertion.id,
                reviewer_id=body.reviewer_id,
                review_status=body.review_outcome,
                is_simulated=body.is_simulated,
                notes=body.notes,
                reviewed_at=utc_timestamp(),
            )
            assertion.reviews.append(review)
            assertion.status = "VERIFIED_WITHIN_SCOPE"
            assertion.verification_method = "SIMULATED_REVIEW" if body.is_simulated else "INDEPENDENT_REVIEW"

        session.add(assertion)
        session.flush()

        # Update candidate review state in cached run
        target_candidate["review_status"] = "MODIFIED" if (body.modified_value or body.modified_numeric_value) else "ACCEPTED"
        target_candidate["assertion_id"] = assertion.id
        target_candidate["reviewed_by"] = body.reviewer_id
        target_candidate["review_notes"] = body.notes

        try:
            save_extractions(artifact.project_id, artifact.id, cached)
        except Exception:
            session.rollback()
            raise

        return serialize_assertion(assertion)


@router.post("/evidence/{artifact_id}/extractions/{extraction_id}/reject", status_code=200)
def reject_candidate(
    artifact_id: UUID,
    extraction_id: str,
    body: ExtractionCandidateRejectRequest,
    session: Session = Depends(get_session),
):
    """Mark an extraction candidate as REJECTED without creating any database assertion."""
    with get_artifact_lock(str(artifact_id)):
        artifact = find_artifact(session, artifact_id)
        cached = load_extractions(artifact.project_id, artifact.id)
        if cached is None:
            raise HTTPException(404, detail={"code": "not_extracted", "message": "Extraction results not found."})

        target_candidate = None
        for cand in cached.get("extraction_candidates", []):
            if cand.get("extraction_id") == extraction_id:
                target_candidate = cand
                break

        if target_candidate is None:
            raise HTTPException(404, detail={"code": "candidate_not_found", "message": f"Candidate '{extraction_id}' not found."})

        current_status = target_candidate.get("review_status", "PENDING")
        if current_status in ("ACCEPTED", "MODIFIED"):
            raise HTTPException(
                409,
                detail={
                    "code": "candidate_already_confirmed",
                    "message": f"Candidate '{extraction_id}' was already confirmed as assertion '{target_candidate.get('assertion_id')}'.",
                },
            )
        if current_status == "REJECTED":
            raise HTTPException(
                409,
                detail={
                    "code": "candidate_already_rejected",
                    "message": f"Candidate '{extraction_id}' was already rejected.",
                },
            )

        # Database guard: check if already confirmed in SQLite
        cand_marker = f"[cand:{extraction_id}]"
        existing_assertion = (
            session.query(Assertion)
            .join(AssertionEvidenceLink, AssertionEvidenceLink.assertion_id == Assertion.id)
            .filter(
                AssertionEvidenceLink.artifact_id == str(artifact.id),
                Assertion.scope_detail.contains(cand_marker),
                Assertion.status_record == "active",
            )
            .first()
        )
        if existing_assertion is not None:
            raise HTTPException(
                409,
                detail={
                    "code": "candidate_already_confirmed",
                    "message": f"Candidate '{extraction_id}' was already confirmed as assertion '{existing_assertion.id}'.",
                },
            )

        target_candidate["review_status"] = "REJECTED"
        target_candidate["rejection_notes"] = body.notes
        target_candidate["rejected_by"] = body.reviewer_id
        save_extractions(artifact.project_id, artifact.id, cached)

        return {
            "extraction_id": extraction_id,
            "review_status": "REJECTED",
            "rejected_by": body.reviewer_id,
            "notes": body.notes,
        }


@router.post("/extractions/{extraction_id}/confirm", response_model=AssertionRead)
def confirm_extraction_top_level(
    extraction_id: str,
    body: DirectExtractionConfirmRequest,
    session: Session = Depends(get_session),
):
    """Top-level candidate confirmation matching API_CONTRACTS.md Section 3."""
    return confirm_candidate_as_assertion(
        artifact_id=body.artifact_id,
        extraction_id=extraction_id,
        body=ExtractionCandidateConfirmRequest(
            reviewer_id=body.reviewer_id,
            notes=body.notes,
            target_site_id=body.target_site_id,
            target_phase_id=body.target_phase_id,
            modified_value=body.modified_value,
            modified_numeric_value=body.modified_numeric_value,
            modified_unit=body.modified_unit,
            is_simulated=body.is_simulated,
            review_outcome=body.review_outcome,
        ),
        session=session,
    )
