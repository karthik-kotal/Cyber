# CyberForge API Contract & Developer B Integration Guide

**Project:** Community Scam Map for India — Report and verify scams in seconds, anonymously.  
**Backend:** FastAPI + SQLite WAL + Anti-Sybil Trust Engine + Evidence Analysis Pipeline  

---

## 1. Quickstart: Running the Backend Locally

```bash
cd backend
# Run with Python 3.12+ / 3.13
pip install -r requirements.txt

# Start the uvicorn development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive OpenAPI Docs:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **Health Check:** `http://localhost:8000/api/health`

---

## 2. Environment Variables & Configuration

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_PATH` | `cyberforge.db` | SQLite database file location |
| `HMAC_SECRET` | `dev-cyberforge-insecure-hmac-secret-do-not-use-in-prod` | Secret key used for one-way HMAC hashing of reporter IDs and transaction references |
| `KNOWN_SCAM_MIN_SOURCES` | `3` | Minimum independent distinct reporters required for `KNOWN_SCAM` verdict & unmasking |
| `ADMIN_TOKEN` | `cyberforge-admin-secret-key` | Token passed in `X-Admin-Token` header for reset and administrative endpoints |
| `SPIKE_WINDOW_HOURS` | `24` | Rolling window in hours for spike alert calculation |
| `SPIKE_REPORT_THRESHOLD` | `3` | Report count threshold to trigger a `SPIKE` alert |
| `MAX_EVIDENCE_SIZE_BYTES` | `10485760` (10 MB) | Maximum permitted evidence file size |
| `PHASH_MAX_HAMMING_DISTANCE` | `10` | Maximum bit difference (out of 64) to classify two images as visual duplicates |
| `ENABLE_OCR` | `true` | Enables/disables OCR text extraction on image evidence |
| `OCR_SIMILARITY_THRESHOLD` | `0.85` | Token similarity threshold for OCR text matching |
| `SIMILARITY_COLLAPSE_THRESHOLD`| `0.65` | Multi-signal similarity score threshold to merge coordinated/duplicate reports |

---

## 3. CORS Configuration

CORS is pre-configured to allow all origins (`*`), headers (`*`), and methods (`GET, POST, OPTIONS, etc.`), enabling direct frontend communication from `http://localhost:3000` (React/Next.js/Vite) or any production frontend URL.

---

## 4. API Endpoints

### 4.1. Health Check
- **URL:** `GET /api/health` (also `GET /health`)
- **Status:** `200 OK`
- **Response:**
```json
{
  "status": "healthy",
  "service": "Community Scam Map for India",
  "environment": "development"
}
```

---

### 4.2. Submit Scam Report (With Optional Evidence & Transaction Ref)

- **URL:** `POST /api/reports`
- **Status:** `201 Created` (or `400 Bad Request` if invalid identifier or corrupt evidence file)
- **Supported Evidence Types:** PNG, JPEG, PDF, BMP, WebP (up to 10 MB).
- **Request Body (`application/json`):**
```json
{
  "identifier": "+91 98765 43210",
  "identifier_type": null,
  "scam_type": "KYC_FRAUD",
  "note": "Scammer claimed bank KYC expired and demanded payment",
  "reporter_id": "optional-anonymous-device-uuid",
  "occurred_at": "2026-10-31T10:00:00Z",
  "pincode": "560001",
  "loss_amount": 15000.0,
  "evidence_url": "https://storage.example.com/screenshot.png",
  "evidence_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "evidence_filename": "payment_screenshot.png",
  "transaction_ref": "321456789012"
}
```

- **Response (`201 Created`):**
```json
{
  "report_id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "status": "ACCEPTED",
  "case_status": "SUSPICIOUS",
  "distinct_reporters": 1,
  "message": "Report submitted successfully and verified against trust engine",
  "evidence_duplicate_detected": false,
  "tx_ref_duplicate_detected": false,
  "similarity_risk_signals": {
    "duplicate_evidence_count": 0,
    "matching_tx_refs_count": 0,
    "visual_similarity_detected": false,
    "coordination_risk_level": "LOW",
    "distinct_clusters_count": 1
  }
}
```

---

### 4.3. Identifier Lookup

- **URL:** `GET /api/lookup?identifier={identifier}`
- **Status:** `200 OK` (or `400 Bad Request` if identifier is invalid)
- **Supported Formats:** Indian mobile numbers, Toll-Free (`1800`), Helplines (`1930`, `112`), Landlines with STD codes, UPI IDs (`user@bank`), URLs, Emails, Bank Accounts (`IFSC:ACC`).

#### Verdict Types:
1. `KNOWN_SCAM` — `distinct_reporters >= 3` and no active challenge.
2. `SUSPICIOUS` — `distinct_reporters` between 1 and 2, OR any number of reports under an active challenge.
3. `NO_REPORTS` — 0 accepted reports exist.
4. `VERIFIED_BUSINESS` — Matched in verified business directory (e.g. 1930 Cyber helpline, official bank toll-free numbers). Never turns into scam.

