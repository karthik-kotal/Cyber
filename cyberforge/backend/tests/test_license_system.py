import json
from datetime import datetime, timezone, timedelta
import pytest
from fastapi import HTTPException
from app.license import (
    license_manager,
    generate_license_signature,
    verify_license_signature,
    upload_license,
    get_license,
    LicensePayload
)


@pytest.fixture(autouse=True)
def reset_active_license():
    far_future = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    license_manager.set_license("Demo Bank", far_future, generate_license_signature("Demo Bank", far_future))


def test_license_signature_generation_and_verification():
    licensee = "State Bank of India"
    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    sig = generate_license_signature(licensee, expires)
    assert len(sig) == 64
    assert verify_license_signature(licensee, expires, sig) is True
    assert verify_license_signature(licensee, expires, "tampered" + sig[8:]) is False


def test_initial_license_active():
    res = get_license()
    assert res["active"] is True
    assert res["status"] == "ACTIVE"


def test_four_step_license_demo_lifecycle():
    # Step 1: Initial active state
    st1 = get_license()
    assert st1["active"] is True

    # Step 2: Upload expired license (simulating 5 min expiry)
    past_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    past_sig = generate_license_signature("Demo Bank", past_time)
    res2 = upload_license(LicensePayload(
        licensee="Demo Bank",
        expires_at=past_time,
        signature=past_sig
    ))
    assert res2["active"] is False

    # Status check confirms EXPIRED
    st2 = get_license()
    assert st2["status"] == "EXPIRED"
    assert st2["active"] is False
    assert license_manager.is_expired() is True

    # Step 3: Upload renewed long license without server restart (single key format)
    future_time = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    future_sig = generate_license_signature("Demo Bank", future_time)
    single_key = f"Demo Bank:{future_time}:{future_sig}"

    res3 = upload_license(LicensePayload(
        license_key=single_key
    ))
    assert res3["active"] is True
    assert res3["licensee"] == "Demo Bank"

    # Step 4: Status is immediately ACTIVE
    st4 = get_license()
    assert st4["status"] == "ACTIVE"
    assert st4["active"] is True
    assert license_manager.is_expired() is False


def test_activate_with_json_string():
    future_time = (datetime.now(timezone.utc) + timedelta(days=100)).isoformat()
    future_sig = generate_license_signature("Enterprise Bank", future_time)
    json_str = json.dumps({
        "licensee": "Enterprise Bank",
        "expires_at": future_time,
        "signature": future_sig
    })

    res = upload_license(LicensePayload(license_key=json_str))
    assert res["licensee"] == "Enterprise Bank"
    assert res["active"] is True
    assert license_manager.is_expired() is False


def test_reject_invalid_signature():
    future_time = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    with pytest.raises(HTTPException) as exc:
        upload_license(LicensePayload(
            licensee="Fraud Corp",
            expires_at=future_time,
            signature="0000000000000000000000000000000000000000000000000000000000000000"
        ))
    assert exc.value.status_code == 400
    assert "Invalid cryptographic signature" in exc.value.detail
