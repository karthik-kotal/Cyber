from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query
from app.database import get_db_connection
from app.schemas import MapResponse, MapCluster, MapDiagnostic, UnmappedAreaInfo
from app.areas import (
    APPENDIX_B_AREAS,
    get_areas_within_radius,
    get_area_by_pincode,
    resolve_pincode_area,
    haversine_distance_km,
    is_valid_pincode,
)


router = APIRouter()


@router.get("/map", response_model=MapResponse)
def get_map(
    pincode: Optional[str] = Query(None, description="Center pincode for radius filtering"),
    days: int = Query(7, ge=1, le=90, description="Time window in days (default 7)"),
    radius_km: float = Query(2.0, ge=0.1, le=500.0, description="Search radius in kilometers (default 2)")
):
    """
    GET /map?pincode=560102&days=7&radius_km=2
    Lists scam reports by area for the specified days window (default 7).
    - If pincode is provided: filters by radius using Haversine distance from center pincode.
    - If pincode is not provided (global map): returns all eligible mapped clusters across India.
    - Resolves known pincodes to geographic area centroids (never exposes reporter GPS).
    - Accurately tracks diagnostic statistics and unmapped reports for transparency.
    """
    now = datetime.now(timezone.utc)
    days_val = days if isinstance(days, int) else 7
    radius_val = float(radius_km) if isinstance(radius_km, (int, float)) else 2.0
    cutoff = (now - timedelta(days=days_val)).isoformat()

    center_pin = pincode.strip() if isinstance(pincode, str) and pincode.strip() else None
    center_info = resolve_pincode_area(center_pin) if center_pin else None

    with get_db_connection() as conn:
        cur = conn.cursor()

        # 1. Diagnostic totals
        cur.execute("SELECT COUNT(*) FROM reports WHERE status = 'ACCEPTED'")
        total_reports_all_time = cur.fetchone()[0]

        # 2. Fetch all accepted reports for audit and aggregation
        cur.execute(
            """
            SELECT id, pincode, scam_type, occurred_at
            FROM reports
            WHERE status = 'ACCEPTED'
            """
        )
        all_accepted_reports = cur.fetchall()

    # Track diagnostics
    reports_with_valid_pincodes = 0
    reports_with_recognized_areas = 0
    reports_with_coordinates = 0
    exclusion_reasons: Dict[str, int] = {
        "older_than_window": 0,
        "missing_pincode": 0,
        "unmapped_pincode": 0,
        "outside_search_radius": 0,
    }

    # Data structures for clustering
    # Key: primary_pincode or cluster key
    clusters_dict: Dict[str, Dict[str, Any]] = {}
    unmapped_dict: Dict[str, Dict[str, Any]] = {}

    for row in all_accepted_reports:
        rep_id = row["id"]
        raw_pin = row["pincode"]
        stype = row["scam_type"] or "other"
        occ_at = row["occurred_at"]

        # Validate pincode format
        clean_pin = str(raw_pin).strip() if raw_pin is not None else ""
        if not clean_pin:
            exclusion_reasons["missing_pincode"] += 1
            continue

        if not is_valid_pincode(clean_pin):
            exclusion_reasons["missing_pincode"] += 1
            continue

        reports_with_valid_pincodes += 1

        # Resolve area
        area = resolve_pincode_area(clean_pin)
        if not area:
            exclusion_reasons["unmapped_pincode"] += 1
            continue

        reports_with_recognized_areas += 1

        has_coords = area.get("is_mapped") and area.get("lat") is not None and area.get("lng") is not None
        if has_coords:
            reports_with_coordinates += 1
        else:
            if clean_pin not in unmapped_dict:
                unmapped_dict[clean_pin] = {
                    "pincode": clean_pin,
                    "count": 0,
                    "locality": area.get("locality"),
                    "city": area.get("city"),
                    "reason": "Coordinates not yet registered for this pincode"
                }
            unmapped_dict[clean_pin]["count"] += 1

        # Check time window
        if occ_at < cutoff:
            exclusion_reasons["older_than_window"] += 1
            continue

        # If not geocoded with coordinates, cannot be plotted on the map
        if not has_coords:
            exclusion_reasons["unmapped_pincode"] += 1
            continue

        # If center pincode radius filtering is active
        if center_pin:
            # If center_info itself is not mapped, no nearby areas can be resolved
            if not center_info or not center_info.get("is_mapped") or center_info.get("lat") is None:
                # If the report matches the center_pin directly
                if clean_pin != center_pin:
                    exclusion_reasons["outside_search_radius"] += 1
                    continue
            else:
                dist_km = haversine_distance_km(center_info["lat"], center_info["lng"], area["lat"], area["lng"])
                if dist_km > radius_val and clean_pin != center_pin:
                    exclusion_reasons["outside_search_radius"] += 1
                    continue

        # Eligible report -> aggregate into cluster!
        cluster_key = area.get("primary_pincode") or clean_pin
        if cluster_key not in clusters_dict:
            clusters_dict[cluster_key] = {
                "pincode": cluster_key,
                "display_pincode": clean_pin if cluster_key == clean_pin else f"{cluster_key} ({clean_pin})",
                "locality": area["locality"],
                "city": area["city"],
                "lat": area["lat"],
                "lng": area["lng"],
                "count": 0,
                "scam_types": {},
            }
        clusters_dict[cluster_key]["count"] += 1
        clusters_dict[cluster_key]["scam_types"][stype] = (
            clusters_dict[cluster_key]["scam_types"].get(stype, 0) + 1
        )

    # Build final MapCluster objects
    clusters: List[MapCluster] = []
    total_in_clusters = 0

    for c_key, c_data in sorted(clusters_dict.items(), key=lambda x: x[1]["count"], reverse=True):
        cnt = c_data["count"]
        if cnt == 0:
            continue

        total_in_clusters += cnt
        top_scam = (
            max(c_data["scam_types"].items(), key=lambda x: x[1])[0]
            if c_data["scam_types"]
            else "other"
        )

        if cnt >= 10:
            severity = "CRIT"
        elif cnt >= 5:
            severity = "HIGH"
        else:
            severity = "MED"

        clusters.append(
            MapCluster(
                pincode=c_data["pincode"],
                locality=c_data["locality"],
                city=c_data["city"],
                count=cnt,
                top_scam_type=top_scam,
                scam_type=top_scam,
                severity=severity,
                lat=float(c_data["lat"]),
                lng=float(c_data["lng"]),
            )
        )

    # Legacy points array matching clusters
    points = [
        {
            "pincode": c.pincode,
            "locality": c.locality,
            "city": c.city,
            "count": c.count,
            "scam_type": c.top_scam_type,
            "top_scam_type": c.top_scam_type,
            "severity": c.severity,
            "lat": c.lat,
            "lng": c.lng,
        }
        for c in clusters
    ]

    unmapped_list: List[UnmappedAreaInfo] = [
        UnmappedAreaInfo(
            pincode=item["pincode"],
            count=item["count"],
            locality=item["locality"],
            city=item["city"],
            reason=item["reason"],
        )
        for item in unmapped_dict.values()
    ]

    unmapped_pincodes_list = sorted(list(unmapped_dict.keys()))

    diagnostics = MapDiagnostic(
        total_reports=total_reports_all_time,
        reports_with_valid_pincodes=reports_with_valid_pincodes,
        reports_with_recognized_areas=reports_with_recognized_areas,
        reports_with_coordinates=reports_with_coordinates,
        reports_in_clusters=total_in_clusters,
        unmapped_reports_count=sum(item["count"] for item in unmapped_dict.values()),
        unmapped_pincodes=unmapped_pincodes_list,
        exclusion_reasons=exclusion_reasons,
    )

    return MapResponse(
        clusters=clusters,
        points=points,
        diagnostics=diagnostics,
        unmapped=unmapped_list if unmapped_list else None,
    )
