from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app.config import settings
from app.database import get_db_connection
from app.schemas import AdminResetResponse
from app.verified import APPENDIX_C_VERIFIED


router = APIRouter()


@router.post("/admin/reset", response_model=AdminResetResponse)
def reset_database(x_admin_token: Optional[str] = Header(None)):
    """
    POST /admin/reset
    Deletes all reports, cases, alerts, challenges, and re-seeds Appendix C verified businesses.
    No login/token required per PRD rule 5 (when no token is supplied).
    If an invalid token is explicitly supplied, rejects with 401.
    Replies 200 with {"ok": true, ...}.
    """
    token_str = None
    if isinstance(x_admin_token, str):
        token_str = x_admin_token
    elif x_admin_token is not None and type(x_admin_token).__name__ != "Header":
        token_str = str(x_admin_token)

    if token_str is not None and token_str != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    with get_db_connection() as conn:
        with conn:
            conn.execute("DELETE FROM reports;")
            conn.execute("DELETE FROM cases;")
            conn.execute("DELETE FROM challenges;")
            conn.execute("DELETE FROM alerts;")
            conn.execute("DELETE FROM evidence;")
            conn.execute("DELETE FROM transaction_references;")
            conn.execute("DELETE FROM verified_businesses;")

            # Re-seed all 19 Appendix C verified entities
            for item in APPENDIX_C_VERIFIED:
                conn.execute(
                    """
                    INSERT INTO verified_businesses (
                        identifier, identifier_type, business_name, category, raw_value, created_at
                    ) VALUES (?, ?, ?, ?, ?, datetime('now'))
                    """,
                    (item["normalized"], item["type"], item["belongs_to"], item["category"], item["raw"])
                )

    return AdminResetResponse(
        ok=True,
        status="RESET_OK",
        message="Deleted all reports and re-seeded verified businesses"
    )


@router.post("/admin/verified-businesses")
def add_verified_business(payload, x_admin_token: Optional[str] = Header(None)):
    from app.normalize import normalize_identifier
    norm = normalize_identifier(payload.identifier)
    with get_db_connection() as conn:
        with conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO verified_businesses (
                    identifier, identifier_type, business_name, category, raw_value, created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
                """,
                (norm.normalized_value, norm.identifier_type, payload.business_name, payload.category, payload.identifier)
            )
    return payload


@router.get("/admin/verified-businesses")
def list_verified_businesses():
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT identifier, business_name, category FROM verified_businesses")
        rows = cur.fetchall()
        from app.schemas import VerifiedBusinessItem
        return [
            VerifiedBusinessItem(
                identifier=r["identifier"],
                business_name=r["business_name"],
                category=r["category"]
            )
            for r in rows
        ]
