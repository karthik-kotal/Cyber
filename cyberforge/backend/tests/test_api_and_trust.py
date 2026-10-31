import os
import uuid
from unittest.mock import MagicMock
import pytest
from app.config import settings
from app.database import init_db
from app.schemas import (
    ReportCreate,
    ChallengeCreate,
    VerifiedBusinessCreate
)
from app.routes.reports import submit_report
from app.routes.lookup import lookup_identifier
from app.routes.challenges import create_challenge, list_challenges
from app.routes.alerts import get_alerts
from app.routes.admin import reset_database, add_verified_business, list_verified_businesses
from app.main import health_check
from app.normalize import InvalidIdentifierError
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


def test_health():
    res = health_check()
    assert res["status"] == "healthy"
    assert res["service"] == settings.PROJECT_NAME


def test_submit_valid_report():
    req = make_request("192.168.1.10")
    payload = ReportCreate(
        identifier="+91 98765 43210",
        scam_type="KYC_FRAUD",
        note="Scammer claimed SIM card was blocked",
        reporter_id="device_user_1",
        pincode="560001",
        loss_amount=5000.0
    )
    res = submit_report(payload, req)
    assert res.status == "ACCEPTED"
    assert res.distinct_reporters == 1
    assert res.case_status == "SUSPICIOUS"


def test_submit_invalid_report_rejected():
    req = make_request("192.168.1.10")
    payload = ReportCreate(
        identifier="not-a-number-junk",
        scam_type="LOTTERY"
    )
    with pytest.raises(InvalidIdentifierError):
        submit_report(payload, req)


def test_lookup_no_reports():
    res = lookup_identifier(identifier="9876543211")
    assert res.verdict == "NO_REPORTS"
    assert res.report_count == 0
    assert res.distinct_reporters == 0
    assert res.challenged is False
    assert "XXXXX" in res.display_value


def test_verified_business_never_classified_as_scam():
    # 1930 is seeded verified business
    res = lookup_identifier(identifier="1930")
    assert res.verdict == "VERIFIED_BUSINESS"
    assert res.display_value == "1930"
    assert res.evidence["verified"] is True

    # Try maliciously reporting 1930 multiple times from different reporters
    for i in range(5):
        req = make_request(f"10.0.0.{i+1}")
        submit_report(ReportCreate(
            identifier="1930",
            scam_type="PHISHING",
            reporter_id=f"attacker_{i}",
            note=f"Fake report {i}"
        ), req)

    # Lookup must still remain strictly VERIFIED_BUSINESS
    after = lookup_identifier(identifier="1930")
    assert after.verdict == "VERIFIED_BUSINESS"


def test_duplicate_reporter_collapse():
    target = "+91 9988776655"
    same_reporter = "same_device_uuid_123"

    for i in range(5):
        req = make_request(f"192.168.1.{i+10}")
        submit_report(ReportCreate(
            identifier=target,
            scam_type="OTP_SCAM",
            reporter_id=same_reporter,
            note=f"Report attempt {i}"
        ), req)

    lookup = lookup_identifier(identifier=target)
    assert lookup.report_count == 5
    assert lookup.distinct_reporters == 1
    assert lookup.verdict == "SUSPICIOUS"
    assert "XXXXX" in lookup.display_value


def test_identical_note_collapse():
    target = "+91 9123456780"
    identical_copy_paste_note = "Electricity power will be cut tonight call this officer immediately!"

    for i in range(4):
        req = make_request(f"172.16.{i}.5")
        submit_report(ReportCreate(
            identifier=target,
            scam_type="UTILITY_SCAM",
            reporter_id=f"bot_account_{i}",
            note=identical_copy_paste_note
        ), req)

    lookup = lookup_identifier(identifier=target)
    assert lookup.report_count == 4
    # All share identical note fingerprint -> collapsed to 1 cluster
    assert lookup.distinct_reporters == 1
    assert lookup.verdict == "SUSPICIOUS"


