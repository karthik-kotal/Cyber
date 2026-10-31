import hmac
import hashlib
import ipaddress
import re
from typing import Optional
from app.config import settings


def hash_reporter_id(reporter_id: str, salt: Optional[str] = None) -> str:
    """
    Computes HMAC-SHA256 of raw reporter identifier.
    Guarantees raw reporter ID is never stored.
    """
    if not reporter_id:
        return ""
    secret = settings.HMAC_SECRET.encode("utf-8")
    data = reporter_id.strip().lower().encode("utf-8")
    if salt:
        data = f"{salt}:{data.decode('utf-8')}".encode("utf-8")
    return hmac.new(secret, data, hashlib.sha256).hexdigest()


def hash_ip_prefix(client_ip: Optional[str]) -> str:
    """
    Extracts the subnet (/24 for IPv4, /48 for IPv6) and computes HMAC-SHA256 hash.
    Handles full IP addresses (192.168.1.10) or 3-octet subnet prefixes (103.21.58).
    Raw IP is never stored.
    """
    if not client_ip:
        return ""
    raw = client_ip.strip()
    if raw.count(".") == 2:
        subnet_str = f"{raw}.0"
    else:
        try:
            ip_obj = ipaddress.ip_address(raw)
            if ip_obj.version == 4:
                network = ipaddress.ip_network(f"{raw}/24", strict=False)
                subnet_str = str(network.network_address)
            else:
                network = ipaddress.ip_network(f"{raw}/48", strict=False)
                subnet_str = str(network.network_address)
        except ValueError:
            subnet_str = raw

    secret = settings.HMAC_SECRET.encode("utf-8")
    return hmac.new(secret, subnet_str.encode("utf-8"), hashlib.sha256).hexdigest()


def compute_note_fingerprint(note: Optional[str]) -> str:
    """
    Generates a deterministic fingerprint for report notes/descriptions.
    Normalizes text by removing punctuation, extra whitespace, and lowercasing.
    Identical or copy-pasted notes produce the exact same fingerprint.
    """
    if not note:
        return ""
    cleaned = re.sub(r"[^\w\s]", "", note.lower())
    normalized = " ".join(cleaned.split())
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
