import os
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import pytest
from app.config import settings
from app.database import init_db
from app.schemas import ReportCreate
from app.routes.reports import submit_report
from app.routes.lookup import lookup_identifier
from app.routes.map import get_map
from app.routes.alerts import get_alerts
from app.routes.admin import reset_database
from app.normalize import normalize_identifier, mask_identifier, InvalidIdentifierError
from app.areas import (
    resolve_pincode_area,
    validate_all_coordinates,
    get_all_mapped_areas,
    APPENDIX_B_AREAS,
    EXTENDED_AREAS
)


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


def test_supported_categories_acceptance():
    """All supported categories are accepted and their scam_types are correctly derived."""
    categories = [
        ("PHONE", "9876543210", "phone-scam"),
        ("BANK_ACCOUNT", "1234567890", "bank-fraud"),
        ("UPI", "scammer@paytm", "upi-refund-qr"),
        ("URL", "https://scam-site.in/portal", "fake-kyc-link"),
        ("WEBSITE", "scam-site2.in/verify", "fake-kyc-link"),
        ("WHATSAPP", "https://wa.me/919876543211", "whatsapp-scam"),
        ("SMS", "VM-HDFCBK", "sms-fraud"),
        ("EMAIL", "phisher@bad-domain.com", "phishing"),
        ("OTHER", "custom-fraudster-handle", "other"),
    ]

    for cat, ident, expected_scam_type in categories:
        resp = submit_report(
            ReportCreate(
                category=cat,
                identifier=ident,
                pincode="560102"
            ),
            make_request()
        )
        assert resp.status == "ACCEPTED"
        case_id = resp.case_id

        # Verify lookup returns expected scam_type
        lookup_resp = lookup_identifier(identifier=case_id)
        assert lookup_resp.scam_type == expected_scam_type, (
            f"Category {cat} should have scam_type '{expected_scam_type}', got '{lookup_resp.scam_type}'"
        )


def test_unsupported_category_rejection():
    """Unsupported categories are strictly rejected with InvalidIdentifierError."""
    with pytest.raises(InvalidIdentifierError, match="Unsupported report category"):
        submit_report(
            ReportCreate(
                category="CRYPTO_WALLET",
                identifier="0x71C...9A",
                pincode="560102"
            ),
            make_request()
        )


def test_bank_account_vs_phone_separation():
    """
    Same 10-digit value (e.g. 9108128632) reported as PHONE and BANK_ACCOUNT
    must normalize to different case keys and never collide or merge.
    """
    ident_value = "9108128632"

    # Report as PHONE
    phone_resp = submit_report(
        ReportCreate(
            category="PHONE",
            identifier=ident_value,
            pincode="560102"
        ),
        make_request("10.0.0.1")
    )
    assert phone_resp.case_id == f"+91{ident_value}"
    assert phone_resp.merged is False

    # Report as BANK_ACCOUNT
    bank_resp = submit_report(
        ReportCreate(
            category="BANK_ACCOUNT",
            identifier=ident_value,
            pincode="560102"
        ),
        make_request("10.0.0.2")
    )
    assert bank_resp.case_id == f"ACC:{ident_value}"
    assert bank_resp.merged is False, "Bank account must NOT merge into phone number case!"

    # Bank account masked format: ACC:XXXXXX8632
    assert bank_resp.display_value == "ACC:XXXXXX8632"

    # Lookup bank account
    bank_lookup = lookup_identifier(identifier=ident_value, type="bank_account")
    assert bank_lookup.report_count == 1
    assert bank_lookup.scam_type == "bank-fraud"

    # Lookup phone
    phone_lookup = lookup_identifier(identifier=ident_value, type="phone")
    assert phone_lookup.report_count == 1
    assert phone_lookup.scam_type == "phone-scam"


def test_bank_account_rejects_country_code_plus_91():
    """Bank account numbers cannot start with country code +91."""
    with pytest.raises(InvalidIdentifierError):
        normalize_identifier("+919876543210", expected_type="bank_account")


def test_whatsapp_link_and_phone():
    """WhatsApp supports both phone number and clean wa.me / api.whatsapp.com links."""
    # 1. Phone number under WhatsApp
    res_phone = normalize_identifier("9876543210", expected_type="whatsapp")
    assert res_phone.normalized_value == "+919876543210"
    assert res_phone.identifier_type == "whatsapp"

    # 2. wa.me link
    res_link = normalize_identifier("https://wa.me/919876543210", expected_type="whatsapp")
    assert res_link.normalized_value == "https://wa.me/919876543210"
    assert res_link.identifier_type == "whatsapp"

    # 3. Reject ordinary website passed as WhatsApp
    with pytest.raises(InvalidIdentifierError):
        normalize_identifier("https://google.com", expected_type="whatsapp")


