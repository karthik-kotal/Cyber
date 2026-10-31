from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.config import settings
from app.evidence.phash import is_perceptual_match, perceptual_similarity


def compute_report_similarity(
    report_a: Dict[str, Any],
    report_b: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Computes multi-signal similarity between two scam reports.
    
    Signals & Weights:
    - Same Reporter HMAC: +0.40 (Definitive repeat submission)
    - Exact Evidence SHA-256 Match: +0.35 (Identical file uploaded)
    - Same Transaction Ref: +0.30 (Both reports cite the exact same payment reference)
    - Perceptual Image Similarity: +0.25 (Visually near-identical screenshot/media)
    - Identical Note Fingerprint: +0.20 (Copy-pasted report text)
    - Same Subnet / IP Prefix: +0.10 (Shared network - note: could be shared Wi-Fi)
    - Burst Timing (< 10 minutes apart): +0.10 (Coordinated submission window)
    """
    score = 0.0
    signals = []
    explanations = []

    # 1. Reporter Identity Fingerprint
    rep_a = report_a.get("reporter_hmac")
    rep_b = report_b.get("reporter_hmac")
    same_reporter = bool(rep_a and rep_b and rep_a == rep_b)
    if same_reporter:
        score += 0.40
        signals.append("SAME_REPORTER")
        explanations.append("Both reports originate from the same anonymous device/reporter")

    # 2. Exact File SHA-256 Hash
    sha_a = report_a.get("file_sha256")
    sha_b = report_b.get("file_sha256")
    exact_file_match = bool(sha_a and sha_b and sha_a == sha_b)
    if exact_file_match:
        score += 0.35
        signals.append("EXACT_EVIDENCE_MATCH")
        explanations.append("Identical evidence file submitted (matching SHA-256 digest)")

    # 3. Transaction Reference Hash
    tx_a = report_a.get("tx_ref_hmac")
    tx_b = report_b.get("tx_ref_hmac")
    matching_tx_ref = bool(tx_a and tx_b and tx_a == tx_b)
    if matching_tx_ref:
        score += 0.30
        signals.append("MATCHING_TRANSACTION_REF")
        explanations.append("Both reports cite the exact same payment transaction reference")

    # 4. Perceptual Image Hash (Visual similarity)
    phash_a = report_a.get("phash")
    phash_b = report_b.get("phash")
    visual_match = False
    v_sim = 0.0
    if phash_a and phash_b:
        v_sim = perceptual_similarity(phash_a, phash_b)
        if is_perceptual_match(phash_a, phash_b, max_distance=settings.PHASH_MAX_HAMMING_DISTANCE):
            visual_match = True
            score += 0.25
            signals.append("VISUAL_IMAGE_MATCH")
            explanations.append(f"Evidence images are visually near-identical (similarity {v_sim:.2f})")

    # 5. Note / Description Fingerprint
    note_a = report_a.get("note_fingerprint")
    note_b = report_b.get("note_fingerprint")
    identical_note = bool(note_a and note_b and note_a == note_b)
    if identical_note:
        score += 0.20
        signals.append("IDENTICAL_NOTE")
        explanations.append("Incident descriptions share an identical text fingerprint")

    # 6. Network Subnet Fingerprint (/24 IPv4)
    ip_a = report_a.get("ip_prefix_hmac")
    ip_b = report_b.get("ip_prefix_hmac")
    same_network = bool(ip_a and ip_b and ip_a == ip_b)
    if same_network:
        score += 0.10
        signals.append("SAME_SUBNET")
        # Notice: Shared Wi-Fi or carrier CGNAT can cause this; treated as a light signal only

    # 7. Burst Timing
    burst_timing = False
    time_a = report_a.get("created_at") or report_a.get("occurred_at")
    time_b = report_b.get("created_at") or report_b.get("occurred_at")
    if time_a and time_b:
        try:
            dt_a = datetime.fromisoformat(time_a.replace("Z", "+00:00"))
            dt_b = datetime.fromisoformat(time_b.replace("Z", "+00:00"))
            diff_sec = abs((dt_a - dt_b).total_seconds())
            if diff_sec <= 600:  # 10 minutes
                burst_timing = True
                score += 0.10
                signals.append("BURST_SUBMISSION")
                explanations.append(f"Reports submitted in close time proximity ({int(diff_sec)}s apart)")
        except Exception:
            pass

    normalized_score = min(round(score, 4), 1.0)

    # Classify overall coordination/duplication risk
    if normalized_score >= 0.70 or same_reporter or (exact_file_match and matching_tx_ref):
        risk_level = "HIGH"
    elif normalized_score >= 0.40 or visual_match or matching_tx_ref:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "similarity_score": normalized_score,
        "risk_level": risk_level,
        "signals": signals,
        "same_reporter": same_reporter,
        "exact_file_match": exact_file_match,
        "matching_tx_ref": matching_tx_ref,
        "visual_match": visual_match,
        "identical_note": identical_note,
        "same_network": same_network,
        "burst_timing": burst_timing,
        "explanations": explanations
    }

