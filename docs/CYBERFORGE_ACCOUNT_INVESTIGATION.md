# CyberForge — Forensic Investigation Report: 22 Accounts on Shared Wi-Fi / Subnet

**Document:** `docs/CYBERFORGE_ACCOUNT_INVESTIGATION.md`  
**Investigation Target:** 22 accounts suspected of being controlled by one person on a shared Wi-Fi / subnet  
**Investigated Databases:** `E:\cyber\backend\cyberforge.db`, `E:\cyber\backend\cyberforge_demo.db`  
**Code Reference:** `backend/app/privacy.py`, `backend/app/trust_engine.py`, `backend/tests/test_prd_audit.py`  
**Date of Audit:** November 1, 2026  

---

## 1. Executive Summary

An investigation was conducted to determine whether 22 suspicious accounts controlled by a single operator exist in the CyberForge persistent database, and how the anti-sybil trust engine processes multi-account reporting from a shared network.

Key Findings:
1. **Database Search Results:** The production database (`cyberforge.db`) currently holds **0 persistent records** for the 22 bot accounts targeting `+91 9777711111`.
2. **Origin of the Scenario:** The "22 accounts from one Wi-Fi" scenario originates from the automated PRD rubric verification test (`test_attack_2_twenty_two_accounts_same_wifi` in `backend/tests/test_prd_audit.py`).
3. **Clustering Behavior:** When 22 accounts submit reports against a target identifier from the same `/24` IPv4 subnet (`103.21.58.0/24`), CyberForge's Union-Find clustering recognizes the shared privacy-preserving network fingerprint (`ip_prefix_hmac`).
4. **Anti-Sybil Verdict Cap:** All 22 reports collapse into **1 distinct reporter source**. Because fewer than 3 independent sources exist, the verdict is capped at **`SUSPICIOUS`** (never `KNOWN_SCAM`), and the identifier remains masked (**`97XXXXX111`**).
5. **Legitimate Subnet Protection:** The system does not permanently blacklist or label accounts as criminals purely due to shared Wi-Fi, acknowledging public Wi-Fi co-location in hostels, offices, and cafes.

---

## 2. Account Identification & Database Inventory

| Metric | Persistent DB (`cyberforge.db`) | Test Suite Simulation (`test_prd_audit.py`) |
| :--- | :--- | :--- |
| **Total Accounts Identified** | 0 | 22 accounts (`wifi_bot_account_0` to `21`) |
| **Target Identifier** | N/A | `+91 9777711111` (`+919777711111`) |
| **Report Submission Window** | N/A | Sequential submission within 1 second |
| **Shared Network Fingerprint** | N/A | Subnet `103.21.58.0/24` |
| **Stored Reporter HMAC** | N/A | `HMAC-SHA256(wifi_bot_account_i, PEPPER)` |
| **Stored Network HMAC** | N/A | `HMAC-SHA256("103.21.58", PEPPER)` |
| **Report Category** | N/A | `PHONE` (Scam Type: `job-offer`) |
| **Pincode / Location** | N/A | `560102` (HSR Layout, Bengaluru) |

---

## 3. How the Anti-Sybil Clustering Operates

### Step 1: Privacy-Preserving Ingestion (`privacy.py`)
- CyberForge never stores raw reporter IP addresses or plain account IDs.
- IPv4 addresses are truncated to `/24` (e.g. `103.21.58.12` -> `103.21.58`).
- The prefix is cryptographically hashed with server pepper:
  ```python
  ip_prefix_hmac = hmac.new(PEPPER, "103.21.58".encode(), hashlib.sha256).hexdigest()
  ```

### Step 2: Multi-Signal Pairwise Comparison (`similarity.py`)
When evaluating reports for identifier `+919777711111`:
```python
sim = compute_report_similarity(report_i, report_j)
# If report_i and report_j share ip_prefix_hmac -> sim["same_network"] is True
```

### Step 3: Disjoint-Set / Union-Find Clustering (`trust_engine.py`)
```python
if sim["same_network"] or sim["identical_note"]:
    union(i, j)
```
- Report 0 through Report 21 are unioned into a single connected component.
- `distinct_clusters = {find(k) for k in range(22)}`
- `len(distinct_clusters) == 1`

### Step 4: Verdict Calculation & Masking
```python
if distinct_reporters >= 3:
    verdict = "KNOWN_SCAM"
elif distinct_reporters > 0:
    verdict = "SUSPICIOUS"
```
Because `distinct_reporters == 1 < 3`:
- **Verdict:** `SUSPICIOUS` (Guilt is not established).
- **Display Value:** Masked (`97XXXXX111`) to prevent defamatory doxxing.
- **Alert Generation:** Suppressed (no 24-hour spike alert triggered).

---

## 4. Evidence Analysis & Linking Confidence

| Evidence Signal | Strength | Limitation |
| :--- | :--- | :--- |
| **Subnet HMAC Match** | Medium-High | Confirms shared router/Wi-Fi or same ISP node; does not prove single-operator ownership. |
| **Submission Timing** | High | 22 reports submitted within seconds indicates automated script or botnet. |
| **Identical Note Fingerprint** | High | `"Fake bot report"` repeated across all 22 indicates scripted replication. |
| **Target Singularity** | Medium | All 22 exclusively target one phone number. |

---

## 5. Limitations & Honest Assessment

1. **Shared IP Limitation:**
   - A single IP subnet (`/24`) holds up to 254 host addresses. In a university dorm, shared office space (WeWork), or cafe, multiple real, unrelated victims might legitimately report the same scammer.
   - For this reason, CyberForge's clustering is **conservative**: it collapses count for the threshold calculation, but does not block reporters or drop their individual reports.
2. **Reverse Attack (Sybil Farming via Cellular 4G/5G IP Rotation):**
   - If an attacker toggles Airplane Mode on a smartphone to obtain 22 different dynamic 4G/5G IP addresses across different subnets, IP-prefix clustering alone will not merge them.
   - CyberForge relies on secondary defense layers: note text minhash fingerprinting, device timing bursts, and mandatory human dispute adjudication.
3. **No Database Contamination:**
   - The 22 accounts were part of unit tests and did not pollute the persistent live database.

---

## 6. Conclusion

- **Accounts Found:** 0 in persistent database; 22 in automated test fixtures.
- **System Defense:** The anti-sybil engine passed all 22-bot cluster tests without false escalation.
- **Final Security Finding:** The system successfully prevented 22 fake accounts from manipulating a phone number into `KNOWN_SCAM`.
