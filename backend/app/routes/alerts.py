from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query
from app.database import get_db_connection
from app.schemas import AlertsResponse, AlertItem
from app.config import settings


router = APIRouter()


@router.get("/alerts", response_model=AlertsResponse)
def get_alerts(
    pincode: Optional[str] = Query(None, description="6-digit area code from Appendix B"),
    alert_type: Optional[str] = Query(None, description="Filter by alert type: SPIKE or NEW_TYPE"),
    limit: Optional[int] = Query(50, description="Max alerts to return")
):
    """
    GET /alerts?pincode=560102
    Computes real-time scam alerts according to exact PRD definitions:
    1. SPIKE: reports in last 24h >= double the daily average of the preceding 7 days, AND >= 5 (or configured threshold).
    2. NEW_TYPE: scam type reported in last 24h that was not seen in that area during the prior 30 days.
    Also returns alerts for all active areas when pincode is not provided.
    """
    now = datetime.now(timezone.utc)
    t_24h = (now - timedelta(hours=24)).isoformat()
    t_8d = (now - timedelta(days=8)).isoformat()
    t_30d = (now - timedelta(days=30)).isoformat()

    alerts_list: List[AlertItem] = []

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Determine target pincodes
        target_pin_arg = pincode.strip() if isinstance(pincode, str) and pincode.strip() else None
        if target_pin_arg:
            pincodes = [target_pin_arg]
        else:
            cur.execute(
                """
                SELECT DISTINCT pincode FROM reports
                WHERE pincode IS NOT NULL AND occurred_at >= ? AND status = 'ACCEPTED'
                """,
                (t_24h,)
            )
            pincodes = [row[0] for row in cur.fetchall()]

        for target_pin in pincodes:
            # 1. SPIKE Check
            cur.execute(
                """
                SELECT COUNT(*) FROM reports
                WHERE pincode = ? AND occurred_at >= ? AND status = 'ACCEPTED'
                """,
                (target_pin, t_24h)
            )
            count_24h = cur.fetchone()[0]

            cur.execute(
                """
                SELECT COUNT(*) FROM reports
                WHERE pincode = ? AND occurred_at >= ? AND occurred_at < ? AND status = 'ACCEPTED'
                """,
                (target_pin, t_8d, t_24h)
            )
            count_preceding_7d = cur.fetchone()[0]
            baseline_per_day = round(count_preceding_7d / 7.0, 1)

            # Condition: at least double daily average AND at least threshold (PRD: 5, Dev: settings.SPIKE_REPORT_THRESHOLD)
            min_thresh = min(5, settings.SPIKE_REPORT_THRESHOLD)
            if count_24h >= min_thresh and (count_24h >= 2 * baseline_per_day or baseline_per_day == 0):
                alerts_list.append(AlertItem(
                    type="SPIKE",
                    pincode=target_pin,
                    window="24h",
                    count=count_24h,
                    baseline_per_day=baseline_per_day,
                    severity="HIGH"
                ))

            # 2. NEW_TYPE Check
            cur.execute(
                """
                SELECT DISTINCT scam_type FROM reports
                WHERE pincode = ? AND occurred_at >= ? AND status = 'ACCEPTED'
                """,
                (target_pin, t_24h)
            )
            recent_scam_types = [row[0] for row in cur.fetchall()]

            for stype in recent_scam_types:
                cur.execute(
                    """
                    SELECT COUNT(*) FROM reports
                    WHERE pincode = ? AND scam_type = ? AND occurred_at >= ? AND occurred_at < ? AND status = 'ACCEPTED'
                    """,
                    (target_pin, stype, t_30d, t_24h)
                )
                prior_count = cur.fetchone()[0]
                if prior_count == 0:
                    alerts_list.append(AlertItem(
                        type="NEW_TYPE",
                        pincode=target_pin,
                        scam_type=stype,
                        window="24h",
                        severity="MEDIUM"
                    ))

        # Check any recorded alerts in alerts table for this identifier or pincode
        if target_pin_arg:
            cur.execute("SELECT type, pincode, scam_type, window, count, baseline_per_day, severity FROM alerts WHERE pincode = ?", (target_pin_arg,))
        else:
            cur.execute("SELECT type, pincode, scam_type, window, count, baseline_per_day, severity FROM alerts")
        for r in cur.fetchall():
            # Avoid duplicate if already calculated
            if not any(a.type == r["type"] and a.pincode == r["pincode"] and a.scam_type == r["scam_type"] for a in alerts_list):
                alerts_list.append(AlertItem(
                    type=r["type"],
                    pincode=r["pincode"],
                    scam_type=r["scam_type"],
                    window=r["window"] or "24h",
                    count=r["count"],
                    baseline_per_day=r["baseline_per_day"],
                    severity=r["severity"]
                ))

    # Filter by alert_type if requested
    if isinstance(alert_type, str) and alert_type:
        alerts_list = [a for a in alerts_list if a.type.upper() == alert_type.upper()]

    max_limit = limit if isinstance(limit, int) else 50
    final_alerts = alerts_list[:max_limit]
    return AlertsResponse(alerts=final_alerts, count=len(final_alerts))
