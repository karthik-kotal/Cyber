import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, Header, HTTPException, status
from pydantic import BaseModel, Field
from app.config import settings


LICENSE_SECRET_KEY = b"cyberforge-license-signing-secret-key-2026"


class LicensePayload(BaseModel):
    licensee: Optional[str] = Field(None, description="Licensed organization name")
    expires_at: Optional[str] = Field(None, description="ISO timestamp when the license expires")
    signature: Optional[str] = Field(None, description="Cryptographic signature protecting the license")
    license_key: Optional[str] = Field(None, description="Alternative single key string")
    demo_type: Optional[str] = Field(None, description="Demo preset: short_5m, long_1y, expired")


def generate_license_signature(licensee: str, expires_at: str) -> str:
    msg = f"{licensee.strip()}:{expires_at.strip()}".encode("utf-8")
    return hmac.new(LICENSE_SECRET_KEY, msg, hashlib.sha256).hexdigest()


def verify_license_signature(licensee: str, expires_at: str, signature: str) -> bool:
    expected = generate_license_signature(licensee, expires_at)
    return hmac.compare_digest(expected, signature.strip())


def _is_demo_pov(x_cyberforge_pov: Any) -> bool:
    return isinstance(x_cyberforge_pov, str) and x_cyberforge_pov.strip().lower() == "demo"


class LicenseManager:
    """In-memory active license manager with instant reload without server restarts."""
    def __init__(self, default_days: int = 365, default_licensee: str = "Demo Bank"):
        now = datetime.now(timezone.utc)
        self.licensee = default_licensee
        self.expires_at = (now + timedelta(days=default_days)).isoformat()
        self.signature = generate_license_signature(self.licensee, self.expires_at)

    def set_license(self, licensee: str, expires_at: str, signature: str) -> bool:
        # Validate timestamp format
        try:
            datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except Exception:
            raise ValueError("Invalid ISO timestamp format for expires_at")

        # Allow valid HMAC signature or mock signatures
        if not verify_license_signature(licensee, expires_at, signature) and not signature.startswith("MEUCI"):
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

    def reset_short_demo(self, minutes: int = 5, licensee: str = "Demo User") -> None:
        now = datetime.now(timezone.utc)
        self.licensee = licensee
        self.expires_at = (now + timedelta(minutes=minutes)).isoformat()
        self.signature = generate_license_signature(self.licensee, self.expires_at)

    def get_status(self) -> Dict[str, Any]:
        exp = datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        remaining_sec = max(0, int((exp - now).total_seconds()))
        expired = self.is_expired()
        return {
            "licensee": self.licensee,
            "expires_at": self.expires_at,
            "active": not expired,
            "status": "EXPIRED" if expired else "ACTIVE",
            "remaining_seconds": remaining_sec,
            "license_hint": self.licensee
        }


# 1. Administrator / Production 365-day license manager
license_manager = LicenseManager(default_days=365, default_licensee="Demo Bank")

# 2. Demo User isolated 5-minute license manager (cannot switch to 365 days)
demo_license_manager = LicenseManager(default_days=0, default_licensee="Demo User")
demo_license_manager.reset_short_demo(minutes=5, licensee="Demo User")

router = APIRouter()


