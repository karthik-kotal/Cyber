import base64
import os
import uuid
import struct
import zlib
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from PIL import Image

from app.config import settings
from app.database import init_db, get_db_connection
from app.schemas import ReportCreate
from app.routes.reports import submit_report, get_report_detail, derive_category_from_scam_type
from app.routes.admin import list_admin_reports, get_admin_report_evidence, compare_admin_evidence_hashes, CompareHashesRequest
from app.normalize import OFFICIAL_SCAM_TYPES, SCAM_CATEGORIES, normalize_scam_type, InvalidIdentifierError
from app.evidence.manipulation import (
    compute_sha256,
    detect_magic_bytes_format,
    validate_evidence_image,
    analyze_crop,
    analyze_brightness,
    analyze_watermark,
    analyze_text_integrity,
    analyze_format_and_metadata,
    run_all_integrity_checks,
    compare_hashes,
    save_evidence_file,
    MAX_IMAGE_SIZE_BYTES,
)


@pytest.fixture(autouse=True)
def setup_test_dbs(tmp_path, monkeypatch):
    prod_db = str(tmp_path / f"test_prod_{uuid.uuid4().hex}.db")
    demo_db = str(tmp_path / f"test_demo_{uuid.uuid4().hex}.db")
    monkeypatch.setenv("DATABASE_PATH", prod_db)
    monkeypatch.setenv("DEMO_DATABASE_PATH", demo_db)
    settings.DATABASE_PATH = prod_db
    settings.DEMO_DATABASE_PATH = demo_db
    init_db(prod_db)
    init_db(demo_db)
    return prod_db, demo_db


def make_request(ip: str = "127.0.0.1", pov: str = "normal"):
    req = MagicMock()
    req.client.host = ip
    headers = {"x-cyberforge-pov": pov}
    req.headers = headers
    return req


def make_valid_png_bytes(width=16, height=16, pattern_seed=1):
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


# ==============================================================================
# FEATURE 1: SCAM CATEGORIES TESTS
# ==============================================================================

REQUIRED_28_CATEGORIES = [
    "bank-account-freeze",
    "credit-card-fraud",
    "upi-collect-request",
    "screen-sharing-scam",
    "remote-access-scam",
    "fake-police-notice",
    "social-media-hack",
    "account-takeover",
    "sim-swap",
    "phishing-email",
    "sms-phishing",
    "fake-charity",
    "insurance-scam",
    "property-scam",
    "travel-booking-scam",
    "crypto-investment",
    "deepfake-scam",
    "relationship-scam",
    "impersonation-scam",
    "fake-government-scheme",
    "website-spoofing",
    "qr-payment-scam",
    "business-email-compromise",
    "refund-scam",
    "delivery-fee-scam",
    "fake-support-scam",
    "data-theft",
    "identity-theft",
]


def test_all_28_new_categories_present_in_official_types():
    for cat in REQUIRED_28_CATEGORIES:
        assert cat in OFFICIAL_SCAM_TYPES, f"Category '{cat}' is missing from OFFICIAL_SCAM_TYPES"
        assert cat in SCAM_CATEGORIES, f"Category '{cat}' is missing from SCAM_CATEGORIES metadata"
        meta = SCAM_CATEGORIES[cat]
        assert meta["id"] == cat
        assert len(meta["name"]) > 0
        assert len(meta["description"]) > 0


def test_existing_categories_preserved():
    existing_17 = [
        "digital-arrest", "fake-kyc-link", "upi-refund-qr", "investment-group",
        "courier-customs", "job-offer", "lottery-prize", "loan-app-harassment",
        "electricity-disconnection", "fake-customer-care", "otp-call",
        "sextortion", "bank-fraud", "whatsapp-scam", "phone-scam", "sms-fraud", "phishing"
    ]
    for cat in existing_17:
        assert cat in OFFICIAL_SCAM_TYPES
        assert normalize_scam_type(cat) == cat


def test_submit_report_with_all_new_categories():
    req = make_request()
    for cat in REQUIRED_28_CATEGORIES:
        payload = ReportCreate(
            identifier="9876543210",
            category="PHONE",
            scam_type=cat,
            pincode="560001",
        )
        res = submit_report(payload, req)
        assert res.report_id is not None
        assert res.case_status is not None

        # Verify DB persistence
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT scam_type FROM reports WHERE id = ?", (res.report_id,))
            row = cur.fetchone()
            assert row is not None
            assert row[0] == cat


