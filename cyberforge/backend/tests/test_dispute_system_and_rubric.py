import os
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from app.config import settings
from app.database import init_db
from app.schemas import ReportCreate, ChallengeCreate
from app.routes.reports import submit_report
from app.routes.lookup import lookup_identifier
from app.routes.challenges import create_challenge
from app.routes.alerts import get_alerts
from app.routes.admin import reset_database


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


def test_dispute_valid_reference_id_accepted():
    """A valid report Reference ID is accepted for dispute."""
    rep_resp = submit_report(
        ReportCreate(
            category="PHONE",
            identifier="9108128632",
            pincode="560102"
        ),
        make_request("10.0.0.1")
    )
    ref_id = rep_resp.report_id
    assert ref_id is not None

    ch_resp = create_challenge(
        ChallengeCreate(
            reference_id=ref_id,
            reason="I am the owner and this number is not used for fraud",
            claimant_name="Legit Owner"
        )
    )
    assert ch_resp.status == "under_review"
    assert ch_resp.reference_id == ref_id
    assert ch_resp.report_id == ref_id

    # Verify lookup shows challenged status and disputed flag on that report
    lookup_res = lookup_identifier(identifier="9108128632", type="phone")
    assert lookup_res.challenged is True
    reports = lookup_res.evidence.get("reports", [])
    assert len(reports) == 1
    assert reports[0]["id"] == ref_id
    assert reports[0]["is_disputed"] is True


def test_dispute_rejects_missing_reference_id():
    """Missing or empty reference ID is rejected with HTTP 400."""
    with pytest.raises(HTTPException) as exc:
        create_challenge(ChallengeCreate(reference_id="", reason="Missing ID"))
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        create_challenge(ChallengeCreate(reference_id=None, reason="Missing ID"))
    assert exc.value.status_code == 400


def test_dispute_rejects_phone_number_as_target():
    """Phone number passed as dispute target is rejected with HTTP 400."""
    phone_numbers = ["9108128632", "+919108128632", "09108128632", "+91 98765 43210"]
    for phone in phone_numbers:
        with pytest.raises(HTTPException) as exc:
            create_challenge(ChallengeCreate(reference_id=phone, reason="Testing rejection"))
        assert exc.value.status_code == 400
        assert "phone number" in exc.value.detail.lower()


def test_dispute_rejects_bank_account_as_target():
    """Bank account numbers passed as dispute target are rejected with HTTP 400."""
    bank_accs = ["123456789012", "ACC:123456789012", "SBIN0001234:12345678901"]
    for acc in bank_accs:
        with pytest.raises(HTTPException) as exc:
            create_challenge(ChallengeCreate(reference_id=acc, reason="Testing bank rejection"))
        assert exc.value.status_code == 400
        assert "bank account" in exc.value.detail.lower()


def test_dispute_rejects_upi_and_email_as_target():
    """UPI ID or email address passed as dispute target is rejected with HTTP 400."""
    ident_targets = ["scammer@paytm", "user@okhdfcbank", "phisher@bad-domain.com"]
    for ident in ident_targets:
        with pytest.raises(HTTPException) as exc:
            create_challenge(ChallengeCreate(reference_id=ident, reason="Testing UPI rejection"))
        assert exc.value.status_code == 400
        assert "upi id" in exc.value.detail.lower() or "email" in exc.value.detail.lower()


def test_dispute_rejects_url_and_whatsapp_as_target():
    """URLs and WhatsApp links passed as dispute target are rejected with HTTP 400."""
    links = [
        "https://scam-site.in/verify",
        "http://phishing.com",
        "https://wa.me/919876543210",
        "scam-portal.com/login"
    ]
    for link in links:
        with pytest.raises(HTTPException) as exc:
            create_challenge(ChallengeCreate(reference_id=link, reason="Testing URL rejection"))
        assert exc.value.status_code == 400
        assert "url" in exc.value.detail.lower() or "website" in exc.value.detail.lower()


def test_dispute_rejects_nonexistent_reference_id():
    """Non-existent report reference ID returns HTTP 404."""
    fake_uuid = str(uuid.uuid4())
    with pytest.raises(HTTPException) as exc:
        create_challenge(ChallengeCreate(reference_id=fake_uuid, reason="Fake ID"))
    assert exc.value.status_code == 404
    assert "not found" in exc.value.detail.lower()


def test_dispute_all_supported_categories():
    """Tests dispute flow for every supported category using its generated Reference ID."""
    categories = [
        ("PHONE", "9876543210"),
        ("BANK_ACCOUNT", "1234567890"),
        ("UPI", "scammer@paytm"),
        ("URL", "https://scam-site.in/portal"),
        ("WEBSITE", "scam-site2.in/verify"),
        ("WHATSAPP", "https://wa.me/919876543211"),
        ("SMS", "VM-FAKSMS"),
        ("EMAIL", "phisher@bad-domain.com"),
    ]

    for cat, ident in categories:
        resp = submit_report(
            ReportCreate(
                category=cat,
                identifier=ident,
                pincode="560102"
            ),
            make_request("10.0.0.1")
        )
        assert resp.status == "ACCEPTED"
        ref_id = resp.report_id
        assert ref_id is not None

        # Dispute the report using Reference ID
        ch_resp = create_challenge(
            ChallengeCreate(
                reference_id=ref_id,
                reason=f"Disputing false report for {cat}"
            )
        )
        assert ch_resp.status == "under_review"
        assert ch_resp.reference_id == ref_id


