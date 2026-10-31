import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from app.config import settings
from app.database import init_db, get_db_connection
from app.schemas import ReportCreate, ChallengeCreate
from app.routes.reports import submit_report
from app.routes.lookup import lookup_identifier
from app.routes.map import get_map
from app.routes.alerts import get_alerts
from app.routes.admin import reset_database
from app.routes.challenges import create_challenge
from app.license import license_manager, LicensePayload, upload_license, get_license, generate_license_signature
from app.areas import APPENDIX_B_AREAS, is_valid_pincode
from app.verified import APPENDIX_C_VERIFIED
from app.normalize import normalize_identifier, mask_identifier, normalize_scam_type, InvalidIdentifierError
from unittest.mock import MagicMock
from fastapi import HTTPException


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    db_file = str(tmp_path / f"test_{uuid.uuid4().hex}.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)
    settings.DATABASE_PATH = db_file
    init_db(db_file)
    reset_database()
    # Reset license to valid
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    sig = generate_license_signature("Demo Bank", future)
    license_manager.set_license("Demo Bank", future, sig)
    return db_file


def make_request(ip: str = "127.0.0.1"):
    req = MagicMock()
    req.client.host = ip
    return req


# --- 1. PRD Normalization Tests (Pages 8-9) ---

def test_prd_phone_normalization():
    examples = [
        ("+91 98765 43210", "+919876543210"),
        ("09876543210", "+919876543210"),
        ("98765-43210", "+919876543210"),
        ("919876543210", "+919876543210"),
    ]
    for raw, expected in examples:
        norm = normalize_identifier(raw, "phone")
        assert norm.normalized_value == expected
        assert norm.identifier_type == "phone"


def test_prd_helplines_and_toll_numbers():
    assert normalize_identifier("1930", "phone").normalized_value == "1930"
    assert normalize_identifier("1909", "phone").normalized_value == "1909"
    assert normalize_identifier("1800 1600", "phone").normalized_value == "18001600"
    assert normalize_identifier("1860 419 5555", "phone").normalized_value == "18604195555"
    assert normalize_identifier("1860 266 2666", "phone").normalized_value == "18602662666"


def test_prd_upi_normalization():
    assert normalize_identifier("Ravi12@OKAXIS", "upi").normalized_value == "ravi12@okaxis"


def test_prd_url_normalization():
    raw_url = "http://www.sbi-kyc.in/pay?utm=sms"
    norm = normalize_identifier(raw_url, "url")
    assert norm.normalized_value == "https://sbi-kyc.in/pay"


def test_prd_sms_sender_normalization():
    assert normalize_identifier("VM-HDFCBK", "sender_id").normalized_value == "HDFCBK"
    assert normalize_identifier("AD-HDFCBK", "sender_id").normalized_value == "HDFCBK"
    assert normalize_identifier("HDFCBK", "sender_id").normalized_value == "HDFCBK"


def test_prd_scam_type_unknown_treated_as_other():
    assert normalize_scam_type("digital-arrest") == "digital-arrest"
    assert normalize_scam_type("lottery-prize") == "lottery-prize"
    assert normalize_scam_type("completely-unknown-novel-scam") == "other"
    assert normalize_scam_type("") == "other"


def test_prd_masking_rules():
    assert mask_identifier("+919876543210", "phone") == "98XXXXX210"
    assert mask_identifier("ravi12@okaxis", "upi") == "r***@okaxis"
    assert mask_identifier("https://sbi-kyc.in/pay", "url") == "sbi***.in/..."
    assert mask_identifier("HDFCBK", "sender_id") == "HD****"


# --- 2. The Four PRD Attack Tests (Page 2 & 5) ---

def test_attack_1_forty_friends_reporting_real_bakery():
    # Fresh Bakes (+91 80 4100 2233) is an official Appendix C verified business
    bakery_number = "+91 80 4100 2233"
    
    # 40 friends submit reports accusing it of digital-arrest and other scams
    for i in range(40):
        submit_report(ReportCreate(
            identifier_value=bakery_number,
            identifier_type="phone",
            scam_type="digital-arrest",
            reporter_id=f"friend_{i}",
            ip_prefix=f"49.207.{i}.0",
            pincode="560038",
            note=f"Fake defamation note {i}"
        ), make_request(f"49.207.{i}.10"))

    # Lookup must NEVER become KNOWN_SCAM - it must strictly return VERIFIED_BUSINESS
    lookup = lookup_identifier(type="phone", value=bakery_number)
    assert lookup.verdict == "VERIFIED_BUSINESS"
    assert lookup.display_value == "+91 80 4100 2233"


def test_attack_2_twenty_two_accounts_same_wifi():
    target = "+91 9777711111"
    shared_wifi_ip_prefix = "103.21.58"

    # One person makes 22 accounts from the same Wi-Fi
    for i in range(22):
        submit_report(ReportCreate(
            identifier_value=target,
            identifier_type="phone",
            scam_type="job-offer",
            reporter_id=f"wifi_bot_account_{i}",
            ip_prefix=shared_wifi_ip_prefix,
            pincode="560102",
            note="Fake bot report"
        ), make_request("103.21.58.12"))

    lookup = lookup_identifier(type="phone", value=target)
    assert lookup.report_count == 22
    # Must collapse to 1 independent source
    assert lookup.distinct_reporters == 1
    assert lookup.verdict == "SUSPICIOUS"  # Capped at SUSPICIOUS (< 3 distinct reporters)
    assert lookup.display_value == "97XXXXX111"  # Masked


def test_attack_3_one_reporter_submitting_six_reports():
    target = "+91 9666622222"
    spammer_id = "r_spammer_99"

    for i in range(6):
        submit_report(ReportCreate(
            identifier_value=target,
            identifier_type="phone",
            scam_type="otp-call",
            reporter_id=spammer_id,
            ip_prefix=f"10.0.{i}.0",
            pincode="560100",
            note=f"Attempt {i}"
        ), make_request(f"10.0.{i}.5"))

    lookup = lookup_identifier(type="phone", value=target)
    assert lookup.report_count == 6
    assert lookup.distinct_reporters == 1
    assert lookup.verdict == "SUSPICIOUS"
    assert lookup.display_value == "96XXXXX222"  # Masked


def test_attack_4_junk_identifiers_rejected_400():
    junk_list = ["12345", "test", "scam", "!@#$%", "12", "hello"]
    for junk in junk_list:
        with pytest.raises((InvalidIdentifierError, HTTPException)):
            submit_report(ReportCreate(
                identifier_value=junk,
                identifier_type="phone",
                scam_type="lottery-prize",
                pincode="560102"
            ), make_request())


# --- 3. Appendix B Area Dataset Tests ---

def test_appendix_b_all_25_areas():
    assert len(APPENDIX_B_AREAS) == 25
    # Spot check specific areas from Appendix B
    assert APPENDIX_B_AREAS["560102"]["locality"] == "HSR Layout"
    assert APPENDIX_B_AREAS["560102"]["city"] == "Bengaluru"
    assert APPENDIX_B_AREAS["400050"]["locality"] == "Bandra West"
    assert APPENDIX_B_AREAS["400050"]["city"] == "Mumbai"
    assert APPENDIX_B_AREAS["110016"]["locality"] == "Hauz Khas"
    assert APPENDIX_B_AREAS["110016"]["city"] == "Delhi"
    assert APPENDIX_B_AREAS["682030"]["locality"] == "Kakkanad"
    assert APPENDIX_B_AREAS["682030"]["city"] == "Kochi"


# --- 4. Appendix C Verified Entities Tests ---

def test_appendix_c_all_verified_entities():
    for item in APPENDIX_C_VERIFIED:
        raw_val = item["raw"]
        lookup = lookup_identifier(type=item["type"], value=raw_val)
        assert lookup.verdict == "VERIFIED_BUSINESS"
        assert lookup.challenged is False


# --- 5. Map & Radius Tests (Page 10-11) ---

def test_map_clusters_and_seven_day_filtering():
    now = datetime.now(timezone.utc)
    recent_time = (now - timedelta(days=2)).isoformat()
    old_time = (now - timedelta(days=15)).isoformat()  # Over 7 days ago

    # Submit 3 reports in HSR Layout within 7 days
    for i in range(3):
        submit_report(ReportCreate(
            identifier_value=f"+91 91111222{i:02d}",
            identifier_type="phone",
            scam_type="digital-arrest",
            reporter_id=f"map_rep_{i}",
            pincode="560102",
            occurred_at=recent_time
        ), make_request(f"1.1.{i}.1"))

    # Submit 1 old report (15 days ago) in HSR Layout
    submit_report(ReportCreate(
        identifier_value="+91 9111122299",
        identifier_type="phone",
        scam_type="digital-arrest",
        reporter_id="old_rep",
        pincode="560102",
        occurred_at=old_time
    ), make_request("1.1.99.1"))

    # Query map for HSR Layout
    map_res = get_map(pincode="560102", days=7, radius_km=5)
    assert len(map_res.clusters) >= 1
    hsr_cluster = [c for c in map_res.clusters if c.pincode == "560102"][0]
    # Only the 3 recent reports are in the 7-day window
    assert hsr_cluster.count == 3
    assert hsr_cluster.locality == "HSR Layout"
    assert hsr_cluster.lat == 12.9116
    assert hsr_cluster.lng == 77.6473


# --- 6. Alerts Tests (Page 11) ---

def test_spike_alert_condition():
    now = datetime.now(timezone.utc)
    t_recent = (now - timedelta(hours=2)).isoformat()
    pincode = "560102"

    # Submit 5 reports in last 24h (zero baseline -> double 0 is 0, count >= 5)
    for i in range(5):
        submit_report(ReportCreate(
            identifier_value=f"+91 93333444{i:02d}",
            identifier_type="phone",
            scam_type="job-offer",
            reporter_id=f"alert_rep_{i}",
            pincode=pincode,
            occurred_at=t_recent
        ), make_request(f"2.2.{i}.1"))

    alerts_res = get_alerts(pincode=pincode)
    spike_alerts = [a for a in alerts_res.alerts if a.get("type") == "SPIKE"]
    assert len(spike_alerts) >= 1
    assert spike_alerts[0]["count"] >= 5
    assert spike_alerts[0]["window"] == "24h"


def test_new_type_alert_condition():
    now = datetime.now(timezone.utc)
    t_recent = (now - timedelta(hours=1)).isoformat()
    pincode = "560034"  # Koramangala

    submit_report(ReportCreate(
        identifier_value="+91 9555566677",
        identifier_type="phone",
        scam_type="sextortion",
        reporter_id="unique_victim",
        pincode=pincode,
        occurred_at=t_recent
    ), make_request("3.3.3.3"))

    alerts_res = get_alerts(pincode=pincode)
    new_type_alerts = [a for a in alerts_res.alerts if a.get("type") == "NEW_TYPE"]
    assert len(new_type_alerts) >= 1
    assert new_type_alerts[0]["scam_type"] == "sextortion"
    assert new_type_alerts[0]["pincode"] == pincode


# --- 7. License Expiration Demo Tests (Pages 3-4) ---

def test_license_lifecycle_demo():
    # 1. Active license
    status = get_license()
    assert status["active"] is True
    assert status["status"] == "ACTIVE"

    # 2. Upload license that is already expired (simulating 5 min expiry)
    past_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    past_sig = generate_license_signature("Demo Bank", past_time)
    
    upload_license(LicensePayload(
        licensee="Demo Bank",
        expires_at=past_time,
        signature=past_sig
    ))

    # Check license status is expired
    expired_status = get_license()
    assert expired_status["active"] is False
    assert expired_status["status"] == "EXPIRED"

    # 3. Upload renewed license
    future_time = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    renewed_sig = generate_license_signature("Demo Bank", future_time)
    
    upload_license(LicensePayload(
        licensee="Demo Bank",
        expires_at=future_time,
        signature=renewed_sig
    ))

    renewed_status = get_license()
    assert renewed_status["active"] is True
    assert renewed_status["status"] == "ACTIVE"


# --- 8. Challenges & Verdict Capping ---

def test_challenge_workflow():
    target = "+91 9877766655"
    
    # 3 independent reports making it KNOWN_SCAM
    rep_ids = []
    for i in range(3):
        rep = submit_report(ReportCreate(
            identifier_value=target,
            identifier_type="phone",
            scam_type="digital-arrest",
            reporter_id=f"victim_{i}",
            pincode="560102"
        ), make_request(f"8.8.{i}.1"))
        rep_ids.append(rep.report_id)

    before = lookup_identifier(type="phone", value=target)
    assert before.verdict == "KNOWN_SCAM"
    assert before.challenged is False

    # Submit challenge with report Reference ID
    chal_res = create_challenge(ChallengeCreate(
        reference_id=rep_ids[0],
        claimant_name="Official Dispatch",
        contact_email="help@dispatch.in",
        proof_note="Legitimate company fleet SIM"
    ))
    assert chal_res.status == "under_review"

    # Lookup must show challenged: true and verdict capped at SUSPICIOUS
    after = lookup_identifier(type="phone", value=target)
    assert after.challenged is True
    assert after.verdict == "SUSPICIOUS"
