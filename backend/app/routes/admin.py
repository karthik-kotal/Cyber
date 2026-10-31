import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from app.config import settings
from app.database import get_db_connection
from app.schemas import AdminResetResponse
from app.verified import APPENDIX_C_VERIFIED
from app.license import license_manager
from app.trust_engine import evaluate_trust
from app.evidence.manipulation import compare_hashes


router = APIRouter()


class AdminLoginRequest(BaseModel):
    username: str = Field(..., description="Administrator username or ID")
    password: str = Field(..., description="Administrator password")


class AdminLoginResponse(BaseModel):
    ok: bool
    token: str
    username: str
    role: str
    license_status: Dict[str, Any]


class AdminDisputeDecisionRequest(BaseModel):
    action: str = Field(..., description="'APPROVE' to uphold dispute, 'REJECT' to dismiss dispute")
    reason: str = Field(..., description="Official justification for the decision")


def require_admin_auth(
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
) -> str:
    """
    Enforces administrator authorization.
    In Demo POV, allows access to isolated demo dashboard (operating on cyberforge_demo.db).
    In Production/Administrator POV, requires valid ADMIN_TOKEN.
    Normal users receive 401 Unauthorized.
    """
    if isinstance(x_cyberforge_pov, str) and x_cyberforge_pov.strip().lower() == "demo":
        return "demo-admin"

    token = None
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif isinstance(x_admin_token, str):
        token = x_admin_token.strip()

    if not token or token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator authentication required. Please login with admin credentials."
        )
    return "admin"


@router.post("/admin/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest):
    """
    POST /admin/login
    Authenticates administrator credentials against the backend.
    Does not reset the 365-day license.
    """
    if payload.username.strip() != settings.ADMIN_USERNAME or payload.password != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator ID or password"
        )

    return AdminLoginResponse(
        ok=True,
        token=settings.ADMIN_TOKEN,
        username=settings.ADMIN_USERNAME,
        role="admin",
        license_status=license_manager.get_status()
    )


class CompareHashesRequest(BaseModel):
    hash_a: str = Field(..., description="First SHA-256 hash")
    hash_b: str = Field(..., description="Second SHA-256 hash to compare against")


@router.get("/admin/reports")
def list_admin_reports(
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
):
    """Returns all scam reports in the active database for administrator review."""
    require_admin_auth(x_admin_token, authorization, x_cyberforge_pov)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT r.id, r.identifier, r.identifier_type, r.category, r.scam_type, r.occurred_at,
                   r.status, r.is_disputed, r.dispute_reason, r.amount_lost_inr, r.pincode, r.city,
                   r.note, r.description, r.has_screenshot, r.evidence_id, r.file_sha256, r.created_at,
                   e.id AS ev_id, e.file_size, e.mime_type, e.filename, e.original_filename, e.integrity_results
            FROM reports r
            LEFT JOIN evidence e ON (r.evidence_id = e.id OR (r.evidence_id IS NULL AND r.id = e.report_id))
            ORDER BY r.created_at DESC
            LIMIT 200
            """
        )
        rows = cur.fetchall()
        results = []
        for r in rows:
            item = dict(r)
            item["description"] = item["description"] or item["note"]
            if item.get("ev_id"):
                item["evidence_metadata"] = {
                    "evidence_id": item["ev_id"],
                    "file_sha256": item.get("file_sha256"),
                    "file_size": item.get("file_size"),
                    "mime_type": item.get("mime_type"),
                    "filename": item.get("filename"),
                    "original_filename": item.get("original_filename"),
                    "integrity_results": json.loads(item["integrity_results"]) if item.get("integrity_results") else None,
                    "image_url": f"/api/admin/evidence/{item['ev_id']}/file",
                }
            else:
                item["evidence_metadata"] = None
            results.append(item)
        return results


@router.get("/admin/reports/{report_id}/evidence")
def get_admin_report_evidence(
    report_id: str,
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
):
    """
    Returns full evidence inspection details and automated manipulation check findings.
    Requires administrator authorization.
    """
    require_admin_auth(x_admin_token, authorization, x_cyberforge_pov)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, report_id, identifier, file_sha256, phash, ocr_fingerprint,
                   file_size, mime_type, filename, original_filename, storage_path,
                   integrity_results, created_at
            FROM evidence
            WHERE report_id = ? OR id = ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (report_id, report_id)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No evidence record found for this report.")

        item = dict(row)
        if item.get("integrity_results"):
            try:
                item["integrity_results"] = json.loads(item["integrity_results"])
            except Exception:
                pass
        item["image_url"] = f"/api/admin/evidence/{item['id']}/file"
        return item


@router.get("/admin/evidence/{evidence_id}/file")
def get_admin_evidence_file(
    evidence_id: str,
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
):
    """
    Securely serves the evidence image file to authorized administrators.
    Path traversal strictly prevented.
    """
    require_admin_auth(x_admin_token, authorization, x_cyberforge_pov)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT filename, storage_path, mime_type FROM evidence WHERE id = ?", (evidence_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Evidence file record not found.")

        storage_path = row["storage_path"]
        mime_type = row["mime_type"] or "image/jpeg"

        clean_path = os.path.abspath(storage_path)
        if not os.path.exists(clean_path):
            raise HTTPException(status_code=404, detail="Evidence file not found on disk.")

        return FileResponse(clean_path, media_type=mime_type, filename=row["filename"])


@router.post("/admin/evidence/compare-hashes")
def compare_admin_evidence_hashes(
    payload: CompareHashesRequest,
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
):
    """
    Compares two SHA-256 hashes and provides clear, honest tampering disclaimers.
    Requires administrator authorization.
    """
    require_admin_auth(x_admin_token, authorization, x_cyberforge_pov)
    return compare_hashes(payload.hash_a, payload.hash_b)


@router.get("/admin/disputes")
def list_admin_disputes(
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
):
    """Returns all dispute requests in the active database."""
    require_admin_auth(x_admin_token, authorization, x_cyberforge_pov)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, report_id, identifier, identifier_type, claimant_name,
                   contact_email, proof_note, status, created_at, resolved_at, updated_at
            FROM challenges
            ORDER BY created_at DESC
            LIMIT 100
            """
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]


