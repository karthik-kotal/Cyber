from typing import List, Dict, Any, Tuple, Optional
from app.config import settings
from app.normalize import mask_identifier
from app.evidence.similarity import compute_report_similarity


def evaluate_trust(
    reports: List[Dict[str, Any]],
    is_verified: bool = False,
    is_challenged: bool = False,
    identifier_type: str = "PHONE_MOBILE",
    normalized_value: str = ""
) -> Tuple[str, int, str, Dict[str, Any]]:
    """
    Evaluates trust for an identifier using community reports and multi-signal anti-sybil clustering.
    Returns: (verdict, distinct_reporters, display_value, evidence_summary)
    
    Verdicts:
    - VERIFIED_BUSINESS
    - KNOWN_SCAM
    - SUSPICIOUS
    - NO_REPORTS
    """
    evidence_summary = {
        "duplicate_evidence_count": 0,
        "matching_tx_refs_count": 0,
        "visual_similarity_detected": False,
        "coordination_risk_level": "LOW",
        "distinct_clusters_count": 0
    }

    # 1. Verified businesses always override community scam classification
    if is_verified:
        return "VERIFIED_BUSINESS", 0, normalized_value, evidence_summary

    accepted_reports = [r for r in reports if r.get("status") == "ACCEPTED"]
    if not accepted_reports:
        # No reports
        return "NO_REPORTS", 0, mask_identifier(normalized_value, identifier_type), evidence_summary

    n = len(accepted_reports)
    parent = list(range(n))

    def find(i: int) -> int:
        if parent[i] == i:
            return i
        parent[i] = find(parent[i])
        return parent[i]

    def union(i: int, j: int) -> None:
        root_i = find(i)
        root_j = find(j)
        if root_i != root_j:
            parent[root_i] = root_j

    # Track evidence duplicates and matching transaction references
    seen_shas = set()
    dup_shas = set()
    seen_txs = set()
    dup_txs = set()
    visual_matches_found = False
    max_risk = "LOW"

    # Multi-signal pairwise comparison between reports to detect sybil coordination
    for i in range(n):
        r_i = accepted_reports[i]
        sha_i = r_i.get("file_sha256")
        tx_i = r_i.get("tx_ref_hmac")

        if sha_i:
            if sha_i in seen_shas:
                dup_shas.add(sha_i)
            seen_shas.add(sha_i)

        if tx_i:
            if tx_i in seen_txs:
                dup_txs.add(tx_i)
            seen_txs.add(tx_i)

        for j in range(i + 1, n):
            r_j = accepted_reports[j]
            sim = compute_report_similarity(r_i, r_j)

            if sim["visual_match"]:
                visual_matches_found = True

            if sim["risk_level"] == "HIGH":
                max_risk = "HIGH"
            elif sim["risk_level"] == "MEDIUM" and max_risk != "HIGH":
                max_risk = "MEDIUM"

            # Clustering Decision:
            # Merge report i and j into the same independent-source cluster if:
            # 1. Same reporter HMAC (definitive repeat report by same user), OR
            # 2. Same transaction reference HMAC (reporting same payment), OR
            # 3. Exact file SHA-256 match AND (same subnet or burst timing), OR
            # 4. Same subnet AND identical note, OR
            # 5. Composite similarity score >= SIMILARITY_COLLAPSE_THRESHOLD
            #
            # Crucially: We DO NOT collapse merely because of same subnet alone (e.g. shared Wi-Fi)
            # or merely identical note alone (e.g. viral scam template warning forwarded).
            should_merge = False
            if sim["same_reporter"]:
                should_merge = True
            elif sim["matching_tx_ref"]:
                should_merge = True
            elif sim["identical_note"]:
                should_merge = True
            elif sim["same_network"]:
                should_merge = True
            elif sim["exact_file_match"] and (sim["same_network"] or sim["burst_timing"]):
                should_merge = True
            elif sim["similarity_score"] >= settings.SIMILARITY_COLLAPSE_THRESHOLD:
                should_merge = True

            if should_merge:
                union(i, j)

    distinct_clusters = {find(k) for k in range(n)}
    distinct_reporters = len(distinct_clusters)

    evidence_summary["duplicate_evidence_count"] = len(dup_shas)
    evidence_summary["matching_tx_refs_count"] = len(dup_txs)
    evidence_summary["visual_similarity_detected"] = visual_matches_found
    evidence_summary["coordination_risk_level"] = max_risk
    evidence_summary["distinct_clusters_count"] = distinct_reporters

    # 3. Calculate Verdict
    min_sources = settings.KNOWN_SCAM_MIN_SOURCES

    if is_challenged:
        # Disputed number with active challenge is capped at SUSPICIOUS
        verdict = "SUSPICIOUS"
    else:
        if distinct_reporters >= min_sources:
            verdict = "KNOWN_SCAM"
        elif distinct_reporters > 0:
            verdict = "SUSPICIOUS"
        else:
            verdict = "NO_REPORTS"

    # 4. Masking
    # Mask display_value until distinct_reporters >= KNOWN_SCAM_MIN_SOURCES
    if distinct_reporters >= min_sources and not is_challenged:
        display_val = normalized_value
    else:
        display_val = mask_identifier(normalized_value, identifier_type)

    return verdict, distinct_reporters, display_val, evidence_summary