def test_ip_prefix_collapse():
    target = "+91 9333444555"
    # Same /24 IP subnet 192.168.1.X
    for i in range(4):
        req = make_request(f"192.168.1.{i+10}")
        submit_report(ReportCreate(
            identifier=target,
            scam_type="PHISHING",
            reporter_id=f"ip_sub_user_{i}",
            note=f"Different note {i}"
        ), req)

    lookup = lookup_identifier(identifier=target)
    assert lookup.report_count == 4
    assert lookup.distinct_reporters == 1
    assert lookup.verdict == "SUSPICIOUS"


def test_known_scam_threshold_and_unmasking():
    target = "+91 9811122233"

    # Reporter 1
    submit_report(ReportCreate(
        identifier=target,
        scam_type="JOB_FRAUD",
        reporter_id="independent_rep_1",
        note="Work from home part-time task scam on Telegram"
    ), make_request("10.0.1.5"))

    res1 = lookup_identifier(identifier=target)
    assert res1.distinct_reporters == 1
    assert res1.verdict == "SUSPICIOUS"
    assert "XXXXX" in res1.display_value

    # Reporter 2
    submit_report(ReportCreate(
        identifier=target,
        scam_type="JOB_FRAUD",
        reporter_id="independent_rep_2",
        note="Asked for 500 rupees registration fee for YouTube likes"
    ), make_request("10.0.2.6"))

    res2 = lookup_identifier(identifier=target)
    assert res2.distinct_reporters == 2
    assert res2.verdict == "SUSPICIOUS"
    assert "XXXXX" in res2.display_value

    # Reporter 3 (reaching threshold 3)
    submit_report(ReportCreate(
        identifier=target,
        scam_type="JOB_FRAUD",
        reporter_id="independent_rep_3",
        note="Frozen my account and demanded deposit to withdraw salary"
    ), make_request("10.0.3.7"))

    res3 = lookup_identifier(identifier=target)
    assert res3.distinct_reporters == 3
    assert res3.verdict == "KNOWN_SCAM"
    # Unmasked!
    assert res3.display_value == "+919811122233"


def test_challenge_behavior():
    target = "+91 9844455566"

    # Create 3 independent reports making it KNOWN_SCAM
    for i in range(3):
        submit_report(ReportCreate(
            identifier=target,
            scam_type="IMPERSONATION",
            reporter_id=f"legit_rep_{i}",
            note=f"Custom note about call {i}"
        ), make_request(f"10.0.{i+10}.1"))

    before = lookup_identifier(identifier=target)
    assert before.verdict == "KNOWN_SCAM"
    assert before.challenged is False

    # Submit a challenge
    chal = create_challenge(ChallengeCreate(
        identifier=target,
        challenger_name="ABC Logistics Telecom",
        reason="Official driver dispatch SIM card, falsely reported",
        proof_url="https://abclogistics.in/telecom-cert.pdf"
    ))
    assert chal.status == "UNDER_REVIEW"

    # After challenge: verdict must be capped at SUSPICIOUS and challenged == True
    after = lookup_identifier(identifier=target)
    assert after.verdict == "SUSPICIOUS"
    assert after.challenged is True
    assert after.distinct_reporters == 3


def test_challenged_identifier_without_reports():
    target = "+91 9777788899"

    create_challenge(ChallengeCreate(
        identifier=target,
        challenger_name="Test Challenger",
        reason="Proactive challenge"
    ))

    res = lookup_identifier(identifier=target)
    # A challenge does NOT convert NO_REPORTS into SUSPICIOUS
    assert res.verdict == "NO_REPORTS"
    assert res.challenged is True
    assert res.report_count == 0


def test_spike_and_new_type_alerts():
    target = "fastag-recharge-fake@okhdfcbank"
    pincode = "110001"

    for i in range(3):
        submit_report(ReportCreate(
            identifier=target,
            scam_type="FASTAG_FRAUD",
            reporter_id=f"user_alert_{i}",
            pincode=pincode,
            note=f"Phishing fastag message received {i}"
        ), make_request(f"10.0.{i}.1"))

    alerts_res = get_alerts(alert_type=None, pincode=None, limit=50)
    assert alerts_res.count >= 1

    alert_types = [a.type for a in alerts_res.alerts]
    assert "SPIKE" in alert_types or "NEW_TYPE" in alert_types


