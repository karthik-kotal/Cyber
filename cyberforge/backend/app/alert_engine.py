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
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    window_24h = (now - timedelta(hours=settings.SPIKE_WINDOW_HOURS)).isoformat()
    baseline_7d = (now - timedelta(days=settings.SPIKE_BASELINE_DAYS)).isoformat()

    alerts_generated = []

    # 1. SPIKE Alert Check: Reports in last 24 hours for this identifier
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) FROM reports WHERE identifier = ? AND occurred_at >= ? AND status = 'ACCEPTED'",
        (identifier, window_24h)
    )
    count_24h = cur.fetchone()[0]

    if count_24h >= settings.SPIKE_REPORT_THRESHOLD:
        # Check if an alert for this spike was already created today to avoid duplicates
        cur.execute(
            "SELECT COUNT(*) FROM alerts WHERE type = 'SPIKE' AND identifier = ? AND created_at >= ?",
            (identifier, window_24h)
        )
        existing_alert = cur.fetchone()[0]
        if existing_alert == 0:
            alert_id = str(uuid.uuid4())
            description = f"Sudden spike of {count_24h} reports detected in the last {settings.SPIKE_WINDOW_HOURS}h for identifier {identifier}"
            conn.execute(
                """
                INSERT INTO alerts (id, type, identifier, pincode, scam_type, description, severity, created_at)
                VALUES (?, 'SPIKE', ?, ?, ?, ?, 'HIGH', ?)
                """,
                (alert_id, identifier, pincode, scam_type, description, now_iso)
            )
            alerts_generated.append({
                "id": alert_id,
                "type": "SPIKE",
                "identifier": identifier,
                "pincode": pincode,
                "scam_type": scam_type,
                "description": description,
                "severity": "HIGH",
                "created_at": now_iso
            })

    # 2. NEW_TYPE Alert Check: New scam type in the specified pincode
    if pincode and len(pincode) == 6:
        # Check if this scam_type ever existed in this pincode before window_24h
        cur.execute(
            "SELECT COUNT(*) FROM reports WHERE pincode = ? AND scam_type = ? AND occurred_at < ? AND status = 'ACCEPTED'",
            (pincode, scam_type, window_24h)
        )
        historical_count = cur.fetchone()[0]
        if historical_count == 0:
            # Check if alert already raised recently
            cur.execute(
                "SELECT COUNT(*) FROM alerts WHERE type = 'NEW_TYPE' AND pincode = ? AND scam_type = ? AND created_at >= ?",
                (pincode, scam_type, window_24h)
            )
            existing_new_type = cur.fetchone()[0]
            if existing_new_type == 0:
                alert_id = str(uuid.uuid4())
                description = f"Emerging new scam trend '{scam_type}' reported in PIN code {pincode}"
                conn.execute(
                    """
                    INSERT INTO alerts (id, type, identifier, pincode, scam_type, description, severity, created_at)
                    VALUES (?, 'NEW_TYPE', ?, ?, ?, ?, 'MEDIUM', ?)
                    """,
                    (alert_id, identifier, pincode, scam_type, description, now_iso)
                )
                alerts_generated.append({
                    "id": alert_id,
                    "type": "NEW_TYPE",
                    "identifier": identifier,
                    "pincode": pincode,
                    "scam_type": scam_type,
                    "description": description,
                    "severity": "MEDIUM",
                    "created_at": now_iso
                })

    return alerts_generated
