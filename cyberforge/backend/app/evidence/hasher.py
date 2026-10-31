import hashlib
from typing import NamedTuple, Optional
from app.config import settings


class EvidenceValidationResult(NamedTuple):
    file_sha256: str
    file_size_bytes: int
    mime_type: str
    is_valid: bool
    error_message: Optional[str] = None


SUPPORTED_MAGIC_BYTES = {
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"%PDF": "application/pdf",
    b"BM": "image/bmp",
    b"RIFF": "image/webp",  # WebP container
}


def detect_mime_type(data: bytes) -> Optional[str]:
    """Detects MIME type from file header magic bytes."""
    if not data or len(data) < 4:
        return None
    for magic, mime in SUPPORTED_MAGIC_BYTES.items():
        if data.startswith(magic):
            return mime
    return None


def hash_evidence_file(
    file_bytes: bytes,
    max_size_bytes: Optional[int] = None
) -> EvidenceValidationResult:
    """
    Validates evidence file and generates SHA-256 digest.
    Does NOT store raw bytes to preserve storage and user privacy.
    """
    if not file_bytes or len(file_bytes) == 0:
        return EvidenceValidationResult(
            file_sha256="",
            file_size_bytes=0,
            mime_type="unknown",
            is_valid=False,
            error_message="Uploaded evidence file is empty"
        )

    size = len(file_bytes)
    limit = max_size_bytes or settings.MAX_EVIDENCE_SIZE_BYTES
    if size > limit:
        return EvidenceValidationResult(
            file_sha256="",
            file_size_bytes=size,
            mime_type="unknown",
            is_valid=False,
            error_message=f"Evidence file size ({size} bytes) exceeds limit ({limit} bytes)"
        )

    mime = detect_mime_type(file_bytes)
    if not mime:
        return EvidenceValidationResult(
            file_sha256="",
            file_size_bytes=size,
            mime_type="unknown",
            is_valid=False,
            error_message="Unsupported evidence file format. Supported: PNG, JPEG, PDF, BMP, WebP."
        )

    digest = hashlib.sha256(file_bytes).hexdigest()
    return EvidenceValidationResult(
        file_sha256=digest,
        file_size_bytes=size,
        mime_type=mime,
        is_valid=True,
        error_message=None
    )