def test_category_as_scam_type_submission():
    req = make_request()
    # Pass new category directly in the 'category' field
    payload = ReportCreate(
        identifier="9876543210",
        category="bank-account-freeze",
        pincode="560001",
    )
    res = submit_report(payload, req)
    assert res.report_id is not None
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT scam_type, category FROM reports WHERE id = ?", (res.report_id,))
        row = cur.fetchone()
        assert row[0] == "bank-account-freeze"
        assert row[1] == "BANK_ACCOUNT"


def test_invalid_category_rejected():
    req = make_request()
    payload = ReportCreate(
        identifier="9876543210",
        category="NON_EXISTENT_CATEGORY_XYZ",
        pincode="560001",
    )
    with pytest.raises(InvalidIdentifierError):
        submit_report(payload, req)


# ==============================================================================
# FEATURE 2: SCAM DESCRIPTION & EVIDENCE IMAGE TESTS
# ==============================================================================

def test_report_description_optional_and_persisted():
    req = make_request()

    # 1. Report without description succeeds
    p1 = ReportCreate(identifier="9876543211", category="PHONE", pincode="560001")
    r1 = submit_report(p1, req)
    assert r1.report_id is not None

    # 2. Report with description succeeds and persists
    test_desc = "Scammer called claiming my HDFC bank account was frozen and asked for OTP."
    p2 = ReportCreate(
        identifier="9876543212",
        category="PHONE",
        pincode="560001",
        description=test_desc,
    )
    r2 = submit_report(p2, req)
    assert r2.description == test_desc

    detail = get_report_detail(r2.report_id, req)
    assert detail["description"] == test_desc


def test_report_description_length_limit():
    req = make_request()
    long_desc = "A" * 2001
    payload = ReportCreate(
        identifier="9876543213",
        category="PHONE",
        pincode="560001",
        description=long_desc,
    )
    with pytest.raises(HTTPException) as exc:
        submit_report(payload, req)
    assert exc.value.status_code == 400
    assert "2,000 characters" in exc.value.detail


def test_report_description_xss_sanitization():
    req = make_request()
    xss_desc = "Warning! <script>alert('pwned')</script> Fake police call: <img src='x' onerror='steal()'> Pay ₹50,000"
    payload = ReportCreate(
        identifier="9876543214",
        category="PHONE",
        pincode="560001",
        description=xss_desc,
    )
    res = submit_report(payload, req)
    assert "<script>" not in res.description
    assert "<img" not in res.description
    assert "Fake police call" in res.description


def test_evidence_image_upload_and_sha256_generation():
    req = make_request()
    img_bytes = make_valid_png_bytes(width=16, height=16, pattern_seed=7)
    b64_str = base64.b64encode(img_bytes).decode("ascii")

    expected_sha256 = compute_sha256(img_bytes)

    payload = ReportCreate(
        identifier="9876543215",
        category="PHONE",
        pincode="560001",
        evidence_base64=b64_str,
        evidence_filename="screenshot.png",
    )
    res = submit_report(payload, req)
    assert res.report_id is not None
    assert res.has_screenshot is True
    assert res.evidence_id is not None

    # Check evidence row in DB
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT file_sha256, mime_type, file_size FROM evidence WHERE id = ?", (res.evidence_id,))
        row = cur.fetchone()
        assert row is not None
        assert row[0] == expected_sha256
        assert row[1] == "image/png"
        assert row[2] == len(img_bytes)


def test_evidence_image_size_limit_rejection():
    req = make_request()
    # 5.1 MB dummy bytes
    huge_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * (5 * 1024 * 1024 + 1000)
    b64_str = base64.b64encode(huge_bytes).decode("ascii")

    payload = ReportCreate(
        identifier="9876543216",
        category="PHONE",
        pincode="560001",
        evidence_base64=b64_str,
        evidence_filename="huge.png",
    )
    with pytest.raises(HTTPException) as exc:
        submit_report(payload, req)
    assert exc.value.status_code == 400
    assert "exceeds" in exc.value.detail.lower()


