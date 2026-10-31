from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Query
from app.database import get_db_connection
from app.schemas import MapResponse, MapCluster
from app.areas import APPENDIX_B_AREAS, get_areas_within_radius, get_area_by_pincode


router = APIRouter()


@router.get("/map", response_model=MapResponse)
def get_map(
    pincode: Optional[str] = Query(None, description="Center pincode for radius filtering"),
    days: int = Query(7, ge=1, le=90, description="Time window in days (default 7)"),
    radius_km: float = Query(2.0, ge=0.1, le=500.0, description="Search radius in kilometers (default 2)")
):
    """
    GET /map?pincode=560102&days=7&radius_km=2
    Lists scam reports by area for the last 7 days.
    - Filters by radius using Haversine distance from center pincode.
    - Uses exact Appendix B area coordinates (never reporter GPS).
    - Excludes reports older than the specified days window.
    """
    if pincode and pincode.strip():
        center_pin = pincode.strip()
        nearby_areas = get_areas_within_radius(center_pin, radius_km)
        if not nearby_areas:
            area_obj = get_area_by_pincode(center_pin)
            if area_obj:
                nearby_areas = [area_obj]
            else:
                return MapResponse(clusters=[], points=[])
    else:
        nearby_areas = list(APPENDIX_B_AREAS.values())

    nearby_pincodes = [a["pincode"] for a in nearby_areas]
    area_lookup = {a["pincode"]: a for a in nearby_areas}

    # Calculate cutoff time based on occurred_at
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()

    placeholders = ",".join("?" for _ in nearby_pincodes)
    query = f"""
    SELECT pincode, scam_type, COUNT(*) as report_count
    FROM reports
    WHERE pincode IN ({placeholders})
      AND occurred_at >= ?
      AND status = 'ACCEPTED'
    GROUP BY pincode, scam_type
    ORDER BY report_count DESC
    """
    params = list(nearby_pincodes) + [cutoff]

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(query, tuple(params))
        rows = cur.fetchall()

    # Aggregate by pincode
    clusters_dict = {}
    for r in rows:
        pin = r["pincode"]
        stype = r["scam_type"]
        cnt = r["report_count"]

        if pin not in clusters_dict:
            clusters_dict[pin] = {
                "count": 0,
                "scam_types": {},
            }
        clusters_dict[pin]["count"] += cnt
        clusters_dict[pin]["scam_types"][stype] = clusters_dict[pin]["scam_types"].get(stype, 0) + cnt

    clusters = []
    for pin, data in clusters_dict.items():
        area = area_lookup.get(pin)
        if not area or data["count"] == 0:
            continue

        # Top scam type in this cluster
        top_scam = max(data["scam_types"].items(), key=lambda x: x[1])[0] if data["scam_types"] else "other"
        
        # Severity calculation
        total_reports = data["count"]
        if total_reports >= 10:
            severity = "CRIT"
        elif total_reports >= 5:
            severity = "HIGH"
        else:
            severity = "MED"

        clusters.append(
            MapCluster(
                pincode=pin,
                locality=area["locality"],
                city=area["city"],
                count=total_reports,
                top_scam_type=top_scam,
                scam_type=top_scam,
                severity=severity,
                lat=area["lat"],
                lng=area["lng"]
            )
        )

    points = [
        {
            "pincode": c.pincode,
            "locality": c.locality,
            "city": c.city,
            "count": c.count,
            "scam_type": c.top_scam_type,
            "severity": c.severity,
            "lat": c.lat,
            "lng": c.lng
        }
        for c in clusters
    ]

    return MapResponse(clusters=clusters, points=points)

