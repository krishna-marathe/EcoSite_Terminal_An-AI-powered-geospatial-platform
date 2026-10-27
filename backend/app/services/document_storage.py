"""Local secure document storage and extraction persistence for EcoSite India.

Provides bounded, safe filesystem storage with SHA-256 integrity,
size enforcement, path traversal protection, atomic writes, concurrency
locking and extraction result caching.
"""

import hashlib
import json
import mimetypes
import os
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MiB limit (26,214,400 bytes)
MAX_BASE64_LENGTH = 36_000_000  # ~25.7 MB max decoded payload
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}

# Process-level re-entrant lock registry for per-artifact concurrency control
_artifact_locks: Dict[str, threading.RLock] = {}
_registry_lock = threading.Lock()


def get_artifact_lock(artifact_id: str) -> threading.RLock:
    """Return a process-wide re-entrant lock for the specified artifact."""
    with _registry_lock:
        if artifact_id not in _artifact_locks:
            _artifact_locks[artifact_id] = threading.RLock()
        return _artifact_locks[artifact_id]


def get_storage_dir() -> Path:
    """Return the absolute path to the local document storage directory."""
    d = Path(os.getenv("ECOSITE_STORAGE_DIR", str(ROOT / "data" / "storage"))).expanduser().resolve()
    d.mkdir(parents=True, exist_ok=True)
    return d


def validate_file_content(filename: str, content: bytes) -> Tuple[str, str, int]:
    """Validate document content, extension, size and header.

    Returns:
        (sha256_hash, mime_type, size_bytes)
    Raises:
        ValueError on size, format or header mismatch.
    """
    if not content or len(content) == 0:
        raise ValueError("File content cannot be empty (0 bytes).")

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File size ({len(content)} bytes) exceeds the maximum allowed limit of {MAX_FILE_SIZE_BYTES} bytes (25 MiB)."
        )

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file format '{ext}'. Allowed extensions: {sorted(list(ALLOWED_EXTENSIONS))}."
        )

    # Magic header check
    if ext == ".pdf" and not content.startswith(b"%PDF"):
        raise ValueError("File declared as .pdf does not contain valid %PDF magic header.")
    if ext == ".docx" and not content.startswith(b"PK\x03\x04"):
        raise ValueError("File declared as .docx does not contain valid ZIP/DOCX magic header.")

    sha256 = hashlib.sha256(content).hexdigest()
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return sha256, mime, len(content)


def atomic_write_bytes(target_path: Path, data: bytes) -> None:
    """Atomically write bytes to a file using temporary file and rename."""
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = target_path.with_name(f"{target_path.name}.tmp.{uuid4().hex}")
    try:
        temp_path.write_bytes(data)
        os.replace(temp_path, target_path)
    except Exception:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise


def atomic_write_text(target_path: Path, text: str, encoding: str = "utf-8") -> None:
    """Atomically write text to a file using temporary file and rename."""
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = target_path.with_name(f"{target_path.name}.tmp.{uuid4().hex}")
    try:
        temp_path.write_text(text, encoding=encoding)
        os.replace(temp_path, target_path)
    except Exception:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise


def get_artifact_file_path(project_id: str, artifact_id: str, ext: str) -> Path:
    """Resolve a safe, server-generated filesystem path for the stored document."""
    storage_dir = get_storage_dir()
    target_dir = storage_dir / str(project_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = (target_dir / f"{artifact_id}{ext.lower()}").resolve()

    try:
        is_safe = target_file.is_relative_to(storage_dir)
    except AttributeError:
        is_safe = str(target_file).startswith(str(storage_dir))

    if not is_safe:
        raise ValueError("Path traversal attempt detected.")

    return target_file


def find_stored_artifact_file(project_id: str, artifact_id: str) -> Optional[Path]:
    """Find any stored file matching artifact_id under the project directory."""
    storage_dir = get_storage_dir()
    project_dir = storage_dir / str(project_id)
    if not project_dir.exists():
        return None

    for ext in ALLOWED_EXTENSIONS:
        candidate = project_dir / f"{artifact_id}{ext}"
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def store_artifact_bytes(
    project_id: str, artifact_id: str, filename: str, content: bytes, expected_sha256: Optional[str] = None
) -> Tuple[Path, str, int]:
    """Validate and safely persist artifact bytes on disk using atomic write.

    Returns:
        (stored_path, computed_sha256, file_size_bytes)
    """
    sha256, _mime, size = validate_file_content(filename, content)

    if expected_sha256 and expected_sha256.lower() != sha256.lower():
        raise ValueError(
            f"Uploaded content SHA-256 '{sha256}' does not match registered artifact SHA-256 '{expected_sha256}'."
        )

    ext = Path(filename).suffix.lower()
    path = get_artifact_file_path(project_id, artifact_id, ext)
    atomic_write_bytes(path, content)
    return path, sha256, size


def get_extractions_file_path(project_id: str, artifact_id: str) -> Path:
    """Resolve safe path for the extraction results JSON."""
    storage_dir = get_storage_dir()
    project_dir = storage_dir / str(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)
    target_file = (project_dir / f"{artifact_id}.extractions.json").resolve()

    try:
        is_safe = target_file.is_relative_to(storage_dir)
    except AttributeError:
        is_safe = str(target_file).startswith(str(storage_dir))

    if not is_safe:
        raise ValueError("Path traversal attempt detected.")

    return target_file


def save_extractions(project_id: str, artifact_id: str, data: Dict[str, Any]) -> None:
    """Persist extraction run results to disk atomically."""
    path = get_extractions_file_path(project_id, artifact_id)
    atomic_write_text(path, json.dumps(data, indent=2), encoding="utf-8")


def load_extractions(project_id: str, artifact_id: str) -> Optional[Dict[str, Any]]:
    """Load cached extraction run results from disk if present."""
    path = get_extractions_file_path(project_id, artifact_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def has_reviewed_candidates(extractions_data: Dict[str, Any]) -> bool:
    """Return True if any candidate in the extraction run has been reviewed (accepted, modified or rejected)."""
    for cand in extractions_data.get("extraction_candidates", []):
        if cand.get("review_status") in ("ACCEPTED", "MODIFIED", "REJECTED"):
            return True
    return False