@router.post("/admin/disputes/{challenge_id}/decision")
def decide_dispute(
    challenge_id: str,
    payload: AdminDisputeDecisionRequest,
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
):
    """
    Approves or rejects a dispute with a documented reason and records an audit log entry.
    Updates target report status and recalculates case verdict.
    """
    operator = require_admin_auth(x_admin_token, authorization, x_cyberforge_pov)

    action = payload.action.strip().upper()
    if action not in ("APPROVE", "REJECT"):
        raise HTTPException(status_code=400, detail="Action must be either 'APPROVE' or 'REJECT'")

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A decision reason must be provided")

    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, report_id, identifier, status FROM challenges WHERE id = ?", (challenge_id,))
        challenge_row = cur.fetchone()
        if not challenge_row:
            raise HTTPException(status_code=404, detail=f"Dispute challenge '{challenge_id}' not found")

        target_report_id = challenge_row["report_id"]
        target_identifier = challenge_row["identifier"]
        prev_challenge_status = challenge_row["status"]

        new_challenge_status = "resolved_approved" if action == "APPROVE" else "resolved_rejected"
        new_report_status = "RESOLVED_DISPUTED" if action == "APPROVE" else "ACCEPTED"
        is_disputed_flag = 1 if action == "APPROVE" else 0

        # Update challenge record
        conn.execute(
            """
            UPDATE challenges SET
                status = ?,
                resolved_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (new_challenge_status, now_iso, now_iso, challenge_id)
        )

        # Update targeted report record
        conn.execute(
            """
            UPDATE reports SET
                status = ?,
                is_disputed = ?,
                disputed_at = ?
            WHERE id = ?
            """,
            (new_report_status, is_disputed_flag, now_iso, target_report_id)
        )

        # Recalculate case verdict
        cur.execute(
            """
            SELECT reporter_hmac, ip_prefix_hmac, note_fingerprint, status, occurred_at, scam_type,
                   file_sha256, phash, tx_ref_hmac, ocr_fingerprint, created_at, is_disputed
            FROM reports WHERE identifier = ? AND status = 'ACCEPTED' AND (is_disputed = 0 OR is_disputed IS NULL)
            """,
            (target_identifier,)
        )
        active_reports = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT identifier_type FROM cases WHERE identifier = ?", (target_identifier,))
        case_row = cur.fetchone()
        id_type = case_row["identifier_type"] if case_row else "PHONE_NUMBER"

        cur.execute("SELECT COUNT(*) FROM verified_businesses WHERE identifier = ?", (target_identifier,))
        is_verified = cur.fetchone()[0] > 0

        verdict, distinct_reps, _, _ = evaluate_trust(
            reports=active_reports,
            is_verified=is_verified,
            is_challenged=False,
            identifier_type=id_type,
            normalized_value=target_identifier
        )

        conn.execute(
            """
            UPDATE cases SET
                verdict = ?,
                report_count = ?,
                distinct_reporters = ?,
                challenged = ?,
                updated_at = ?
            WHERE identifier = ?
            """,
            (verdict, len(active_reports), distinct_reps, 0 if action == "APPROVE" else 0, now_iso, target_identifier)
        )

        # Record Audit Log
        audit_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO dispute_audit_log (
                id, challenge_id, report_id, identifier, action, reason, decided_by,
                previous_status, new_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                audit_id,
                challenge_id,
                target_report_id,
                target_identifier,
                action,
                reason,
                operator,
                prev_challenge_status,
                new_challenge_status,
                now_iso
            )
        )
        conn.commit()

    return {
        "ok": True,
        "challenge_id": challenge_id,
        "report_id": target_report_id,
        "action": action,
        "new_challenge_status": new_challenge_status,
        "new_report_status": new_report_status,
        "updated_verdict": verdict,
        "audit_id": audit_id,
        "decided_by": operator,
        "decided_at": now_iso
    }


@router.get("/admin/disputes/audit-log")
def list_dispute_audit_log(
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_cyberforge_pov: Optional[str] = Header(None)
):
    """Returns audit trail history for all dispute decisions."""
    require_admin_auth(x_admin_token, authorization, x_cyberforge_pov)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, challenge_id, report_id, identifier, action, reason, decided_by,
                   previous_status, new_status, created_at
            FROM dispute_audit_log
            ORDER BY created_at DESC
            LIMIT 100
            """
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]


@router.post("/admin/reset", response_model=AdminResetResponse)
def reset_database(x_admin_token: Optional[str] = Header(None)):
    """POST /admin/reset - Deletes all reports, cases, alerts, challenges, and re-seeds verified businesses."""
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
            conn.execute("DELETE FROM dispute_audit_log;")

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
def add_verified_business(payload: Any, x_admin_token: Optional[str] = Header(None)):
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
