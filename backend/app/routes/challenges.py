from app.normalize import normalize_identifier
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.database import get_db_connection
from app.schemas import ChallengeCreate, ChallengeResponse, StatusString
from app.config import settings
from app.trust_engine import evaluate_trust


router = APIRouter()


def _validate_reference_id_format(ref_id: str) -> None:
    """
    Ensures the user entered a report Reference ID and not a phone number, bank account,
    UPI ID, URL, or identifier.
    """
    clean = ref_id.strip()

    # 1. Phone numbers (10-13 digits or +91...)
    digits_only = re.sub(r"[\s\-\(\)\.\+]+", "", clean)
    if digits_only.isdigit() and len(digits_only) in (10, 11, 12, 13) and (
        digits_only.startswith(("6", "7", "8", "9")) or digits_only.startswith("91") or digits_only.startswith("0")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Reference ID: '{clean}' is a phone number. Disputes must target a specific report Reference ID, not a phone number."
        )

    # 2. Bank accounts (ACC: prefix, IFSC: prefix, IFSC:ACC format, or 9-18 pure digits)
    clean_lower = clean.lower()
    if clean.upper().startswith("ACC:") or clean.upper().startswith("IFSC:") or (
        ":" in clean and not (clean_lower.startswith("http://") or clean_lower.startswith("https://"))
    ) or (digits_only.isdigit() and 9 <= len(digits_only) <= 18 and (clean.isdigit() or clean.startswith("ACC:"))):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Reference ID: '{clean}' is a bank account number. Disputes must target a specific report Reference ID, not a bank account."
        )

    # 3. UPI ID or Email (contains @ and not a standard UUID)
    if "@" in clean and not ("-" in clean and len(clean) == 36):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Reference ID: '{clean}' is a UPI ID or email address. Disputes must target a specific report Reference ID, not a UPI ID."
        )

    # 4. URLs, Websites, or WhatsApp links
    if (
        clean_lower.startswith("http://") or
        clean_lower.startswith("https://") or
        "wa.me/" in clean_lower or
        "api.whatsapp.com" in clean_lower or
        ("." in clean and ("/" in clean or "www." in clean_lower))
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Reference ID: '{clean}' is a URL or website address. Disputes must target a specific report Reference ID, not a link."
        )


