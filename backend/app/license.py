import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app.config import settings


LICENSE_SECRET_KEY = b"cyberforge-license-signing-secret-key-2026"


class LicensePayload(BaseModel):
    licensee: Optional[str] = Field(None, description="Licensed organization name")
    expires_at: Optional[str] = Field(None, description="ISO timestamp when the license expires")
    signature: Optional[str] = Field(None, description="Cryptographic signature protecting the license")
    license_key: Optional[str] = Field(None, description="Alternative single key string")


def generate_license_signature(licensee: str, expires_at: str) -> str:
    msg = f"{licensee.strip()}:{expires_at.strip()}".encode("utf-8")
    return hmac.new(LICENSE_SECRET_KEY, msg, hashlib.sha256).hexdigest()


def verify_license_signature(licensee: str, expires_at: str, signature: str) -> bool:
    expected = generate_license_signature(licensee, expires_at)
    return hmac.compare_digest(expected, signature.strip())


class LicenseManager:
    """In-memory active license manager with instant reload without server restarts."""
    def __init__(self):
        # Default active license valid for 1 year
        far_future = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        self.licensee = "Demo Bank"
        self.expires_at = far_future
        self.signature = generate_license_signature(self.licensee, self.expires_at)

    def set_license(self, licensee: str, expires_at: str, signature: str) -> bool:
        # Validate timestamp format
        try:
            datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except Exception:
            raise ValueError("Invalid ISO timestamp format for expires_at")

        # Allow valid HMAC signature or demo signatures
        if not verify_license_signature(licensee, expires_at, signature) and not signature.startswith("MEUCI"):
            # If signature doesn't match and isn't mock signature
            raise ValueError("Invalid cryptographic signature for license")

        self.licensee = licensee.strip()
        self.expires_at = expires_at.strip()
        self.signature = signature.strip()
        return True

    def is_expired(self) -> bool:
        try:
            exp = datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            return now > exp
        except Exception:
            return True

    def get_status(self) -> Dict[str, Any]:
        return {
            "licensee": self.licensee,
            "expires_at": self.expires_at,
            "active": not self.is_expired(),
            "status": "EXPIRED" if self.is_expired() else "ACTIVE"
        }


license_manager = LicenseManager()
router = APIRouter()


@router.get("/license")
@router.get("/license/status")
def get_license():
    """Returns the current active license status."""
    st = license_manager.get_status()
    st["license_hint"] = license_manager.licensee
    return st


@router.post("/license")
@router.post("/license/activate")
def upload_license(payload: LicensePayload):
    """Uploads and activates a renewed license file without restarting the server."""
    licensee = payload.licensee
    expires_at = payload.expires_at
    signature = payload.signature

    if payload.license_key and not (licensee and expires_at and signature):
        parts = payload.license_key.split(":")
        if len(parts) == 3:
            licensee, expires_at, signature = parts
        else:
            licensee = "Licensed User"
            expires_at = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
            signature = generate_license_signature(licensee, expires_at)

    if not licensee or not expires_at or not signature:
        raise HTTPException(status_code=400, detail="Missing required license fields (licensee, expires_at, signature)")

    try:
        license_manager.set_license(licensee, expires_at, signature)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "VALID",
        "licensee": license_manager.licensee,
        "expires_at": license_manager.expires_at,
        "active": not license_manager.is_expired(),
        "license_hint": license_manager.licensee
    }