def test_url_tracking_param_stripping():
    """URLs automatically strip tracking parameters while keeping critical paths."""
    dirty_url = "https://www.scam-bank.com/login.php?user=victim&utm_source=facebook&fbclid=abcd123&si=xyz"
    res = normalize_identifier(dirty_url, expected_type="url")
    assert res.normalized_value == "https://scam-bank.com/login.php?user=victim"
    assert "utm_source" not in res.normalized_value
    assert "fbclid" not in res.normalized_value
    assert "si=" not in res.normalized_value


def test_nationwide_pincode_coordinates():
    """Verifies that non-Bengaluru and nationwide pincodes resolve to centroids."""
    # Ballari (Karnataka)
    ballari = resolve_pincode_area("583101")
    assert ballari is not None
    assert ballari["is_mapped"] is True
    assert ballari["city"] == "Ballari"
    assert ballari["lat"] == 15.1394
    assert ballari["lng"] == 76.9214

    # Anantapur (Andhra Pradesh)
    anantapur = resolve_pincode_area("515001")
    assert anantapur is not None
    assert anantapur["is_mapped"] is True
    assert anantapur["city"] == "Anantapur"

    # Kurnool (Andhra Pradesh)
    kurnool = resolve_pincode_area("518001")
    assert kurnool is not None
    assert kurnool["is_mapped"] is True
    assert kurnool["city"] == "Kurnool"

    # Mumbai GPO (Maharashtra)
    mumbai = resolve_pincode_area("400001")
    assert mumbai is not None
    assert mumbai["is_mapped"] is True
    assert mumbai["city"] == "Mumbai"

    # Delhi Connaught Place
    delhi = resolve_pincode_area("110001")
    assert delhi is not None
    assert delhi["is_mapped"] is True

    # Validate all coordinates are strictly within India bounding box
    assert validate_all_coordinates() is True


def test_map_endpoint_includes_nationwide_reports():
    """Reports from Ballari, Anantapur, etc. are plotted on the map with valid coordinates."""
    submit_report(
        ReportCreate(
            category="BANK_ACCOUNT",
            identifier="1122334455",
            pincode="583101"  # Ballari
        ),
        make_request("10.0.0.1")
    )

    submit_report(
        ReportCreate(
            category="WHATSAPP",
            identifier="https://wa.me/919876543299",
            pincode="515001"  # Anantapur
        ),
        make_request("10.0.0.2")
    )

    resp = get_map(days=30)
    clusters_by_pin = {c.pincode: c for c in resp.clusters}
    assert "583101" in clusters_by_pin
    assert clusters_by_pin["583101"].city == "Ballari"
    assert clusters_by_pin["583101"].top_scam_type == "bank-fraud"

    assert "515001" in clusters_by_pin
    assert clusters_by_pin["515001"].city == "Anantapur"
    assert clusters_by_pin["515001"].top_scam_type == "whatsapp-scam"


def test_unmapped_pincode_diagnostics():
    """Reports with a valid 6-digit pincode that is not in the centroid registry appear in diagnostics."""
    submit_report(
        ReportCreate(
            category="PHONE",
            identifier="9876543210",
            pincode="999999"  # Not in registered centroids
        ),
        make_request()
    )

    resp = get_map(days=30)
    assert resp.diagnostics.unmapped_reports_count >= 1
    assert "999999" in resp.diagnostics.unmapped_pincodes
    assert any(u.pincode == "999999" for u in resp.unmapped)


def test_alerts_preserve_category_scam_type():
    """SPIKE alert for bank fraud preserves 'bank-fraud' as scam_type, not 'other'."""
    pincode = "583101"
    # Submit 3 bank fraud reports to trigger SPIKE threshold
    for i in range(3):
        submit_report(
            ReportCreate(
                category="BANK_ACCOUNT",
                identifier=f"100000000{i}",
                pincode=pincode,
                reporter_id=f"rep_{i}"
            ),
            make_request(f"10.0.0.{i+1}")
        )

    resp = get_alerts()
    spike_alerts = [a for a in resp.alerts if a.pincode == pincode and a.type == "SPIKE"]
    assert len(spike_alerts) > 0
    assert spike_alerts[0].scam_type == "bank-fraud"
