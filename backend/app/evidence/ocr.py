import hashlib
import re
import zlib
import struct
from typing import Optional, Set
from app.config import settings


def _extract_png_metadata_text(image_bytes: bytes) -> Optional[str]:
    """Extracts text from PNG tEXt and zTXt chunks if present."""
    try:
        if not image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return None
        idx = 8
        found_texts = []
        total_len = len(image_bytes)

        while idx < total_len:
            if idx + 8 > total_len:
                break
            length = struct.unpack(">I", image_bytes[idx : idx + 4])[0]
            chunk_type = image_bytes[idx + 4 : idx + 8]
            data = image_bytes[idx + 8 : idx + 8 + length]
            idx += 12 + length

            if chunk_type == b"tEXt":
                parts = data.split(b"\x00", 1)
                if len(parts) == 2:
                    found_texts.append(parts[1].decode("utf-8", errors="ignore"))
            elif chunk_type == b"zTXt":
                parts = data.split(b"\x00", 2)
                if len(parts) >= 2:
                    try:
                        decomp = zlib.decompress(parts[-1]).decode("utf-8", errors="ignore")
                        found_texts.append(decomp)
                    except Exception:
                        pass
            elif chunk_type == b"IEND":
                break

        return " ".join(found_texts) if found_texts else None
    except Exception:
        return None


def extract_ocr_text(image_bytes: bytes) -> Optional[str]:
    """
    Extracts readable text from screenshot or document evidence.
    Gracefully handles OCR library absence or parsing failures without crashing.
    """
    if not settings.ENABLE_OCR or not image_bytes:
        return None

    # 1. Try pytesseract if installed
    try:
        import pytesseract
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        extracted = pytesseract.image_to_string(img)
        if extracted and extracted.strip():
            return extracted.strip()
    except Exception:
        pass

    # 2. Check for embedded metadata text
    meta_text = _extract_png_metadata_text(image_bytes)
    if meta_text and meta_text.strip():
        return meta_text.strip()

    return None


def normalize_ocr_text(text: Optional[str]) -> str:
    """Normalizes OCR text: lowercase, alphanumeric tokens only."""
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = [t for t in cleaned.split() if len(t) > 2]
    return " ".join(tokens)


def compute_ocr_fingerprint(text: Optional[str]) -> Optional[str]:
    """Generates deterministic SHA-256 hash of normalized OCR text."""
    normalized = normalize_ocr_text(text)
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def compute_token_jaccard_similarity(tokens1: Set[str], tokens2: Set[str]) -> float:
    """Computes Jaccard similarity between two token sets."""
    if not tokens1 or not tokens2:
        return 0.0
    intersection = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    return round(intersection / union, 4) if union > 0 else 0.0


def compare_ocr_similarity(
    text1: Optional[str],
    text2: Optional[str],
    fp1: Optional[str] = None,
    fp2: Optional[str] = None
) -> float:
    """
    Compares two OCR outputs using fingerprint match (1.0) or Jaccard token overlap.
    """
    if fp1 and fp2 and fp1 == fp2:
        return 1.0

    norm1 = normalize_ocr_text(text1)
    norm2 = normalize_ocr_text(text2)
    if not norm1 or not norm2:
        return 0.0

    tokens1 = set(norm1.split())
    tokens2 = set(norm2.split())
    return compute_token_jaccard_similarity(tokens1, tokens2)

