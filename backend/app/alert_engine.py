import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import sqlite3
from app.config import settings


def check_and_generate_alerts(
    conn: sqlite3.Connection,
    identifier: str,
    scam_type: str,
    pincode: Optional[str],
    occurred_at: str
) -> List[Dict[str, Any]]:
    """
    Evaluates new report for SPIKE and NEW_TYPE alert triggers.
    Inserts newly triggered alerts into database and returns them.
    All alerts are strictly area (pincode) based.
    """
    clean_pin = str(pincode).strip() if pincode is not None else ""
    if not clean_pin or len(clean_pin) != 6 or not clean_pin.isdigit():
        # PRD alerts are geographic area alerts; cannot create area alert without valid pincode
        return []

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    window_24h = (now - timedelta(hours=settings.SPIKE_WINDOW_HOURS)).isoformat()

    alerts_generated = []
    cur = conn.cursor()

    # 1. SPIKE Alert Check: Reports in last 24 hours for this PIN code
    cur.execute(
        "SELECT COUNT(*) FROM reports WHERE pincode = ? AND occurred_at >= ? AND status = 'ACCEPTED'",
        (clean_pin, window_24h)
    )
    count_24h = cur.fetchone()[0]

    if count_24h >= settings.SPIKE_REPORT_THRESHOLD:
        # Check if an alert for this spike was already created today for this pincode
        cur.execute(
            "SELECT COUNT(*) FROM alerts WHERE type = 'SPIKE' AND pincode = ? AND created_at >= ?",
            (clean_pin, window_24h)
        )
        existing_alert = cur.fetchone()[0]
        if existing_alert == 0:
            alert_id = str(uuid.uuid4())
            description = f"Sudden spike of {count_24h} reports detected in the last {settings.SPIKE_WINDOW_HOURS}h in PIN code {clean_pin}"
            conn.execute(
                """
                INSERT INTO alerts (id, type, identifier, pincode, scam_type, description, severity, window, count, created_at)
                VALUES (?, 'SPIKE', ?, ?, ?, ?, 'HIGH', '24h', ?, ?)
                """,
                (alert_id, identifier, clean_pin, scam_type, description, count_24h, now_iso)
            )
            alerts_generated.append({
                "id": alert_id,
                "type": "SPIKE",
                "identifier": identifier,
                "pincode": clean_pin,
                "scam_type": scam_type,
                "description": description,
                "severity": "HIGH",
                "window": "24h",
                "count": count_24h,
                "created_at": now_iso
            })

    # 2. NEW_TYPE Alert Check: New scam type in the specified pincode
    # Check if this scam_type ever existed in this pincode before window_24h
    cur.execute(
        "SELECT COUNT(*) FROM reports WHERE pincode = ? AND scam_type = ? AND occurred_at < ? AND status = 'ACCEPTED'",
        (clean_pin, scam_type, window_24h)
    )
    historical_count = cur.fetchone()[0]
    if historical_count == 0:
        # Check if alert already raised recently
        cur.execute(
            "SELECT COUNT(*) FROM alerts WHERE type = 'NEW_TYPE' AND pincode = ? AND scam_type = ? AND created_at >= ?",
            (clean_pin, scam_type, window_24h)
        )
        existing_new_type = cur.fetchone()[0]
        if existing_new_type == 0:
            alert_id = str(uuid.uuid4())
            description = f"Emerging new scam trend '{scam_type}' reported in PIN code {clean_pin}"
            conn.execute(
                """
                INSERT INTO alerts (id, type, identifier, pincode, scam_type, description, severity, window, count, created_at)
                VALUES (?, 'NEW_TYPE', ?, ?, ?, ?, 'MEDIUM', '24h', 1, ?)
                """,
                (alert_id, identifier, clean_pin, scam_type, description, now_iso)
            )
            alerts_generated.append({
                "id": alert_id,
                "type": "NEW_TYPE",
                "identifier": identifier,
                "pincode": clean_pin,
                "scam_type": scam_type,
                "description": description,
                "severity": "MEDIUM",
                "window": "24h",
                "count": 1,
                "created_at": now_iso
            })

    return alerts_generated
