# CyberForge — Complete REST API Specification
*Mitigata Hackathon Evaluator & Integration Reference*

---

## 1. Global Conventions & Protocol Standards

- **Base URL (Local Web)**: `http://localhost:8000` or `http://localhost:8000/api`
- **Base URL (Android Mobile)**: `http://192.168.60.239:8000` or `http://192.168.60.239:8000/api`
- **Content-Type**: `application/json` (or `multipart/form-data` when uploading screenshot evidence)
- **Point of View (POV) Header**:
  - `x-cyberforge-pov: normal` (Default citizen mode, operations read/write `cyberforge.db`)
  - `x-cyberforge-pov: admin` (Full administrator console, requires admin token)
  - `x-cyberforge-pov: demo` (Isolated evaluation sandbox, routes to `cyberforge_demo.db`, uses 5-minute license)

---

## 2. API Endpoints Quick Reference Table

| Method | Endpoint Path | Tags | Auth / Headers | Purpose & PRD Alignment |
|---|---|---|---|---|
| `GET` | `/health` | Health | None | PRD Rule 1: Service liveness check; replies `{"ok": true}` |
| `POST` | `/reports` | Reports | Optional `x-cyberforge-pov` | PRD Rule 2: Ingest scam report; replies 201 with `report_id`, `case_id`, `merged` |
| `GET` | `/lookup` | Lookup | Optional `x-cyberforge-pov` | PRD Rule 3: Query threat level, verdict, masked display value, and evidence timeline |
| `GET` | `/map` | Map | Optional `x-cyberforge-pov` | PRD Rule 4: Grouped scam clusters by 6-digit postal PIN code within radius |
| `GET` | `/alerts` | Alerts | Optional `x-cyberforge-pov` | PRD Rule 5: Area alerts triggered by `SPIKE` (2x 7-day avg) or `NEW_TYPE` (30d baseline) |
| `POST` | `/admin/reset` | Admin | `x-admin-token` or demo POV | PRD Rule 6: Wipe all user reports and restore seeded Appendix C verified entities |
| `POST` | `/challenges` | Disputes | Optional `x-cyberforge-pov` | PRD Rule 7 (Bonus): Business dispute filing; caps lookup verdict at `SUSPICIOUS` |
| `GET` | `/api/admin/disputes` | Admin | `ADMIN_TOKEN` or demo POV | List all registered business challenges & disputes |
| `POST` | `/api/admin/disputes/{id}/decide` | Admin | `ADMIN_TOKEN` or demo POV | Adjudicate dispute (`APPROVE` or `REJECT`), update report quarantine, re-score case |
| `GET` | `/api/admin/disputes/audit-log` | Admin | `ADMIN_TOKEN` or demo POV | Fetch immutable audit trail of administrator dispute decisions |
| `GET` | `/api/admin/reports` | Admin | `ADMIN_TOKEN` or demo POV | List raw ingested reports for forensic and Sybil inspection |
| `GET` | `/license/status` | License | None | Retrieve enterprise 365-day license expiration and validation status |

---

## 3. Detailed Endpoint Contracts

### 3.1. GET /health
Checks backend health and service availability.
- **Request Parameters**: None
- **Response `200 OK`**:
```json
{
  "ok": true,
  "status": "healthy",
  "service": "CyberForge"
}
```

---

### 3.2. POST /reports
Submits a new scam report from a community citizen.
- **Headers**:
  - `Content-Type: application/json`
  - `x-cyberforge-pov: normal | demo`
- **Request Body**:
```json
{
  "report_id": "rep_000123",
  "occurred_at": "2026-10-27T18:21:04+05:30",
  "reported_at": "2026-10-27T18:40:04+05:30",
  "reporter_id": "r_7c2d91aa",
  "ip_prefix": "103.21.58",
  "channel": "Phone call",
  "scam_type": "digital-arrest",
  "identifier_type": "phone",
  "identifier_value": "+91 98765 43210",
  "pincode": "560102",
  "locality": "HSR Layout",
  "city": "Bengaluru",
  "note": "Video call from a man in police uniform threatening arrest...",
  "has_screenshot": false,
  "amount_lost_inr": 0
}
```
- **Responses**:
  - `201 Created`:
    ```json
    {
      "report_id": "rep_000123",
      "case_id": "case_9876543210",
      "merged": false,
      "status": "ACCEPTED",
      "case_status": "SUSPICIOUS",
      "display_value": "98XXXXX210"
    }
    ```
    *(Note: `merged` is set to `true` if the identifier already had existing reports in the database).*
  - `400 Bad Request`: When identifier format, pincode, or timestamp is invalid:
    ```json
    {
      "error": "Invalid Indian mobile phone number: must be 10 digits starting with 6-9."
    }
    ```
  - `429 Too Many Requests`: When reporter exceeds ingestion rate limits.

---

### 3.3. GET /lookup
Queries the verified intelligence record for a specific identifier.
- **Query Parameters**:
  - `type` (required): `phone` | `upi` | `url` | `sender_id`
  - `value` (required): URL-encoded identifier string (e.g. `%2B919876543210`)