def _process_license_upload(target_manager: LicenseManager, payload: LicensePayload, is_demo: bool = False) -> Dict[str, Any]:
    licensee = payload.licensee
    expires_at = payload.expires_at
    signature = payload.signature

    # Handle demo preset shortcuts
    if payload.demo_type:
        now = datetime.now(timezone.utc)
        target_licensee = payload.licensee or ("Demo User" if is_demo else "Demo Bank")
        if payload.demo_type in ("short", "short_5m", "5m"):
            expires_at = (now + timedelta(minutes=5)).isoformat()
        elif payload.demo_type in ("long", "long_1y", "1y"):
            if is_demo:
                raise HTTPException(status_code=400, detail="Demo environment is strictly 5-minute evaluation only and cannot switch to 365 days.")
            expires_at = (now + timedelta(days=365)).isoformat()
        elif payload.demo_type in ("expired", "already_expired"):
            expires_at = (now - timedelta(minutes=1)).isoformat()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown demo preset: {payload.demo_type}")
        licensee = target_licensee
        signature = generate_license_signature(licensee, expires_at)

    if payload.license_key and not (licensee and expires_at and signature):
        raw_key = payload.license_key.strip()
        raw_lower = raw_key.lower()

        # Master demo renewal key: "Gandadagudi"
        if raw_lower in ("gandadagudi", "gandhadagudi", "gandada gudi", "gandhada gudi"):
            now = datetime.now(timezone.utc)
            licensee = payload.licensee or ("Demo User" if is_demo else "Demo Bank")
            # In Demo mode, Gandadagudi renews for 5 minutes; in Production, 365 days
            expires_at = (now + timedelta(minutes=5 if is_demo else 0, days=0 if is_demo else 365)).isoformat()
            signature = generate_license_signature(licensee, expires_at)
        elif raw_key.upper() in ("DEMO:SHORT_5M", "DEMO:5M", "SHORT_5M", "SHORT"):
            now = datetime.now(timezone.utc)
            licensee = payload.licensee or ("Demo User" if is_demo else "Demo Bank")
            expires_at = (now + timedelta(minutes=5)).isoformat()
            signature = generate_license_signature(licensee, expires_at)
        elif raw_key.upper() in ("DEMO:LONG_1Y", "DEMO:1Y", "LONG_1Y", "LONG"):
            if is_demo:
                raise HTTPException(status_code=400, detail="Demo environment is strictly 5-minute evaluation only and cannot switch to 365 days.")
            now = datetime.now(timezone.utc)
            licensee = payload.licensee or "Demo Bank"
            expires_at = (now + timedelta(days=365)).isoformat()
            signature = generate_license_signature(licensee, expires_at)
        elif raw_key.upper() in ("DEMO:EXPIRED", "EXPIRED"):
            now = datetime.now(timezone.utc)
            licensee = payload.licensee or ("Demo User" if is_demo else "Demo Bank")
            expires_at = (now - timedelta(minutes=1)).isoformat()
            signature = generate_license_signature(licensee, expires_at)
        elif raw_key.startswith("{") and raw_key.endswith("}"):
            try:
                import json
                parsed = json.loads(raw_key)
                licensee = parsed.get("licensee")
                expires_at = parsed.get("expires_at")
                signature = parsed.get("signature")
            except Exception:
                pass
        else:
            last_colon = raw_key.rfind(":")
            if last_colon != -1:
                sig_cand = raw_key[last_colon + 1:].strip()
                rest = raw_key[:last_colon]
                first_colon = rest.find(":")
                if first_colon != -1:
                    licensee = rest[:first_colon].strip()
                    expires_at = rest[first_colon + 1:].strip()
                    signature = sig_cand

    if not licensee or not expires_at or not signature:
        raise HTTPException(status_code=400, detail="Invalid license key. Please check your renewal key.")

    if is_demo:
        # Enforce that demo license duration can never exceed 10 minutes
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            now_dt = datetime.now(timezone.utc)
            if (exp_dt - now_dt).total_seconds() > 600:
                # Cap strictly to 5 minutes
                expires_at = (now_dt + timedelta(minutes=5)).isoformat()
                signature = generate_license_signature(licensee, expires_at)
        except Exception:
            pass

    try:
        target_manager.set_license(licensee, expires_at, signature)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid license key. Please check your renewal key.")

    return {
        "status": "VALID",
        "licensee": target_manager.licensee,
        "expires_at": target_manager.expires_at,
        "active": not target_manager.is_expired(),
        "license_hint": target_manager.licensee,
        "remaining_seconds": target_manager.get_status().get("remaining_seconds", 0)
    }


@router.get("/license")
@router.get("/license/status")
def get_license(x_cyberforge_pov: Optional[str] = Header(None)):
    """Returns the license status for the active POV."""
    if _is_demo_pov(x_cyberforge_pov):
        return demo_license_manager.get_status()
    return license_manager.get_status()


@router.post("/license")
@router.post("/license/activate")
def upload_license(payload: LicensePayload, x_cyberforge_pov: Optional[str] = Header(None)):
    """Uploads and activates a license."""
    is_demo = _is_demo_pov(x_cyberforge_pov)
    target_mgr = demo_license_manager if is_demo else license_manager
    return _process_license_upload(target_mgr, payload, is_demo=is_demo)


# Explicit Demo License Endpoints
@router.get("/demo/license/status")
def get_demo_license_status():
    """Returns the Demo 5-minute license status."""
    return demo_license_manager.get_status()


@router.post("/demo/license/activate")
def activate_demo_license(payload: LicensePayload):
    """Activates/renews the 5-minute demo license (e.g. via 'Gandadagudi')."""
    return _process_license_upload(demo_license_manager, payload, is_demo=True)


@router.post("/demo/license/reset")
def reset_demo_license():
    """Safely resets the Demo environment license to a fresh 5-minute window."""
    demo_license_manager.reset_short_demo(minutes=5, licensee="Demo User")
    return demo_license_manager.get_status()
