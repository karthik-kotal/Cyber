import re
import hmac
import hashlib
from typing import Optional, List, NamedTuple
from app.config import settings


class ExtractedTxRef(NamedTuple):
    raw_ref: str
    normalized_ref: str
    ref_type: str
    tx_ref_hmac: str


_RE_UPI_UTR = re.compile(r"\b(?:UPI|UTR|REF|TXN|TRANSACTION)?[:\s\-\/]*([0-9]{12})\b", re.IGNORECASE)
_RE_BANK_UTR = re.compile(r"\b([A-Z]{4}[0-9A-Z]{12,18})\b", re.IGNORECASE)
_RE_GATEWAY_ORDER = re.compile(r"\b(pay_[0-9a-zA-Z]{14,24}|order_[0-9a-zA-Z]{14,24})\b", re.IGNORECASE)


def normalize_transaction_reference(ref: str) -> Optional[tuple[str, str]]:
    """
    Normalizes a transaction reference.
    Returns (normalized_ref, ref_type) or None if invalid.
    """
    if not ref or not isinstance(ref, str):
        return None
    cleaned = ref.strip()
    if len(cleaned) < 8 or len(cleaned) > 50:
        return None

    # 1. Gateway ID (e.g. pay_N123456789)
    gw_match = _RE_GATEWAY_ORDER.search(cleaned)
    if gw_match:
        return gw_match.group(1).lower(), "PAYMENT_GATEWAY"

    # 2. UPI / IMPS 12-digit UTR
    upi_match = _RE_UPI_UTR.search(cleaned)
    if upi_match:
        return upi_match.group(1), "UPI_UTR"

    # 3. Bank RTGS/NEFT UTR (16-22 characters alphanumeric starting with bank code)
    bank_match = _RE_BANK_UTR.search(cleaned)
    if bank_match:
        return bank_match.group(1).upper(), "BANK_UTR"

    # Digits only check (10 to 18 digits)
    digits_only = re.sub(r"\D", "", cleaned)
    if 10 <= len(digits_only) <= 18:
        return digits_only, "NUMERIC_REF"

    return None


def hash_transaction_reference(normalized_ref: str) -> str:
    """Computes HMAC-SHA256 of the normalized transaction reference."""
    secret = settings.HMAC_SECRET.encode("utf-8")
    return hmac.new(secret, normalized_ref.encode("utf-8"), hashlib.sha256).hexdigest()


def extract_and_hash_tx_ref(raw_ref: Optional[str]) -> Optional[ExtractedTxRef]:
    """
    Extracts, normalizes, and securely hashes a transaction reference.
    Raw value is never stored in public responses.
    """
    if not raw_ref:
        return None
    parsed = normalize_transaction_reference(raw_ref)
    if not parsed:
        return None
    norm_val, ref_type = parsed
    digest = hash_transaction_reference(norm_val)
    return ExtractedTxRef(
        raw_ref=raw_ref,
        normalized_ref=norm_val,
        ref_type=ref_type,
        tx_ref_hmac=digest
    )


def extract_tx_refs_from_text(text: Optional[str]) -> List[ExtractedTxRef]:
    """Scans freeform text or OCR output for embedded transaction references."""
    if not text:
        return []
    results = []
    seen = set()

    # Look for UPI UTRs
    for match in _RE_UPI_UTR.finditer(text):
        val = match.group(1)
        if val not in seen:
            seen.add(val)
            digest = hash_transaction_reference(val)
            results.append(ExtractedTxRef(raw_ref=match.group(0), normalized_ref=val, ref_type="UPI_UTR", tx_ref_hmac=digest))

    return results