- **Responses**:
  - `200 OK` (Threat record exists):
    ```json
    {
      "verdict": "KNOWN_SCAM",
      "report_count": 7,
      "distinct_reporters": 5,
      "first_seen": "2026-10-14T09:12:00+05:30",
      "last_seen": "2026-10-27T18:21:04+05:30",
      "scam_type": "digital-arrest",
      "display_value": "+919876543210",
      "evidence": [
        {
          "occurred_at": "2026-10-27T18:21:04+05:30",
          "channel": "Phone call",
          "scam_type": "digital-arrest",
          "pincode": "560102"
        }
      ],
      "challenged": false
    }
    ```
  - `200 OK` (Unreported identifier):
    ```json
    {
      "verdict": "NO_REPORTS",
      "report_count": 0,
      "distinct_reporters": 0,
      "first_seen": null,
      "last_seen": null,
      "scam_type": null,
      "display_value": "98XXXXX210",
      "evidence": [],
      "challenged": false
    }
    ```
  - `200 OK` (Official verified business / helpline):
    ```json
    {
      "verdict": "VERIFIED_BUSINESS",
      "report_count": 0,
      "distinct_reporters": 0,
      "first_seen": null,
      "last_seen": null,
      "scam_type": null,
      "display_value": "TRAI Do Not Disturb (1909)",
      "evidence": [],
      "challenged": false
    }
    ```
  - `400 Bad Request`: If input format cannot be normalized (e.g., `value=12345` with `type=phone`).

---

### 3.4. GET /map
Fetches geospatial scam clusters grouped strictly by postal PIN codes.
- **Query Parameters**:
  - `pincode` (optional): Center 6-digit postal code (e.g. `560102`). If omitted, returns active clusters.
  - `days` (optional, default `7`): Age window of reports to include.
  - `radius_km` (optional, default `2`): Haversine distance radius in kilometers.
- **Response `200 OK`**:
```json
{
  "clusters": [
    {
      "pincode": "560102",
      "locality": "HSR Layout",
      "city": "Bengaluru",
      "count": 12,
      "top_scam_type": "digital-arrest",
      "severity": "CRIT",
      "lat": 12.9116,
      "lng": 77.6473
    }
  ],
  "points": [],
  "diagnostics": {
    "center_pincode": "560102",
    "days_window": 7,
    "radius_km": 2.0,
    "total_reports_evaluated": 12
  }
}
```
*(Severity scale: `CRIT` >= 10 reports, `HIGH` >= 5 reports, `MED` < 5 reports).*

---

### 3.5. GET /alerts
Retrieves emergency scam alerts for a specific postal code.
- **Query Parameters**:
  - `pincode` (required): 6-digit PIN code (e.g., `560102`).
- **Alert Rules**:
  - `SPIKE`: Reports in the last 24h are at least double (2.0x) the daily average of the 7 days prior, with a minimum of 5 reports.
  - `NEW_TYPE`: A scam type reported in the last 24h that was not seen in that postal area in the preceding 30 days.
  - Ignored or fake reports filtered by the Trust Engine never trigger alerts.
- **Response `200 OK`**:
```json
{
  "alerts": [
    {
      "type": "SPIKE",
      "pincode": "560102",
      "window": "24h",
      "count": 10,
      "baseline_per_day": 2.0
    },
    {
      "type": "NEW_TYPE",
      "pincode": "560102",
      "scam_type": "job-offer",
      "window": "24h"
    }
  ]
}
```

---

### 3.6. POST /admin/reset
Flushes all community reports, cases, alerts, and dispute challenges, restoring the database to its pristine state with seeded Appendix C verified entities.
- **Headers**:
  - `x-admin-token: CyberForge@2026` (or executed in Demo POV).
- **Response `200 OK`**:
```json
{
  "ok": true,
  "status": "RESET_OK",
  "message": "Deleted all reports and re-seeded verified businesses"
}
```

---

### 3.7. POST /challenges (Bonus Dispute Filing)
Allows a legitimate business or citizen to challenge a report submitted against their identifier.
- **Request Body**:
```json
{
  "identifier_type": "phone",
  "identifier_value": "+91 80 4100 2233",
  "claimant_name": "Fresh Bakes",
  "contact_email": "owner@freshbakes.example",
  "proof_note": "GST registration certificate and municipal shop license attached."
}
```
- **Response `201 Created`**:
```json
{
  "challenge_id": "chal_98df89a1",
  "status": "under_review",
  "message": "Challenge registered. Target identifier verdict is now capped at SUSPICIOUS."
}
```
*(Crucial Rule: Once a challenge is registered with `status: "under_review"`, any lookup on that identifier returns `"challenged": true` and will NEVER return `KNOWN_SCAM`, protecting the business from defamation while evidence is reviewed).*

---

### 3.8. POST /admin/disputes/{id}/decide
Allows an authorized administrator to adjudicate a pending challenge.
- **Headers**:
  - `x-admin-token: CyberForge@2026` (or Bearer token)
- **Request Body**:
```json
{
  "action": "APPROVE",
  "reason": "Merchant provided valid GST certificate matching Indiranagar branch registration."
}
```
- **System Impact of `APPROVE`**:
  1. Challenge status transitions to `RESOLVED`.
  2. The target false report status transitions to `QUARANTINED`.
  3. Case trust score is immediately recalculated excluding the quarantined report.
  4. An immutable audit record is inserted into `dispute_audit_log`.
- **System Impact of `REJECT`**:
  1. Challenge status transitions to `REJECTED`.
  2. Target report status is preserved as `ACCEPTED`.
  3. An immutable audit record is logged.
- **Response `200 OK`**:
```json
{
  "ok": true,
  "challenge_id": "chal_98df89a1",
  "action": "APPROVE",
  "new_challenge_status": "RESOLVED",
  "new_report_status": "QUARANTINED",
  "updated_verdict": "VERIFIED_BUSINESS",
  "audit_id": "aud_1982bca8"
}
```

