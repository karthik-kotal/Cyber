import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, Request, HTTPException
from app.database import get_db_connection
from app.schemas import LookupResponse
from app.config import settings
from app.normalize import normalize_identifier, mask_identifier, InvalidIdentifierError
from app.trust_engine import evaluate_trust


router = APIRouter()

VALID_LOOKUP_TYPES = {
    "phone", "upi", "url", "sender_id", "bank_account", "whatsapp", "email", "sms", "website", "other"
}


@router.get("/lookup", response_model=LookupResponse)
def lookup_identifier(
    identifier: Optional[str] = Query(None, description="Identifier value to look up"),
    type: Optional[str] = Query(None, description="phone, upi, url, sender_id, bank_account, whatsapp, email, sms"),
    value: Optional[str] = Query(None, description="Alias for identifier parameter")
):
    """
    GET /lookup?type=phone&value=%2B91%2098765%2043210
    Checks a phone number, UPI ID, link, SMS sender, or bank account.
    - Returns 400 on invalid identifier format.
    - Returns 200 with NO_REPORTS for unreported numbers.
    - Returns 200 with VERIFIED_BUSINESS for official verified businesses.
    - Returns 200 with KNOWN_SCAM or SUSPICIOUS based on distinct reporters & challenges.
    - Masks display_value below 3 distinct reporters.
    - Evidence list never exposes reporter ID, IP or note.
    """
    raw_val = None
    if isinstance(identifier, str):
        raw_val = identifier
    elif isinstance(value, str):
        raw_val = value
    elif isinstance(type, str) and type.lower() not in VALID_LOOKUP_TYPES:
        raw_val = type

    expected_type = None
    if isinstance(type, str) and type.lower() in VALID_LOOKUP_TYPES:
        expected_type = type.lower()

    if not raw_val:
        raise InvalidIdentifierError("Missing lookup identifier value")

    # If raw_val explicitly starts with ACC: or IFSC:
    if raw_val.upper().startswith("ACC:") or (":" in raw_val and len(raw_val.split(":")[0]) == 11):
        expected_type = "bank_account"

    if not expected_type:
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT identifier, identifier_type FROM cases WHERE identifier = ?", (raw_val,))
                case_row = cur.fetchone()
                if case_row:
                    expected_type = case_row[1]
        except Exception:
            pass

    # Normalize identifier
    try:
        norm = normalize_identifier(raw_val, expected_type)
        normalized_id = norm.normalized_value
        id_type = norm.identifier_type
    except InvalidIdentifierError as e:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT identifier, identifier_type FROM cases WHERE identifier = ?", (raw_val,))
            case_row = cur.fetchone()
            if case_row:
                normalized_id = case_row[0]
                id_type = case_row[1] or "other"
            else:
                raise e

    with get_db_connection() as conn:
        cur = conn.cursor()

        # If looked up as 10-digit without explicit type, check if a bank account exists under ACC:{digits}
        # when no phone report exists
        digits_only = re.sub(r"\D", "", raw_val)
        if expected_type is None and 9 <= len(digits_only) <= 18:
            cur.execute("SELECT COUNT(*) FROM reports WHERE identifier = ?", (normalized_id,))
            phone_count = cur.fetchone()[0]
            if phone_count == 0:
                acc_cand = f"ACC:{digits_only}"
                cur.execute("SELECT COUNT(*) FROM reports WHERE identifier = ?", (acc_cand,))
                if cur.fetchone()[0] > 0:
                    normalized_id = acc_cand
                    id_type = "bank_account"

        # 1. Check verified business
        cur.execute(
            """
            SELECT business_name, category, raw_value
            FROM verified_businesses WHERE identifier = ? OR raw_value = ?
            """,
            (normalized_id, raw_val)
        )
        verified_biz = cur.fetchone()

        # Check challenge status
        cur.execute(
            """
            SELECT COUNT(*) FROM challenges
            WHERE identifier = ? AND status IN ('ACTIVE', 'under_review', 'UNDER_REVIEW')
            """,
            (normalized_id,)
        )
        active_ch_count = cur.fetchone()[0]

        # 2. Retrieve accepted reports
        cur.execute(
            """
            SELECT id, reporter_hmac, ip_prefix_hmac, note_fingerprint, status, occurred_at,
                   scam_type, channel, pincode, amount_lost_inr, loss_amount, file_sha256,
                   phash, tx_ref_hmac, ocr_fingerprint, created_at, is_disputed, dispute_reason
            FROM reports WHERE identifier = ? AND status = 'ACCEPTED'
            ORDER BY occurred_at ASC
            """,
            (normalized_id,)
        )
        reports = [dict(row) for row in cur.fetchall()]
        report_count = len(reports)
        total_loss = sum(r.get("amount_lost_inr") or r.get("loss_amount") or 0.0 for r in reports)
        has_disputed_reports = any(bool(r.get("is_disputed")) for r in reports)
        is_challenged = (active_ch_count > 0) or has_disputed_reports

        if verified_biz:
            # Verified businesses must never become KNOWN_SCAM
            return LookupResponse(
                verdict="VERIFIED_BUSINESS",
                report_count=report_count,
                distinct_reporters=0,
                first_seen=reports[0]["occurred_at"] if reports else None,
                last_seen=reports[-1]["occurred_at"] if reports else None,
                scam_type=None,
                display_value=verified_biz["raw_value"] or normalized_id,
                evidence={
                    "verified": True,
                    "business_name": verified_biz["business_name"],
                    "category": verified_biz["category"],
                    "reports": []
                },
                challenged=is_challenged
            )

        # 3. Unreported identifier -> 200 with NO_REPORTS
        if report_count == 0:
            return LookupResponse(
                verdict="NO_REPORTS",
                report_count=0,
                distinct_reporters=0,
                first_seen=None,
                last_seen=None,
                scam_type=None,
                display_value=mask_identifier(normalized_id, id_type),
                evidence={
                    "verified": False,
                    "total_reported_loss_inr": 0.0,
                    "reports": [],
                    "privacy_notice": "Reports are anonymous. Reporter identities and exact locations are not displayed."
                },
                challenged=is_challenged
            )

        # 4. Evaluate trust rules
        # If any report is disputed or the case has an active challenge, verdict is capped at SUSPICIOUS
        verdict, distinct_reporters, display_value, evidence_summary = evaluate_trust(
            reports=reports,
            is_verified=False,
            is_challenged=is_challenged,
            identifier_type=id_type,
            normalized_value=normalized_id
        )

        first_seen = reports[0]["occurred_at"]
        last_seen = reports[-1]["occurred_at"]
        primary_scam_type = reports[-1]["scam_type"]

        # PRD Evidence List: strictly {id, occurred_at, channel, scam_type, pincode, is_disputed}
        # Never includes who reported, IP, or their note!
        evidence_list = [
            {
                "id": r["id"],
                "report_id": r["id"],
                "reference_id": r["id"],
                "occurred_at": r["occurred_at"],
                "channel": r.get("channel") or "Phone call",
                "scam_type": r["scam_type"],
                "pincode": r.get("pincode"),
                "is_disputed": bool(r.get("is_disputed")),
                "dispute_status": "DISPUTED" if r.get("is_disputed") else None,
                "dispute_reason": r.get("dispute_reason") if r.get("is_disputed") else None,
            }
            for r in reports
        ]

        ev_dict = dict(evidence_summary) if evidence_summary else {}
        ev_dict.update({
            "reports": evidence_list,
            "total_reported_loss_inr": float(total_loss),
            "reports_analyzed": report_count,
            "disputed_reports_count": sum(1 for r in reports if r.get("is_disputed")),
            "privacy_notice": "Reports are anonymous. Reporter identities and exact locations are not displayed.",
            "dispute_notice": "Disputes apply to individual reports, not the entire phone number or identifier.",
            "verified": False
        })

        return LookupResponse(
            verdict=verdict,
            report_count=report_count,
            distinct_reporters=distinct_reporters,
            first_seen=first_seen,
            last_seen=last_seen,
            scam_type=primary_scam_type,
            display_value=display_value,
            evidence=ev_dict,
            challenged=is_challenged
        )


@router.get("/lookup/{identifier:path}", response_model=LookupResponse)
def lookup_identifier_by_path(
    identifier: str,
    type: Optional[str] = Query(None, description="phone, upi, url, sender_id, bank_account, whatsapp, email, sms")
):
    return lookup_identifier(identifier=identifier, type=type)