#### Masking Behavior:
- When `distinct_reporters < 3`, `display_value` is masked (e.g. `+91 98765 XXXXX` or `fra***er@paytm`).
- When `distinct_reporters >= 3` without an active dispute, `display_value` is fully unmasked.

- **Example Response (Suspicious / Masked with Evidence Summary):**
```json
{
  "verdict": "SUSPICIOUS",
  "report_count": 2,
  "distinct_reporters": 1,
  "display_value": "+91 98765 XXXXX",
  "challenged": false,
  "first_seen": "2026-10-31T08:15:00Z",
  "last_seen": "2026-10-31T09:45:00Z",
  "scam_type": "KYC_FRAUD",
  "evidence": {
    "total_reported_loss_inr": 15000.0,
    "sample_occurred_at": "2026-10-31T09:45:00Z",
    "reports_analyzed": 2,
    "duplicate_evidence_count": 1,
    "matching_tx_refs_count": 1,
    "visual_similarity_detected": true
  }
}
```

- **Example Response (Known Scam / Unmasked):**
```json
{
  "verdict": "KNOWN_SCAM",
  "report_count": 5,
  "distinct_reporters": 3,
  "display_value": "+919876543210",
  "challenged": false,
  "first_seen": "2026-10-30T14:00:00Z",
  "last_seen": "2026-10-31T11:20:00Z",
  "scam_type": "KYC_FRAUD",
  "evidence": {
    "total_reported_loss_inr": 45000.0,
    "sample_occurred_at": "2026-10-31T11:20:00Z",
    "reports_analyzed": 5,
    "duplicate_evidence_count": 0,
    "matching_tx_refs_count": 0,
    "visual_similarity_detected": false
  }
}
```

---

### 4.4. Challenges / Disputes
- **URL:** `POST /api/challenges`
- **Status:** `201 Created`
- **Request Body:**
```json
{
  "identifier": "+91 98444 55566",
  "challenger_name": "ABC Logistics Support",
  "business_name": "ABC Logistics India Pvt Ltd",
  "reason": "This is our official driver dispatch SIM, falsely reported",
  "proof_url": "https://abclogistics.in/docs/authorization.pdf"
}
```
- **Response:**
```json
{
  "challenge_id": "4b7e8d2e-0a56-4b8c-b633-146312a0f881",
  "identifier": "+919844455566",
  "status": "UNDER_REVIEW",
  "message": "Challenge submitted successfully and placed under review. Case verdict adjusted."
}
```

- **URL:** `GET /api/challenges?identifier={optional_filter}`
- **Status:** `200 OK`

---

### 4.5. Real-Time Scam Alerts
- **URL:** `GET /api/alerts?type=SPIKE&pincode=560001&limit=50`
- **Status:** `200 OK`
- **Response:**
```json
{
  "alerts": [
    {
      "id": "7b8f9e21-d14a-4c49-9d72-b88d8b9fa802",
      "type": "SPIKE",
      "identifier": "+919876543210",
      "pincode": "560001",
      "scam_type": "KYC_FRAUD",
      "description": "Sudden spike of 3 reports detected in the last 24h for identifier +919876543210",
      "severity": "HIGH",
      "created_at": "2026-10-31T10:15:30Z"
    }
  ],
  "count": 1
}
```

---

### 4.6. Admin Reset & Verified Directory
- **URL:** `POST /api/admin/reset`
- **Headers:** `X-Admin-Token: cyberforge-admin-secret-key`
- **Status:** `200 OK` (or `401 Unauthorized`)
- **Response:**
```json
{
  "status": "RESET_OK",
  "message": "Database successfully purged and re-seeded with official verified businesses"
}
```

- **URL:** `GET /api/admin/verified-businesses`
- **Status:** `200 OK`

---

## 5. Evidence & Similarity Feature Status

### 1. Implemented & Fully Tested
- **SHA-256 File Hashing:** Strict validation, format detection, zero storage of raw files, duplicate file recognition.
- **Perceptual Image Hashing (pHash):** 64-bit perceptual hash with Hamming distance comparison, resilient to image scaling/compression.
- **OCR Text Extraction & Normalization:** Text extraction with fallback, punctuation/case normalization, deterministic SHA-256 fingerprinting, token Jaccard similarity.
- **Transaction Reference Matching:** Recognition of 12-digit UPI UTRs, IMPS refs, Bank RTGS/NEFT UTRs, and gateway IDs; privacy-preserving HMAC-SHA256 hashing.
- **Multi-Signal Report Similarity:** Composite similarity scoring integrating reporter IDs, exact files, visual similarity, transaction refs, notes, and timing windows.
- **Anti-Sybil Trust Engine:** Disjoint-set clustering grouping coordinated/duplicate reports without artificially inflating `distinct_reporters`.
- **False-Positive Protections:** Shared Wi-Fi subnets alone or generic viral template notes alone do not collapse independent victim counts.

### 2. Optional Production Enhancements
- Integration with external Tesseract OCR binary (`pytesseract`) if system-level OCR binary is installed on production servers.
- Automated OCR bounding box analysis to distinguish receipt headers from transaction footers.
