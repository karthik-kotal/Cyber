import base64
import struct
import uuid
import zlib
import pytest
from app.config import settings
from app.database import init_db
from app.schemas import ReportCreate
from app.routes.reports import submit_report
from app.routes.lookup import lookup_identifier
from app.routes.admin import reset_database
from app.evidence.hasher import hash_evidence_file
from app.evidence.phash import compute_perceptual_hash, hamming_distance, perceptual_similarity, is_perceptual_match
from app.evidence.ocr import normalize_ocr_text, compute_ocr_fingerprint, compare_ocr_similarity
from app.evidence.tx_matcher import extract_and_hash_tx_ref, normalize_transaction_reference
from app.evidence.similarity import compute_report_similarity
from unittest.mock import MagicMock
from fastapi import HTTPException


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    db_file = str(tmp_path / f"test_{uuid.uuid4().hex}.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)
    settings.DATABASE_PATH = db_file
    init_db(db_file)
    reset_database(x_admin_token=settings.ADMIN_TOKEN)
    return db_file


def make_request(ip: str = "127.0.0.1"):
    req = MagicMock()
    req.client.host = ip
    return req


def make_png(width=16, height=16, pattern_seed=1):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            val = int(((x * pattern_seed + y) / (width + height)) * 255) % 256
            raw.extend([val, val, val])
    compressed = zlib.compress(raw)
    png = bytearray(b"\x89PNG\r\n\x1a\n")
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png.extend(struct.pack(">I", len(ihdr_data)) + b"IHDR" + ihdr_data + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr_data)))
    png.extend(struct.pack(">I", len(compressed)) + b"IDAT" + compressed + struct.pack(">I", zlib.crc32(b"IDAT" + compressed)))
    png.extend(struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND")))
    return bytes(png)


def make_png_with_text(text="Ref: 321456789012"):
    png = bytearray(make_png(16, 16))
    # Insert tEXt chunk before IEND
    chunk_data = b"Comment\x00" + text.encode("utf-8")
    iend_pos = png.rfind(b"IEND") - 4
    chunk = struct.pack(">I", len(chunk_data)) + b"tEXt" + chunk_data + struct.pack(">I", zlib.crc32(b"tEXt" + chunk_data))
    return bytes(png[:iend_pos] + chunk + png[iend_pos:])


# --- 1. SHA-256 Tests ---

def test_sha256_exact_duplicates():
    img_bytes = make_png(16, 16, pattern_seed=5)
    res1 = hash_evidence_file(img_bytes)
    res2 = hash_evidence_file(img_bytes)
    assert res1.is_valid is True
    assert res1.file_sha256 == res2.file_sha256
    assert res1.mime_type == "image/png"


def test_sha256_different_files():
    img1 = make_png(16, 16, pattern_seed=1)
    img2 = make_png(16, 16, pattern_seed=99)
    res1 = hash_evidence_file(img1)
    res2 = hash_evidence_file(img2)
    assert res1.file_sha256 != res2.file_sha256


def test_sha256_empty_and_invalid_files():
    res_empty = hash_evidence_file(b"")
    assert res_empty.is_valid is False
    assert "empty" in res_empty.error_message.lower()

    res_corrupt = hash_evidence_file(b"not-a-valid-image-format-just-random-text")
    assert res_corrupt.is_valid is False
    assert "unsupported" in res_corrupt.error_message.lower()

    # Exceeding size
    huge = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    res_huge = hash_evidence_file(huge, max_size_bytes=50)
    assert res_huge.is_valid is False
    assert "exceeds" in res_huge.error_message.lower()


# --- 2. Perceptual Hashing (pHash) Tests ---

def test_phash_identical_and_scaled_images():
    img_orig = make_png(16, 16, pattern_seed=3)
    img_scaled = make_png(48, 48, pattern_seed=3)

    hash1 = compute_perceptual_hash(img_orig)
    hash2 = compute_perceptual_hash(img_scaled)
    assert hash1 is not None
    assert hash2 is not None

    # Scaled version of the same pattern should have small Hamming distance (near-zero)
    dist = hamming_distance(hash1, hash2)
    assert dist <= 5
    assert is_perceptual_match(hash1, hash2) is True
    assert perceptual_similarity(hash1, hash2) >= 0.90


def test_phash_unrelated_images():
    img1 = make_png(16, 16, pattern_seed=1)
    img2 = make_png(16, 16, pattern_seed=99)

    hash1 = compute_perceptual_hash(img1)
    hash2 = compute_perceptual_hash(img2)
    assert hash1 is not None and hash2 is not None
    dist = hamming_distance(hash1, hash2)
    # Unrelated patterns must not match
    assert dist > 10


def test_phash_invalid_images():
    assert compute_perceptual_hash(b"") is None
    assert compute_perceptual_hash(b"corrupt image data") is None


# --- 3. OCR Tests ---

def test_ocr_normalization_and_fingerprint():
    raw_ocr = "Payment Successful! \n\n UPI Ref No: 412389102938 \n Paid to: Scammer Store"
    fp1 = compute_ocr_fingerprint(raw_ocr)
    
    # Slight whitespace / case variations
    raw_ocr_variation = "  payment successful  upi ref no 412389102938  paid to scammer store  "
    fp2 = compute_ocr_fingerprint(raw_ocr_variation)

    assert fp1 is not None
    assert fp1 == fp2  # Normalized fingerprint matches despite formatting differences


def test_ocr_token_similarity():
    text1 = "Your electricity power will be disconnected call 9876543210 urgently"
    text2 = "Electricity bill pending power will be disconnected call 9876543210"
    sim = compare_ocr_similarity(text1, text2)
    assert sim >= 0.50

    unrelated = "Congratulations you have won 25 lakh lottery click link to claim"
    unrelated_sim = compare_ocr_similarity(text1, unrelated)
    assert unrelated_sim < 0.20


# --- 4. Transaction Reference Matching Tests ---

def test_transaction_ref_normalization_and_detection():
    # Various formats of 12-digit UPI UTR
    utr1 = "UPI/321456789012/Payment"
    utr2 = "321456789012"
    utr3 = "UTR: 321456789012"

    res1 = extract_and_hash_tx_ref(utr1)
    res2 = extract_and_hash_tx_ref(utr2)
    res3 = extract_and_hash_tx_ref(utr3)

    assert res1 is not None and res2 is not None and res3 is not None
    assert res1.normalized_ref == "321456789012"
    assert res1.tx_ref_hmac == res2.tx_ref_hmac == res3.tx_ref_hmac
    assert res1.ref_type == "UPI_UTR"


def test_different_transaction_references():
    ref_a = extract_and_hash_tx_ref("321456789012")
    ref_b = extract_and_hash_tx_ref("987654321098")
    assert ref_a.tx_ref_hmac != ref_b.tx_ref_hmac


def test_bank_and_gateway_references():
    bank_utr = extract_and_hash_tx_ref("PUNBR52023103100123456")
    assert bank_utr is not None
    assert bank_utr.ref_type == "BANK_UTR"

    gw_ref = extract_and_hash_tx_ref("pay_NABC1234567890")
    assert gw_ref is not None
    assert gw_ref.ref_type == "PAYMENT_GATEWAY"


# --- 5. Report Similarity & Sybil Synergies ---

def test_report_similarity_scoring():
    rep_a = {
        "reporter_hmac": "user_a",
        "file_sha256": "sha_common_123",
        "phash": "0123456789abcdef",
        "tx_ref_hmac": "tx_common_456",
        "note_fingerprint": "note_123",
        "ip_prefix_hmac": "subnet_x",
        "created_at": "2026-10-31T10:00:00Z"
    }

    # Near-identical report from same user with same transaction
    rep_b = {
        "reporter_hmac": "user_a",
        "file_sha256": "sha_common_123",
        "phash": "0123456789abcdef",
        "tx_ref_hmac": "tx_common_456",
        "note_fingerprint": "note_123",
        "ip_prefix_hmac": "subnet_x",
        "created_at": "2026-10-31T10:02:00Z"
    }

    sim = compute_report_similarity(rep_a, rep_b)
    assert sim["similarity_score"] >= 0.80
    assert sim["risk_level"] == "HIGH"
    assert sim["same_reporter"] is True
    assert sim["exact_file_match"] is True
    assert sim["matching_tx_ref"] is True


def test_shared_subnet_alone_not_flagged_as_high_risk():
    # Two genuine victims on a shared university / office Wi-Fi
    rep_victim_1 = {
        "reporter_hmac": "victim_alice",
        "file_sha256": "file_alice_screenshot",
        "phash": "0000000000000000",
        "tx_ref_hmac": "tx_alice_payment",
        "note_fingerprint": "note_alice",
        "ip_prefix_hmac": "shared_campus_wifi_subnet",
        "created_at": "2026-10-25T10:00:00Z"
    }
    rep_victim_2 = {
        "reporter_hmac": "victim_bob",
        "file_sha256": "file_bob_screenshot",
        "phash": "ffffffffffffffff",
        "tx_ref_hmac": "tx_bob_payment",
        "note_fingerprint": "note_bob",
        "ip_prefix_hmac": "shared_campus_wifi_subnet",
        "created_at": "2026-10-30T15:00:00Z"
    }
    sim = compute_report_similarity(rep_victim_1, rep_victim_2)
    # Sharing only subnet does NOT produce HIGH risk
    assert sim["risk_level"] == "LOW"
    assert sim["same_network"] is True
    assert sim["similarity_score"] <= 0.20


# --- 6. End-to-End API Integration With Evidence ---

def test_api_submit_with_evidence_and_duplicate_detection():
    target = "+91 9888877777"
    raw_img = make_png(16, 16, pattern_seed=42)
    b64_img = base64.b64encode(raw_img).decode("ascii")
    tx_code = "321456789012"

    # 1. First report submission with evidence file and transaction reference
    req1 = make_request("10.1.1.1")
    res1 = submit_report(ReportCreate(
        identifier=target,
        scam_type="KYC_FRAUD",
        note="Received fraud call demanding payment",
        reporter_id="user_original",
        evidence_base64=b64_img,
        transaction_ref=tx_code
    ), req1)

    assert res1.status == "ACCEPTED"
    assert res1.evidence_duplicate_detected is False
    assert res1.tx_ref_duplicate_detected is False

    # 2. Second report reusing the exact same screenshot and transaction reference
    req2 = make_request("10.1.1.2")
    res2 = submit_report(ReportCreate(
        identifier=target,
        scam_type="KYC_FRAUD",
        note="Re-reporting with same proof",
        reporter_id="user_bot_clone",
        evidence_base64=b64_img,
        transaction_ref=tx_code
    ), req2)

    assert res2.status == "ACCEPTED"
    # Duplicate evidence and matching transaction reference are detected!
    assert res2.evidence_duplicate_detected is True
    assert res2.tx_ref_duplicate_detected is True

    # Check lookup response
    lookup = lookup_identifier(target)
    # Both reports cited the same payment transaction reference -> collapsed into 1 independent source
    assert lookup.report_count == 2
    assert lookup.distinct_reporters == 1
    assert lookup.verdict == "SUSPICIOUS"  # 1 distinct < 3 threshold
    assert lookup.evidence["duplicate_evidence_count"] >= 1
    assert lookup.evidence["matching_tx_refs_count"] >= 1


def test_api_invalid_evidence_base64_returns_400():
    req = make_request()
    with pytest.raises(HTTPException) as exc:
        submit_report(ReportCreate(
            identifier="+91 9777766666",
            scam_type="JOB_FRAUD",
            evidence_base64="!!!not-valid-base64-bytes!!!"
        ), req)
    assert exc.value.status_code == 400


def test_api_empty_evidence_file_returns_400():
    req = make_request()
    empty_b64 = base64.b64encode(b"").decode("ascii")
    with pytest.raises(HTTPException) as exc:
        submit_report(ReportCreate(
            identifier="+91 9777766666",
            scam_type="JOB_FRAUD",
            evidence_base64=empty_b64
        ), req)
    assert exc.value.status_code == 400
