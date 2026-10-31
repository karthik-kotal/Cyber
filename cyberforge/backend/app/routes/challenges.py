import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import JSONResponse
from app.database import get_db_connection
from app.schemas import ChallengeCreate, ChallengeResponse, StatusString
from app.normalize import normalize_identifier, InvalidIdentifierError
from app.trust_engine import evaluate_trust


router = APIRouter()


@router.post("/challenges", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
def create_challenge(payload: ChallengeCreate):
    """
    POST /challenges
    A business disputes a reported number / identifier.
    Reply 201 with {"challenge_id": "...", "status": "under_review"}.
    After that, lookup shows "challenged": true and is never KNOWN_SCAM while under review.
    """
    raw_id = payload.identifier_value or payload.identifier
    if not raw_id and payload.report_id:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT identifier FROM reports WHERE id = ?", (payload.report_id,))
            row = cur.fetchone()
            if row:
                raw_id = row["identifier"]
            else:
                raw_id = payload.report_id

    if not raw_id:
        return JSONResponse(status_code=400, content={"error": "Missing identifier_value"})

    try:
        norm = normalize_identifier(raw_id, payload.identifier_type)
    except InvalidIdentifierError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    normalized_id = norm.normalized_value
    challenge_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    claimant = payload.claimant_name or payload.challenger_name or "Anonymous Business"
    proof = payload.proof_note or payload.reason or "Under review"

    with get_db_connection() as conn:
        with conn:
            conn.execute(
                """
                INSERT INTO challenges (
                    id, identifier, identifier_type, claimant_name,
                    contact_email, proof_note, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'under_review', ?)
                """,
                (
                    challenge_id, normalized_id, norm.identifier_type, claimant,
                    payload.contact_email, proof, now_iso
                )
            )

            # Update case challenged flag and recalculate verdict
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM verified_businesses WHERE identifier = ?", (normalized_id,))
            is_verified = cur.fetchone()[0] > 0

            cur.execute(
                """
                SELECT reporter_hmac, ip_prefix_hmac, note_fingerprint, status, occurred_at, scam_type,
                       file_sha256, phash, tx_ref_hmac, ocr_fingerprint, created_at
                FROM reports WHERE identifier = ? AND status = 'ACCEPTED'
                """,
                (normalized_id,)
            )
            reports = [dict(row) for row in cur.fetchall()]

            verdict, distinct_reps, _, _ = evaluate_trust(
                reports=reports,
                is_verified=is_verified,
                is_challenged=True,
                identifier_type=norm.identifier_type,
                normalized_value=normalized_id
            )

            conn.execute(
                """
                UPDATE cases SET
                    challenged = 1,
                    verdict = ?,
                    distinct_reporters = ?,
                    updated_at = ?
                WHERE identifier = ?
                """,
                (verdict, distinct_reps, now_iso, normalized_id)
            )

    return ChallengeResponse(
        challenge_id=challenge_id,
        id=challenge_id,
        status=StatusString("under_review"),
        identifier=normalized_id,
        message="Dispute registered. Case marked as challenged and under review.",
        created_at=now_iso
    )


@router.post("/reports/{report_id}/challenge", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
@router.post("/report/{report_id}/challenge", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
def challenge_by_report_id(report_id: str, payload: Optional[ChallengeCreate] = None):
    if payload is None:
        payload = ChallengeCreate(report_id=report_id)
    else:
        payload.report_id = report_id
    return create_challenge(payload)



@router.get("/challenges", response_model=List[ChallengeResponse])
def list_challenges(
    identifier: Optional[str] = Query(None, description="Filter challenges by identifier")
):
    with get_db_connection() as conn:
        cur = conn.cursor()
        if identifier:
            norm = normalize_identifier(identifier)
            cur.execute(
                "SELECT id, identifier, status FROM challenges WHERE identifier = ? ORDER BY created_at DESC",
                (norm.normalized_value,)
            )
        else:
            cur.execute("SELECT id, identifier, status FROM challenges ORDER BY created_at DESC LIMIT 50")

        rows = cur.fetchall()
        return [
            ChallengeResponse(
                challenge_id=r["id"],
                identifier=r["identifier"],
                status=r["status"],
                message=f"Challenge is currently {r['status']}"
            )
            for r in rows
        ]
