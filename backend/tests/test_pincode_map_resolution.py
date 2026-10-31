import os
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import pytest
from app.config import settings
from app.database import init_db
from app.schemas import ReportCreate
from app.routes.reports import submit_report
from app.routes.map import get_map
from app.routes.lookup import lookup_identifier
from app.routes.admin import reset_database
from app.areas import (
    is_valid_pincode,
    resolve_pincode_area,
    get_area_by_pincode,
    APPENDIX_B_AREAS,
    EXTENDED_AREAS,
    PINCODE_ALIASES,
)
from app.normalize import InvalidIdentifierError


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    db_file = str(tmp_path / f"test_map_{uuid.uuid4().hex}.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)
    settings.DATABASE_PATH = db_file
    init_db(db_file)
    reset_database(x_admin_token=settings.ADMIN_TOKEN)
    return db_file


def make_request(ip: str = "127.0.0.1"):
    req = MagicMock()
    req.client.host = ip
    return req


def test_1_existing_supported_pincode_560102():
    """1. Existing supported pincode 560102 (HSR Layout) resolves to valid coordinates."""
    area = resolve_pincode_area("560102")
    assert area is not None
    assert area["is_mapped"] is True
    assert area["locality"] == "HSR Layout"
    assert area["city"] == "Bengaluru"
    assert area["lat"] == 12.9116
    assert area["lng"] == 77.6473


def test_2_existing_supported_pincode_560038():
    """2. Existing supported pincode 560038 (Indiranagar) resolves to valid coordinates."""
    area = resolve_pincode_area("560038")
    assert area is not None
    assert area["is_mapped"] is True
    assert area["locality"] == "Indiranagar"
    assert area["city"] == "Bengaluru"
    assert area["lat"] == 12.9784
    assert area["lng"] == 77.6408


def test_3_valid_pincode_missing_from_coordinate_registry():
    """3. A valid Indian pincode (e.g. 570001) is recognized as valid but unmapped."""
    assert is_valid_pincode("570001") is True
    area = resolve_pincode_area("570001")
    assert area is not None
    assert area["pincode"] == "570001"
    assert area["is_mapped"] is False
    assert area["lat"] is None
    assert area["lng"] is None
    assert "Karnataka" in area["city"]


def test_4_invalid_pincodes():
    """4. Invalid pincodes are rejected properly."""
    assert is_valid_pincode("12345") is False  # 5 digits
    assert is_valid_pincode("1234567") is False  # 7 digits
    assert is_valid_pincode("ABCDEF") is False  # non-numeric
    assert is_valid_pincode("012345") is False  # starts with 0
    assert is_valid_pincode(None) is False

    assert resolve_pincode_area("12345") is None
    assert resolve_pincode_area("ABCDEF") is None
    assert resolve_pincode_area("012345") is None

    # Submitting report with invalid pincode raises InvalidIdentifierError
    with pytest.raises(InvalidIdentifierError):
        submit_report(
            ReportCreate(
                identifier="+91 99999 88888",
                pincode="012345",
                scam_type="KYC_FRAUD",
            ),
            make_request("1.2.3.4"),
        )


def test_5_two_different_pincodes_resolving_to_same_area():
    """5. Two different pincodes (560095 alias and 560034) resolve to the same area centroid."""
    area_primary = resolve_pincode_area("560034")
    area_alias = resolve_pincode_area("560095")

    assert area_primary is not None and area_alias is not None
    assert area_primary["lat"] == area_alias["lat"]
    assert area_primary["lng"] == area_alias["lng"]
    assert area_alias["primary_pincode"] == "560034"
    assert area_alias["locality"] == area_primary["locality"]


def test_6_report_submitted_with_unmapped_pincode_is_saved_and_searchable():
    """6. Report submitted with valid but unmapped pincode is saved, retained, searchable, but not geocoded."""
    unmapped_pin = "570001"  # Mysuru
    rep_res = submit_report(
        ReportCreate(
            identifier="+91 98888 77777",
            pincode=unmapped_pin,
            scam_type="digital-arrest",
            amount_lost_inr=5000.0,
        ),
        make_request("10.0.0.1"),
    )
    assert rep_res.status == "ACCEPTED"
    assert rep_res.report_id is not None

    # Available via lookup
    lookup_res = lookup_identifier(type="phone", value="+91 98888 77777")
    assert lookup_res.report_count == 1
    assert lookup_res.verdict == "SUSPICIOUS"
    if lookup_res.evidence and isinstance(lookup_res.evidence, dict):
        reports = lookup_res.evidence.get("reports", [])
        assert len(reports) == 1
        assert reports[0]["pincode"] == unmapped_pin

    # Map response reports unmapped pincode in diagnostics
    map_res = get_map()
    assert map_res.diagnostics is not None
    assert map_res.diagnostics.unmapped_reports_count >= 1
    assert unmapped_pin in map_res.diagnostics.unmapped_pincodes

    # The unmapped pincode is NOT plotted with fake coordinates
    mapped_pins = [c.pincode for c in map_res.clusters]
    assert unmapped_pin not in mapped_pins


def test_7_multiple_reports_in_one_area_aggregated():
    """7. Multiple reports in one area aggregate correctly with count, top_scam_type and severity."""
    now = datetime.now(timezone.utc).isoformat()
    # Submit 3 reports in Indiranagar (560038)
    for i in range(3):
        submit_report(
            ReportCreate(
                identifier=f"+91 91000 0000{i}",
                pincode="560038",
                scam_type="KYC_FRAUD",
                occurred_at=now,
            ),
            make_request(f"192.168.1.{i}"),
        )

    map_res = get_map(days=7)
    indira_cluster = [c for c in map_res.clusters if c.pincode == "560038"]
    assert len(indira_cluster) == 1
    assert indira_cluster[0].count == 3
    assert indira_cluster[0].locality == "Indiranagar"
    assert indira_cluster[0].top_scam_type == "KYC_FRAUD"
    assert indira_cluster[0].severity == "MED"


def test_8_global_map_returns_all_eligible_clusters():
    """8. Global map returns all eligible clusters across multiple cities/pincodes."""
    now = datetime.now(timezone.utc).isoformat()
    # Bengaluru (560102)
    submit_report(
        ReportCreate(identifier="+91 92222 11111", pincode="560102", scam_type="KYC_FRAUD", occurred_at=now),
        make_request("1.1.1.1"),
    )
    # Mumbai (400050)
    submit_report(
        ReportCreate(identifier="+91 93333 11111", pincode="400050", scam_type="job-offer", occurred_at=now),
        make_request("2.2.2.2"),
    )
    # Delhi (110016)
    submit_report(
        ReportCreate(identifier="+91 94444 11111", pincode="110016", scam_type="sextortion", occurred_at=now),
        make_request("3.3.3.3"),
    )

    map_res = get_map(days=7)
    cluster_pins = {c.pincode for c in map_res.clusters}
    assert "560102" in cluster_pins
    assert "400050" in cluster_pins
    assert "110016" in cluster_pins
    assert len(map_res.clusters) >= 3


def test_9_map_marker_coordinates_are_valid_and_numeric():
    """9. All returned clusters have valid, numeric latitude and longitude."""
    map_res = get_map(days=7)
    for c in map_res.clusters:
        assert isinstance(c.lat, float)
        assert isinstance(c.lng, float)
        assert -90.0 <= c.lat <= 90.0
        assert -180.0 <= c.lng <= 180.0
        assert not (c.lat == 0.0 and c.lng == 0.0)


def test_10_extended_pincode_560050_is_mapped_and_clustered():
    """10. Extended pincode 560050 (Basavanagudi) maps with real coordinates and appears on map."""
    now = datetime.now(timezone.utc).isoformat()
    submit_report(
        ReportCreate(
            identifier="+91 91081 28632",
            pincode="560050",
            scam_type="KYC_FRAUD",
            occurred_at=now,
        ),
        make_request("5.5.5.5"),
    )
    area = resolve_pincode_area("560050")
    assert area["is_mapped"] is True
    assert area["lat"] == 12.9416
    assert area["lng"] == 77.5753

    map_res = get_map(days=7)
    p50_clusters = [c for c in map_res.clusters if c.pincode == "560050"]
    assert len(p50_clusters) == 1
    assert p50_clusters[0].count == 1
    assert p50_clusters[0].lat == 12.9416
    assert p50_clusters[0].lng == 77.5753
