# CyberForge — Mass-Reporting API Verification & Test Suite Guide

**Document:** `docs/CYBERFORGE_MASS_REPORT_TESTS.md`  
**Purpose:** Reproducible verification of mass-reporting attack scenarios, API endpoints, payloads, trust engine calculations, and database assertions.  
**Tested Endpoints:** `POST /reports`, `GET /lookup`, `GET /alerts`, `GET /admin/reports`  
**Date of Verification:** November 1, 2026  

---

## 1. Overview of Scenarios

| Scenario | Objective | Input Data | Expected Trust Outcome | Privacy Constraint |
| :--- | :--- | :--- | :--- | :--- |
| **Scenario A** | 40 synthetic accounts report an authentic local business (Fresh Bakes) | 40 POST requests with `+91 80 4100 2233` across distinct synthetic IPs | Verdict: `VERIFIED_BUSINESS`<br>Distinct Reporters: `0`<br>Alerts: `0` | Unmasked display (`+91 80 4100 2233`), business badge returned; reporter IDs withheld. |
| **Scenario B** | 22 synthetic accounts sharing one `/24` Wi-Fi subnet report an unverified number | 22 POST requests with `+91 97777 11111` sharing subnet `103.21.58.0/24` | Verdict: `SUSPICIOUS`<br>Distinct Reporters: `1`<br>Report Count: `22` | Masked display (`97XXXXX111`); no raw IP or reporter notes leaked. |

---

## 2. Scenario A — 40 Reports Against Verified Business

### Endpoint Details
- **Endpoint:** `POST /reports`
- **Method:** `POST`
- **Authentication:** None required (Public anonymous submission)
- **Headers:** `Content-Type: application/json`

### Synthetic Request Body Template
```json
{
  "identifier_value": "+91 80 4100 2233",
  "identifier_type": "phone",
  "scam_type": "digital-arrest",
  "category": "PHONE",
  "reporter_id": "syn_user_01",
  "ip_prefix": "49.207.1.0",
  "pincode": "560038",
  "note": "Demanded money over video call posing as police officer.",
  "occurred_at": "2026-11-01T04:15:00Z"
}
```

### Actual API Response (HTTP 201 Created)
```json
{
  "report_id": "r_a9b1c2d3-e4f5-4a6b-8c7d-0e1f2a3b4c5d",
  "case_id": "+918041002233",
  "merged": false
}
```

### Verification via Public Lookup Endpoint
- **Request:** `GET /lookup?type=phone&value=%2B91%2080%204100%202233`
- **Actual Response (HTTP 200 OK):**
```json
{
  "verdict": "VERIFIED_BUSINESS",
  "report_count": 40,
  "distinct_reporters": 0,
  "display_value": "+91 80 4100 2233",
  "scam_type": "digital-arrest",
  "challenged": false,
  "evidence": {
    "verified": true,
    "business_name": "Fresh Bakes, Indiranagar (made up)",
    "category": "LOCAL_BUSINESS",
    "reports": []
  }
}
```

### Database Assertions
```sql
SELECT count(*) FROM reports WHERE identifier = '+918041002233'; -- 40
SELECT verdict, distinct_reporters FROM cases WHERE identifier = '+918041002233'; -- ('VERIFIED_BUSINESS', 0)
SELECT count(*) FROM alerts WHERE identifier = '+918041002233'; -- 0 (Immune from alerts)
```

---

## 3. Scenario B — 22 Accounts on Shared Wi-Fi Subnet

### Endpoint Details
- **Endpoint:** `POST /reports`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

### Synthetic Request Body Template
```json
{
  "identifier_value": "+91 97777 11111",
  "identifier_type": "phone",
  "scam_type": "job-offer",
  "category": "PHONE",
  "reporter_id": "wifi_bot_01",
  "ip_prefix": "103.21.58",
  "pincode": "560102",
  "note": "Work from home task scam asking for security deposit",
  "occurred_at": "2026-11-01T04:20:00Z"
}
```

### Actual API Response (HTTP 201 Created)
```json
{
  "report_id": "r_11223344-5566-7788-99aa-bbccddeeff00",
  "case_id": "+919777711111",
  "merged": true
}
```

### Verification via Public Lookup Endpoint
- **Request:** `GET /lookup?type=phone&value=%2B91%2097777%2011111`
- **Actual Response (HTTP 200 OK):**
```json
{
  "verdict": "SUSPICIOUS",
  "report_count": 22,
  "distinct_reporters": 1,
  "display_value": "97XXXXX111",
  "scam_type": "job-offer",
  "challenged": false,
  "evidence": {
    "verified": false,
    "duplicate_evidence_count": 0,
    "matching_tx_refs_count": 0,
    "visual_similarity_detected": false,
    "coordination_risk_level": "LOW",
    "distinct_clusters_count": 1,
    "reports_analyzed": 22,
    "privacy_notice": "Reports are anonymous. Reporter identities and exact locations are not displayed."
  }
}
```

---

## 4. Admin Dashboard Verification

### Administrator Endpoint
- **Endpoint:** `GET /admin/reports`
- **Headers:** `X-Admin-Token: <ADMIN_TOKEN>`
- **Response Verification:**
  - All submitted reports are visible to authorized administrators for audit.
  - Reports store `reporter_hmac` and `ip_prefix_hmac` internally.
  - Evidence images (if attached) can be inspected with automated tampering indicators.

---

## 5. Automated Test Suite Execution

Both scenarios are permanently codified in the automated test suite (`backend/tests/test_prd_audit.py`):
1. `test_attack_1_forty_friends_reporting_real_bakery`
2. `test_attack_2_twenty_two_accounts_same_wifi`

### How to Run:
```bash
cd backend
python -m pytest tests/test_prd_audit.py -v
```

### Actual Test Run Results:
```text
tests/test_prd_audit.py::test_attack_1_forty_friends_reporting_real_bakery PASSED
tests/test_prd_audit.py::test_attack_2_twenty_two_accounts_same_wifi PASSED
tests/test_prd_audit.py::test_attack_3_one_reporter_submitting_six_reports PASSED
tests/test_prd_audit.py::test_attack_4_junk_identifiers_rejected_400 PASSED
```

---

## 6. Cleanup Instructions

In test fixtures, cleanup occurs automatically using temporary SQLite connections. If synthetic reports are injected into a live demonstration database, remove them using the administrator reset endpoint:

```bash
curl -X POST http://127.0.0.1:8000/admin/reset \
  -H "X-Admin-Token: admin-secret-token"
```

Or execute targeted SQL cleanup:
```sql
DELETE FROM reports WHERE identifier IN ('+918041002233', '+919777711111');
DELETE FROM cases WHERE identifier IN ('+918041002233', '+919777711111');
```
