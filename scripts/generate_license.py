#!/usr/bin/env python3
"""
CyberForge License Generator
---------------------------
Generates cryptographic HMAC-SHA256 license files and key strings for the
Community Scam Map demo and production deployment.

Compatible with Python 3.9+ without external dependencies.
"""

import sys
import os
import json
import hmac
import hashlib
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Canonical signing secret from backend/app/license.py
LICENSE_SECRET_KEY = b"cyberforge-license-signing-secret-key-2026"


def generate_license_signature(licensee: str, expires_at: str) -> str:
    """Generates canonical HMAC-SHA256 signature for a licensee and expiration timestamp."""
    msg = f"{licensee.strip()}:{expires_at.strip()}".encode("utf-8")
    return hmac.new(LICENSE_SECRET_KEY, msg, hashlib.sha256).hexdigest()


def create_license(licensee: str, expires_at: datetime) -> dict:
    """Creates a signed license dictionary."""
    iso_str = expires_at.isoformat()
    sig = generate_license_signature(licensee, iso_str)
    single_key = f"{licensee.strip()}:{iso_str}:{sig}"
    return {
        "licensee": licensee.strip(),
        "expires_at": iso_str,
        "signature": sig,
        "license_key": single_key,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "is_expired": datetime.now(timezone.utc) > expires_at
    }


def main():
    parser = argparse.ArgumentParser(description="Generate CyberForge cryptographic license files.")
    parser.add_argument("--licensee", default="Demo Bank", help="Name of the licensed entity/organization")
    parser.add_argument("--type", choices=["short", "long", "expired", "custom"], default="custom",
                        help="Pre-configured license type: short (5 min), long (1 year), expired, or custom")
    parser.add_argument("--minutes", type=int, default=None, help="Minutes from now until license expires")
    parser.add_argument("--days", type=int, default=None, help="Days from now until license expires")
    parser.add_argument("--out-dir", default=None, help="Directory to save generated files")
    parser.add_argument("--filename", default=None, help="Base filename (without extension)")

    args = parser.parse_args()

    now = datetime.now(timezone.utc)

    if args.type == "short":
        expires_at = now + timedelta(minutes=5)
        default_name = "short_license"
    elif args.type == "long":
        expires_at = now + timedelta(days=365)
        default_name = "long_license"
    elif args.type == "expired":
        expires_at = now - timedelta(minutes=2)
        default_name = "already_expired_license"
    else:
        if args.minutes is not None:
            expires_at = now + timedelta(minutes=args.minutes)
        elif args.days is not None:
            expires_at = now + timedelta(days=args.days)
        else:
            expires_at = now + timedelta(days=365)
        default_name = "license"

    filename = args.filename or default_name
    lic_data = create_license(args.licensee, expires_at)

    out_dir = Path(args.out_dir) if args.out_dir else Path(__file__).resolve().parent.parent / "licenses"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / f"{filename}.json"
    key_path = out_dir / f"{filename}.key"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(lic_data, f, indent=2)

    with open(key_path, "w", encoding="utf-8") as f:
        f.write(lic_data["license_key"] + "\n")

    print(f"Generated {args.type.upper()} license for: {args.licensee}")
    print(f"  Expires at: {lic_data['expires_at']}")
    print(f"  Expired now: {lic_data['is_expired']}")
    print(f"  JSON file:  {json_path}")
    print(f"  Key file:   {key_path}")
    print(f"  Single key: {lic_data['license_key']}\n")


if __name__ == "__main__":
    main()