@router.post("/disputes", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
@router.post("/challenges", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
def create_challenge(payload: ChallengeCreate):
    """
    POST /api/disputes or POST /api/challenges
    Supports both:
    1. Bonus PRD endpoint: {identifier_type, identifier_value, claimant_name, contact_email, proof_note}
       Creates challenge for the identifier and marks status under_review.
    2. Report dispute endpoint: {reference_id or report_id, proof_note, ...}
       Disputes a specific individual report identified by Reference ID.
    """
    raw_ident_val = payload.identifier_value
    if raw_ident_val and str(raw_ident_val).strip():
        # 1. Identifier-based challenge from Hackathon Brief (Image 4, Item 7)
        try:
            norm = normalize_identifier(str(raw_ident_val).strip(), payload.identifier_type)
            target_identifier = norm.normalized_value
            target_id_type = norm.identifier_type
        except Exception:
            target_identifier = str(raw_ident_val).strip()
            target_id_type = payload.identifier_type or "phone"

        reason = payload.proof_note or payload.reason or "Challenge filed by business claimant"
        claimant = payload.claimant_name or payload.challenger_name or "Anonymous Claimant"
        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM reports WHERE identifier = ? LIMIT 1", (target_identifier,))
            rep_row = cur.fetchone()
            target_report_id = rep_row[0] if rep_row else None

            # Check if active challenge exists
            clean_spaces = str(raw_ident_val).strip().replace(" ", "")
            cur.execute(
                """
                SELECT id, status FROM challenges
                WHERE (identifier = ? OR identifier = ? OR identifier = ?)
                  AND status IN ('under_review', 'ACTIVE')
                """,
                (target_identifier, str(raw_ident_val).strip(), clean_spaces)
            )
            existing_ch = cur.fetchone()
            if existing_ch:
                challenge_id = existing_ch[0]
                conn.execute(
                    "UPDATE challenges SET proof_note = ?, updated_at = ? WHERE id = ?",
                    (reason, now_iso, challenge_id)
                )
            else:
                challenge_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO challenges (
                        id, report_id, identifier, identifier_type, claimant_name,
                        contact_email, proof_note, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'under_review', ?)
                    """,
                    (
                        challenge_id, target_report_id, target_identifier, target_id_type,
                        claimant, payload.contact_email, reason, now_iso
                    )
                )

            # Mark all reports for this identifier as disputed
            conn.execute(
                """
                UPDATE reports SET
                    is_disputed = 1,
                    dispute_reason = ?,
                    disputed_at = ?
                WHERE identifier = ? OR identifier = ?
                """,
                (reason, now_iso, target_identifier, str(raw_ident_val).strip())
            )

            # Update or insert into cases with challenged = 1
            cur.execute("SELECT identifier FROM cases WHERE identifier = ?", (target_identifier,))
            if cur.fetchone():
                conn.execute(
                    """
                    UPDATE cases SET
                        challenged = 1,
                        verdict = CASE WHEN verdict = 'KNOWN_SCAM' THEN 'SUSPICIOUS' ELSE verdict END,
                        updated_at = ?
                    WHERE identifier = ?
                    """,
                    (now_iso, target_identifier)
                )
            else:
                conn.execute(
                    """
                    INSERT INTO cases (
                        identifier, identifier_type, first_seen, last_seen, verdict, challenged, report_count,
                        distinct_reporters, updated_at
                    ) VALUES (?, ?, ?, ?, 'NO_REPORTS', 1, 0, 0, ?)
                    """,
                    (target_identifier, target_id_type, now_iso, now_iso, now_iso)
                )
            conn.commit()

        return ChallengeResponse(
            challenge_id=challenge_id,
            id=challenge_id,
            reference_id=target_report_id or target_identifier,
            report_id=target_report_id,
            status=StatusString("under_review"),
            identifier=target_identifier,
            message=f"Challenge registered for {target_identifier}. Marked as under review.",
            created_at=now_iso
        )

    # 2. Report ID based dispute
    raw_ref = payload.reference_id or payload.report_id or payload.identifier
    if not raw_ref or not str(raw_ref).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing report Reference ID. Disputes must target an individual report Reference ID."
        )

    ref_id = str(raw_ref).strip()

    # Reject non-reference-id strings (phone, bank, UPI, URL, etc.)
    _validate_reference_id_format(ref_id)

    # Look up report in the database
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, identifier, identifier_type, category, scam_type, occurred_at, status, is_disputed
            FROM reports WHERE id = ?
            """,
            (ref_id,)
        )
        report_row = cur.fetchone()

        if not report_row:
            cur.execute("SELECT identifier FROM cases WHERE identifier = ?", (ref_id,))
            case_match = cur.fetchone()
            if case_match:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid Reference ID: '{ref_id}' is an identifier/case, not a report Reference ID. Disputes apply to individual reports."
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report Reference ID '{ref_id}' not found. Please provide a valid report Reference ID."
            )

        target_report_id = report_row["id"]
        target_identifier = report_row["identifier"]
        target_id_type = report_row["identifier_type"]

        reason = payload.reason or payload.proof_note or "Report disputed by claimant"
        claimant = payload.claimant_name or payload.challenger_name or "Anonymous Claimant"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Check if an active dispute already exists for this exact report
        cur.execute(
            "SELECT id, status FROM challenges WHERE report_id = ? AND status IN ('under_review', 'ACTIVE')",
            (target_report_id,)
        )
        existing_ch = cur.fetchone()

        if existing_ch:
            challenge_id = existing_ch["id"]
            conn.execute(
                "UPDATE challenges SET proof_note = ?, updated_at = ? WHERE id = ?",
                (reason, now_iso, challenge_id)
            )
        else:
            challenge_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO challenges (
                    id, report_id, identifier, identifier_type, claimant_name,
                    contact_email, proof_note, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'under_review', ?)
                """,
                (
                    challenge_id, target_report_id, target_identifier, target_id_type,
                    claimant, payload.contact_email, reason, now_iso
                )
            )

        # Mark individual report as disputed in reports table
        conn.execute(
            """
            UPDATE reports SET
                is_disputed = 1,
                dispute_reason = ?,
                disputed_at = ?
            WHERE id = ?
            """,
            (reason, now_iso, target_report_id)
        )

        # Recalculate case status without deleting the report or evidence
        cur.execute(
            """
            SELECT reporter_hmac, ip_prefix_hmac, note_fingerprint, status, occurred_at, scam_type,
                   file_sha256, phash, tx_ref_hmac, ocr_fingerprint, created_at, is_disputed
            FROM reports WHERE identifier = ? AND status = 'ACCEPTED'
            """,
            (target_identifier,)
        )
        all_reports = [dict(r) for r in cur.fetchall()]

        active_reports = [r for r in all_reports if not r.get("is_disputed")]

        cur.execute("SELECT COUNT(*) FROM verified_businesses WHERE identifier = ?", (target_identifier,))
        is_verified = cur.fetchone()[0] > 0

        has_disputed = len(all_reports) > len(active_reports)
        all_disputed = len(active_reports) == 0 and len(all_reports) > 0

        verdict, distinct_reps, _, _ = evaluate_trust(
            reports=active_reports if len(active_reports) > 0 else all_reports,
            is_verified=is_verified,
            is_challenged=all_disputed or (len(active_reports) < settings.KNOWN_SCAM_MIN_SOURCES and has_disputed),
            identifier_type=target_id_type,
            normalized_value=target_identifier
        )

        conn.execute(
            """
            UPDATE cases SET
                challenged = ?,
                verdict = ?,
                updated_at = ?
            WHERE identifier = ?
            """,
            (1 if has_disputed else 0, verdict, now_iso, target_identifier)
        )
        conn.commit()

    return ChallengeResponse(
        challenge_id=challenge_id,
        id=challenge_id,
        reference_id=target_report_id,
        report_id=target_report_id,
        status=StatusString("under_review"),
        identifier=target_identifier,
        message=f"Dispute registered for report {target_report_id}. Individual report marked as disputed and under review.",
        created_at=now_iso
    )


@router.post("/reports/{report_id}/dispute", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
@router.post("/report/{report_id}/dispute", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
@router.post("/reports/{report_id}/challenge", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
@router.post("/report/{report_id}/challenge", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
def challenge_by_report_id(report_id: str, payload: Optional[ChallengeCreate] = None):
    """Path parameter variant for disputing an individual report."""
    if payload is None:
        payload = ChallengeCreate(reference_id=report_id)
    else:
        payload.reference_id = report_id
        payload.report_id = report_id
    return create_challenge(payload)


@router.get("/disputes", response_model=List[ChallengeResponse])
@router.get("/challenges", response_model=List[ChallengeResponse])
def list_challenges(
    report_id: Optional[str] = Query(None, description="Filter by report Reference ID"),
    reference_id: Optional[str] = Query(None, description="Filter by report Reference ID"),
    identifier: Optional[str] = Query(None, description="Filter by identifier")
):
    target_ref = report_id or reference_id
    with get_db_connection() as conn:
        cur = conn.cursor()
        if target_ref:
            cur.execute(
                "SELECT id, report_id, identifier, status, created_at FROM challenges WHERE report_id = ? ORDER BY created_at DESC",
                (target_ref,)
            )
        elif identifier:
            cur.execute(
                "SELECT id, report_id, identifier, status, created_at FROM challenges WHERE identifier = ? ORDER BY created_at DESC",
                (identifier,)
            )
        else:
            cur.execute("SELECT id, report_id, identifier, status, created_at FROM challenges ORDER BY created_at DESC LIMIT 50")

        rows = cur.fetchall()
        return [
            ChallengeResponse(
                challenge_id=r["id"],
                id=r["id"],
                reference_id=r["report_id"],
                report_id=r["report_id"],
                identifier=r["identifier"],
                status=r["status"],
                message=f"Challenge is currently {r['status']}",
                created_at=r["created_at"]
            )
            for r in rows
        ]