def test_dispute_affects_only_selected_report_and_preserves_evidence():
    """Disputing one report does not delete reports, does not remove evidence, and does not affect other reports."""
    target_phone = "9812345678"

    # Report 1
    rep1 = submit_report(
        ReportCreate(
            category="PHONE",
            identifier=target_phone,
            pincode="560102",
            amount_lost_inr=1500.0
        ),
        make_request("10.0.0.1")
    )
    ref1 = rep1.report_id

    # Report 2
    rep2 = submit_report(
        ReportCreate(
            category="PHONE",
            identifier=target_phone,
            pincode="560102",
            amount_lost_inr=3000.0
        ),
        make_request("10.0.0.2")
    )
    ref2 = rep2.report_id

    # Dispute ONLY Report 1
    create_challenge(
        ChallengeCreate(
            reference_id=ref1,
            reason="Mistaken identity for report 1"
        )
    )

    # Check lookup
    lookup = lookup_identifier(identifier=target_phone, type="phone")
    assert lookup.report_count == 2, "Dispute must NOT delete the report or reduce report count"
    ev = lookup.evidence
    assert ev["total_reported_loss_inr"] == 4500.0, "Evidence / loss amount must be preserved"
    reports = ev["reports"]
    assert len(reports) == 2

    # Verify Report 1 is disputed but Report 2 is NOT
    r1 = next(r for r in reports if r["id"] == ref1)
    r2 = next(r for r in reports if r["id"] == ref2)
    assert r1["is_disputed"] is True
    assert r2["is_disputed"] is False


def test_privacy_guarantees_in_lookup():
    """Lookup result strictly preserves reporter privacy and shows privacy statement."""
    resp = submit_report(
        ReportCreate(
            category="PHONE",
            identifier="9844433221",
            pincode="560102",
            reporter_id="confidential_user_42",
            note="Private reporter notes about cyber fraud"
        ),
        make_request("198.51.100.23")
    )

    lookup = lookup_identifier(identifier="9844433221", type="phone")
    ev = lookup.evidence
    reports = ev["reports"]
    assert len(reports) == 1
    rep = reports[0]

    # Confidential reporter data must NEVER be exposed
    assert "reporter_id" not in rep
    assert "confidential_user_42" not in str(lookup.model_dump())
    assert "198.51.100.23" not in str(lookup.model_dump())
    assert "Private reporter notes" not in str(lookup.model_dump())

    # Mandatory privacy notice
    assert "Reports are anonymous" in ev.get("privacy_notice", "")


def test_sybil_prevention_single_reporter_and_same_wifi():
    """Repeated reports from one person or 22 accounts on one Wi-Fi do not make a number KNOWN_SCAM."""
    target_number = "9877788899"

    # 1. Same reporter submitting 10 times
    for i in range(10):
        submit_report(
            ReportCreate(
                category="PHONE",
                identifier=target_number,
                reporter_id="lone_spammer",
                pincode="560102",
                note=f"Report attempt {i}"
            ),
            make_request("10.0.0.1")
        )

    lookup1 = lookup_identifier(identifier=target_number, type="phone")
    assert lookup1.report_count == 10
    assert lookup1.distinct_reporters == 1
    assert lookup1.verdict == "SUSPICIOUS", "Single reporter spam must NEVER become KNOWN_SCAM"

    # 2. 22 accounts on the same Wi-Fi subnet (192.168.1.X)
    target_bakery = "9866655544"
    for i in range(22):
        submit_report(
            ReportCreate(
                category="PHONE",
                identifier=target_bakery,
                reporter_id=f"wifi_device_{i}",
                pincode="560038"
            ),
            make_request(f"192.168.1.{i+1}")
        )

    lookup2 = lookup_identifier(identifier=target_bakery, type="phone")
    assert lookup2.report_count == 22
    assert lookup2.distinct_reporters == 1
    assert lookup2.verdict == "SUSPICIOUS", "Same Wi-Fi devices must NOT become KNOWN_SCAM"


def test_false_reports_never_trigger_alerts():
    """Single reporter spam does NOT trigger a SPIKE alert."""
    pin = "560025"

    # Single reporter submits 5 reports in 24 hours
    for i in range(5):
        submit_report(
            ReportCreate(
                category="PHONE",
                identifier=f"98111000{i:02d}",
                reporter_id="single_fraud_reporter",
                pincode=pin
            ),
            make_request("10.0.0.5")
        )

    # Alerts query
    alerts_resp = get_alerts(pincode=pin)
    spike_alerts = [a for a in alerts_resp.alerts if a.type == "SPIKE" and a.pincode == pin]
    assert len(spike_alerts) == 0, "Spam from 1 single reporter must NOT trigger a SPIKE alert"