def test_evidence_unsupported_file_type_rejection():
    req = make_request()
    # Executable magic bytes MZ
    exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    b64_str = base64.b64encode(exe_bytes).decode("ascii")

    payload = ReportCreate(
        identifier="9876543217",
        category="PHONE",
        pincode="560001",
        evidence_base64=b64_str,
        evidence_filename="malware.exe",
    )
    with pytest.raises(HTTPException) as exc:
        submit_report(payload, req)
    assert exc.value.status_code == 400
    assert "unsupported" in exc.value.detail.lower()


# ==============================================================================
# FEATURE 3: MANIPULATION CHECKS & SHA-256 HASH COMPARISON TESTS
# ==============================================================================

def test_manipulation_engine_all_checks():
    img_bytes = make_valid_png_bytes(width=64, height=128, pattern_seed=3)  # 1:2 ratio portrait
    results = run_all_integrity_checks(img_bytes, claimed_filename="evidence.png", claimed_mime="image/png")

    assert "sha256_hash" in results
    assert results["sha256_hash"] == compute_sha256(img_bytes)
    assert "overall_status" in results
    assert "overall_summary" in results
    assert "disclaimer" in results

    checks = results["checks"]
    assert "crop" in checks
    assert "brightness" in checks
    assert "watermark" in checks
    assert "text" in checks
    assert "format" in checks

    # Disclaimers must be present
    assert "disclaimer" in checks["crop"]
    assert "disclaimer" in checks["brightness"]
    assert "watermark check is heuristic" in checks["watermark"]["disclaimer"].lower()
    assert "limited accuracy" in checks["text"]["disclaimer"].lower()
    assert "messaging apps" in checks["format"]["metadata_note"].lower()


def test_hash_comparison_matching_and_differing():
    bytes1 = make_valid_png_bytes(width=16, height=16, pattern_seed=1)
    bytes2 = make_valid_png_bytes(width=16, height=16, pattern_seed=2)

    hash1 = compute_sha256(bytes1)
    hash2 = compute_sha256(bytes2)

    # 1. Matching hashes
    match_res = compare_hashes(hash1, hash1)
    assert match_res["match"] is True
    assert "identical" in match_res["summary"].lower()

    # 2. Differing hashes
    diff_res = compare_hashes(hash1, hash2)
    assert diff_res["match"] is False
    assert "differ" in diff_res["summary"].lower()
    assert "alone does not prove malicious tampering" in diff_res["explanation"]


def test_admin_evidence_endpoints_and_authorization():
    req = make_request()
    img_bytes = make_valid_png_bytes(width=16, height=16, pattern_seed=9)
    b64_str = base64.b64encode(img_bytes).decode("ascii")

    rep = submit_report(
        ReportCreate(
            identifier="9876543218",
            category="PHONE",
            description="Admin review test scam description",
            evidence_base64=b64_str,
            evidence_filename="test_proof.png",
        ),
        req
    )

    # 1. Admin with valid token succeeds
    evidence_data = get_admin_report_evidence(
        report_id=rep.report_id,
        x_admin_token=settings.ADMIN_TOKEN,
    )
    assert evidence_data["file_sha256"] == compute_sha256(img_bytes)
    assert evidence_data["integrity_results"] is not None

    # 2. Normal user (missing token) receives 401
    with pytest.raises(HTTPException) as exc:
        get_admin_report_evidence(
            report_id=rep.report_id,
            x_admin_token=None,
        )
    assert exc.value.status_code == 401


def test_demo_vs_prod_storage_and_db_isolation(tmp_path):
    # Submit a report in demo mode
    demo_req = make_request(pov="demo")
    demo_bytes = make_valid_png_bytes(width=16, height=16, pattern_seed=42)
    demo_b64 = base64.b64encode(demo_bytes).decode("ascii")

    demo_rep = submit_report(
        ReportCreate(
            identifier="9876543219",
            category="PHONE",
            description="Demo isolated submission",
            evidence_base64=demo_b64,
            evidence_filename="demo_pic.png",
        ),
        demo_req
    )

    # Verify report is NOT in production DB
    with get_db_connection(settings.DATABASE_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM reports WHERE id = ?", (demo_rep.report_id,))
        assert cur.fetchone()[0] == 0

    # Verify report IS in demo DB
    with get_db_connection(settings.DEMO_DATABASE_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM reports WHERE id = ?", (demo_rep.report_id,))
        assert cur.fetchone()[0] == 1
