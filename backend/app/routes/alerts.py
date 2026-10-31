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
    Preserves meaningful scam category/type for both SPIKE and NEW_TYPE alerts.
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
                  AND identifier NOT IN (SELECT identifier FROM verified_businesses)
                """,
                (t_24h,)
            )
            pincodes = [row[0] for row in cur.fetchall()]

        for target_pin in pincodes:
            # 1. SPIKE Check
            cur.execute(
                """
                SELECT COUNT(*), COUNT(DISTINCT reporter_hmac) FROM reports
                WHERE pincode = ? AND occurred_at >= ? AND status = 'ACCEPTED' AND (is_disputed IS NULL OR is_disputed = 0)
                  AND identifier NOT IN (SELECT identifier FROM verified_businesses)
                """,
                (target_pin, t_24h)
            )
            spike_row = cur.fetchone()
            count_24h = spike_row[0]
            distinct_reps_24h = spike_row[1]

            cur.execute(
                """
                SELECT COUNT(*) FROM reports
                WHERE pincode = ? AND occurred_at >= ? AND occurred_at < ? AND status = 'ACCEPTED' AND (is_disputed IS NULL OR is_disputed = 0)
                  AND identifier NOT IN (SELECT identifier FROM verified_businesses)
                """,
                (target_pin, t_8d, t_24h)
            )
            count_preceding_7d = cur.fetchone()[0]
            baseline_per_day = round(count_preceding_7d / 7.0, 1)

            # Determine top reported scam type in this window for this spike
            cur.execute(
                """
                SELECT scam_type, COUNT(*) as cnt FROM reports
                WHERE pincode = ? AND occurred_at >= ? AND status = 'ACCEPTED' AND (is_disputed IS NULL OR is_disputed = 0)
                  AND identifier NOT IN (SELECT identifier FROM verified_businesses)
                GROUP BY scam_type ORDER BY cnt DESC LIMIT 1
                """,
                (target_pin, t_24h)
            )
            top_st_row = cur.fetchone()
            top_scam_type = top_st_row[0] if (top_st_row and top_st_row[0] != "other") else (top_st_row[0] if top_st_row else None)

            # Condition: at least double daily average AND at least threshold (requires >= 2 distinct reporters)
            min_thresh = min(5, settings.SPIKE_REPORT_THRESHOLD)
            if count_24h >= min_thresh and distinct_reps_24h >= 2 and (count_24h >= 2 * baseline_per_day or baseline_per_day == 0):
                alerts_list.append(AlertItem(
                    type="SPIKE",
                    pincode=target_pin,
                    scam_type=top_scam_type,
                    window="24h",
                    count=count_24h,
                    baseline_per_day=baseline_per_day,
                    severity="HIGH",
                    title=f"Spike in Scam Reports: Pincode {target_pin}",
                    body=f"{count_24h} reports recorded in the last 24h against a daily baseline of {baseline_per_day:.1f}.",
                    description=f"Surge of {count_24h} reports in 24h"
                ))

            # 2. NEW_TYPE Check
            cur.execute(
                """
                SELECT DISTINCT scam_type FROM reports
                WHERE pincode = ? AND occurred_at >= ? AND status = 'ACCEPTED'
                  AND identifier NOT IN (SELECT identifier FROM verified_businesses)
                """,
                (target_pin, t_24h)
            )
            recent_scam_types = [row[0] for row in cur.fetchall()]

            for stype in recent_scam_types:
                if not stype or stype == "other":
                    continue
                cur.execute(
                    """
                    SELECT COUNT(*) FROM reports
                    WHERE pincode = ? AND scam_type = ? AND occurred_at >= ? AND occurred_at < ? AND status = 'ACCEPTED'
                      AND identifier NOT IN (SELECT identifier FROM verified_businesses)
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
                        severity="MEDIUM",
                        title=f"New Scam Type Detected: {stype}",
                        body=f"Scam type '{stype}' was reported in pincode {target_pin} in the last 24h (not observed in prior 30 days).",
                        description=f"First report of '{stype}' in 30 days"
                    ))

        # Check any recorded alerts in alerts table for this identifier or pincode.
        if target_pin_arg:
            cur.execute("SELECT type, pincode, scam_type, window, count, baseline_per_day, severity FROM alerts WHERE pincode = ?", (target_pin_arg,))
        else:
            cur.execute("SELECT type, pincode, scam_type, window, count, baseline_per_day, severity FROM alerts WHERE pincode IS NOT NULL AND pincode != ''")
        for r in cur.fetchall():
            stored_pin = r["pincode"]
            stored_type = r["type"]
            # Skip if a computed alert already covers this type+pincode pair
            if any(a.type == stored_type and a.pincode == stored_pin for a in alerts_list):
                continue
            alerts_list.append(AlertItem(
                type=stored_type,
                pincode=stored_pin,
                scam_type=r["scam_type"],
                window=r["window"] or "24h",
                count=r["count"],
                baseline_per_day=r["baseline_per_day"],
                severity=r["severity"],
                title=f"{stored_type} Alert: Pincode {stored_pin}",
                body=f"Alert recorded for pincode {stored_pin} ({r['scam_type'] or 'general'}).",
                description=f"{stored_type} alert"
            ))

    # Filter by alert_type if requested
    if isinstance(alert_type, str) and alert_type:
        alerts_list = [a for a in alerts_list if a.type.upper() == alert_type.upper()]

    max_limit = limit if isinstance(limit, int) else 50
    final_alerts = alerts_list[:max_limit]
    return AlertsResponse(alerts=final_alerts, count=len(final_alerts))
