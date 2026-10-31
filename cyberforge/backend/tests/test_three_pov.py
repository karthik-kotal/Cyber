import json
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.license import license_manager, demo_license_manager
from app.database import get_db_connection


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_teardown():
    # Ensure fresh active 365-day license
    far_future = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    license_manager.licensee = "Demo Bank"
    license_manager.expires_at = far_future
    # Reset 5-minute demo license
    demo_license_manager.reset_short_demo(minutes=5, licensee="Demo User")
    yield


def test_admin_login_success():
    resp = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "CyberForgeAdmin2026!"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["role"] == "admin"
    assert data["token"] == settings.ADMIN_TOKEN
    assert data["license_status"]["active"] is True


def test_admin_login_failure_wrong_password():
    resp = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "WrongPassword123"}
    )
    assert resp.status_code == 401
    assert "Invalid administrator ID or password" in resp.json()["detail"]


def test_admin_login_does_not_reset_license():
    # Set a specific expiry
    test_expiry = (datetime.now(timezone.utc) + timedelta(days=200)).isoformat()
    license_manager.expires_at = test_expiry

    resp = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "CyberForgeAdmin2026!"}
    )
    assert resp.status_code == 200
    # Confirm expiry was NOT reset to 365 days
    assert license_manager.expires_at == test_expiry


def test_normal_user_direct_access_no_license_required():
    # Normal user calls /api/lookup without any license activation
    resp = client.get(
        "/api/lookup?type=phone&value=9876543210",
        headers={"x-cyberforge-pov": "normal"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "verdict" in data
    assert data["verdict"] == "NO_REPORTS"


def test_normal_user_not_affected_by_demo_expiration():
    # Expire demo license
    demo_license_manager.expires_at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert demo_license_manager.is_expired() is True

    # Normal user should still access without any 403 error!
    resp = client.get(
        "/api/lookup?type=phone&value=9876543210",
        headers={"x-cyberforge-pov": "normal"}
    )
    assert resp.status_code == 200
    assert resp.json()["verdict"] == "NO_REPORTS"


def test_normal_user_cannot_access_admin_api():
    # Normal user calls /api/admin/reports without admin token -> rejected 401
    resp = client.get(
        "/api/admin/reports",
        headers={"x-cyberforge-pov": "normal"}
    )
    assert resp.status_code == 401
    assert "Administrator authentication required" in resp.json()["detail"]


def test_admin_authorized_access():
    resp = client.get(
        "/api/admin/reports",
        headers={
            "x-cyberforge-pov": "admin",
            "Authorization": f"Bearer {settings.ADMIN_TOKEN}"
        }
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_demo_license_validity_and_expiration():
    # 1. Initially active with ~300 seconds
    resp = client.get("/api/demo/license/status")
    assert resp.status_code == 200
    assert resp.json()["active"] is True
    assert resp.json()["remaining_seconds"] > 250

    # 2. Expire demo license
    demo_license_manager.expires_at = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    assert demo_license_manager.is_expired() is True

    # 3. Demo user lookup is blocked with 403 DEMO_LICENSE_EXPIRED
    resp_demo = client.get(
        "/api/lookup?type=phone&value=9876543210",
        headers={"x-cyberforge-pov": "demo"}
    )
    assert resp_demo.status_code == 403
    assert resp_demo.json()["error"] == "DEMO_LICENSE_EXPIRED"

    # 4. Reactivate with Gandadagudi renewal key
    resp_renew = client.post(
        "/api/demo/license/activate",
        json={"license_key": "Gandadagudi"}
    )
    assert resp_renew.status_code == 200
    assert resp_renew.json()["active"] is True
    assert demo_license_manager.is_expired() is False

    # 5. Demo user unblocked immediately
    resp_demo_after = client.get(
        "/api/lookup?type=phone&value=9876543210",
        headers={"x-cyberforge-pov": "demo"}
    )
    assert resp_demo_after.status_code == 200


def test_demo_data_isolation_from_production():
    # Submit report in Demo mode
    demo_report = {
        "category": "PHONE",
        "identifier_value": "9998887776",
        "scam_type": "INVESTMENT_SCAM",
        "note": "Demo isolated scam test report",
        "pincode": "560001",
        "amount_lost_inr": 15000,
        "reporter_phone": "9112223334"
    }
    resp_demo_post = client.post(
        "/api/reports",
        json=demo_report,
        headers={"x-cyberforge-pov": "demo"}
    )
    assert resp_demo_post.status_code == 201
    demo_ref = resp_demo_post.json()["id"]

    # In Demo POV, lookup sees the report
    resp_demo_lookup = client.get(
        "/api/lookup?type=phone&value=9998887776",
        headers={"x-cyberforge-pov": "demo"}
    )
    assert resp_demo_lookup.status_code == 200
    assert resp_demo_lookup.json()["report_count"] >= 1

    # In Normal/Production POV, lookup DOES NOT SEE the demo report (isolated!)
    resp_prod_lookup = client.get(
        "/api/lookup?type=phone&value=9998887776",
        headers={"x-cyberforge-pov": "normal"}
    )
    assert resp_prod_lookup.status_code == 200
    assert resp_prod_lookup.json()["report_count"] == 0
    assert resp_prod_lookup.json()["verdict"] == "NO_REPORTS"


def test_admin_dispute_approval_and_rejection_lifecycle():
    # 1. Normal user submits a report
    rep = client.post(
        "/api/reports",
        json={
            "category": "PHONE",
            "identifier_value": "9123456789",
            "scam_type": "IMPERSONATION",
            "note": "Test dispute flow report",
            "pincode": "110001",
            "reporter_phone": "9988776655"
        },
        headers={"x-cyberforge-pov": "normal"}
    )
    assert rep.status_code == 201
    report_id = rep.json()["id"]

    # 2. Normal user submits dispute for this report
    disp = client.post(
        "/api/disputes",
        json={
            "reference_id": report_id,
            "claimant_name": "Rohan Sharma",
            "contact_email": "rohan@example.com",
            "proof_note": "Legitimate customer service line, false report."
        },
        headers={"x-cyberforge-pov": "normal"}
    )
    assert disp.status_code == 201
    challenge_id = disp.json()["challenge_id"]

    # 3. Admin reviews dispute
    admin_headers = {
        "x-cyberforge-pov": "admin",
        "Authorization": f"Bearer {settings.ADMIN_TOKEN}"
    }
    disp_list = client.get("/api/admin/disputes", headers=admin_headers)
    assert disp_list.status_code == 200
    assert any(d["id"] == challenge_id for d in disp_list.json())

    # 4. Admin approves dispute with reason
    decision = client.post(
        f"/api/admin/disputes/{challenge_id}/decision",
        json={
            "action": "APPROVE",
            "reason": "Verified business documentation submitted and approved."
        },
        headers=admin_headers
    )
    assert decision.status_code == 200
    assert decision.json()["ok"] is True
    assert decision.json()["new_challenge_status"] == "resolved_approved"
    assert decision.json()["new_report_status"] == "RESOLVED_DISPUTED"

    # 5. Check audit log
    audit_resp = client.get("/api/admin/disputes/audit-log", headers=admin_headers)
    assert audit_resp.status_code == 200
    audit_items = audit_resp.json()
    assert any(a["challenge_id"] == challenge_id and a["action"] == "APPROVE" for a in audit_items)