def test_admin_reset_protection():
    # Per PRD Rule 5: POST /admin/reset requires no login/token for judging
    res_no_token = reset_database(x_admin_token=None)
    assert res_no_token.ok is True
    assert res_no_token.status == "RESET_OK"

    # With invalid token -> 401
    with pytest.raises(HTTPException) as exc:
        reset_database(x_admin_token="wrong-token")
    assert exc.value.status_code == 401

    # With correct token -> 200
    res = reset_database(x_admin_token=settings.ADMIN_TOKEN)
    assert res.status == "RESET_OK"


def test_add_and_list_verified_businesses():
    new_biz = VerifiedBusinessCreate(
        identifier="18002584455",
        business_name="Bank of Baroda Toll Free",
        category="BANKING",
        official_website="https://bankofbaroda.in"
    )
    added = add_verified_business(new_biz, x_admin_token=settings.ADMIN_TOKEN)
    assert added.identifier == "18002584455"
    assert added.business_name == "Bank of Baroda Toll Free"

    all_biz = list_verified_businesses()
    ids = [b.identifier for b in all_biz]
    assert "18002584455" in ids


def test_challenged_verified_business_remains_verified():
    # 1930 is verified. Even if someone submits a challenge against 1930, verdict remains VERIFIED_BUSINESS
    chal = create_challenge(ChallengeCreate(
        identifier="1930",
        challenger_name="Disputer",
        reason="Disputing official helpline"
    ))
    assert chal.status == "UNDER_REVIEW"

    lookup = lookup_identifier(identifier="1930")
    assert lookup.verdict == "VERIFIED_BUSINESS"
    assert lookup.challenged is True
    assert lookup.display_value == "1930"


def test_challenged_identifier_receiving_new_reports():
    target = "+91 9555666777"
    # Challenge first
    create_challenge(ChallengeCreate(
        identifier=target,
        challenger_name="Store Owner",
        reason="Number was hijacked and recovered"
    ))

    # Add 4 independent reports
    for i in range(4):
        submit_report(ReportCreate(
            identifier=target,
            scam_type="IMPERSONATION",
            reporter_id=f"new_rep_{i}",
            note=f"Distinct incident description {i}"
        ), make_request(f"192.168.{i+1}.1"))

    lookup = lookup_identifier(identifier=target)
    # Despite 4 distinct reporters, verdict is strictly capped at SUSPICIOUS because of active challenge
    assert lookup.distinct_reporters == 4
    assert lookup.challenged is True
    assert lookup.verdict == "SUSPICIOUS"


def test_exact_lookup_fields():
    target = "+91 9111222333"
    submit_report(ReportCreate(
        identifier=target,
        scam_type="LOTTERY",
        reporter_id="unique_user",
        pincode="110001",
        loss_amount=1200.0,
        note="Won lottery scam SMS"
    ), make_request("1.2.3.4"))

    lookup = lookup_identifier(identifier=target)
    # Check all exact contract fields
    d = lookup.model_dump()
    expected_fields = {
        "verdict",
        "report_count",
        "distinct_reporters",
        "display_value",
        "challenged",
        "first_seen",
        "last_seen",
        "scam_type",
        "evidence"
    }
    assert set(d.keys()) == expected_fields
    assert d["verdict"] == "SUSPICIOUS"
    assert d["report_count"] == 1
    assert d["distinct_reporters"] == 1
    assert d["scam_type"] == "LOTTERY"
    assert d["evidence"]["total_reported_loss_inr"] == 1200.0


def test_transactional_rollback_on_failure(monkeypatch):
    from app.routes import reports
    target = "+91 9999888877"

    # Simulate an unexpected database error in trust engine
    def broken_evaluate(*args, **kwargs):
        raise RuntimeError("Simulated mid-transaction failure")

    monkeypatch.setattr(reports, "evaluate_trust", broken_evaluate)

    with pytest.raises(RuntimeError):
        submit_report(ReportCreate(
            identifier=target,
            scam_type="OTP_SCAM",
            note="Test transactional integrity",
            reporter_id="tx_user"
        ), make_request("10.0.0.1"))

    # Verify that the report was NOT committed to the database
    with reports.get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM reports WHERE identifier = '+919999888877'")
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT COUNT(*) FROM cases WHERE identifier = '+919999888877'")
        assert cur.fetchone()[0] == 0

