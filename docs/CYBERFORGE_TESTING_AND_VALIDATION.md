# CyberForge — Testing, Verification & Attack Demonstrations
*Comprehensive Test Audit, Test Suite Breakdown, and Physical Device Validation*

---

## 1. Test Suite Verification Summary

CyberForge enforces continuous automated testing across both backend Python microservices and frontend React components. Every pull request and release is validated against 149 automated test cases.

```
========================================================================================
Test Execution Summary
========================================================================================
Backend Python Test Suite (Pytest 8.3+)     : 128 PASSED / 0 FAILED / 0 WARNINGS (19.5s)
Frontend Vitest Test Suite (Vitest 2.1+)    :  21 PASSED / 0 FAILED (6 Test Files) (9.8s)
Total Automated Test Cases                  : 149 PASSED (100% Green)
Physical Mobile APK Deployment              : VERIFIED & OPERATIONAL on Android Hardware
========================================================================================
```

---

## 2. Backend Automated Test Breakdown (128 Tests)

The backend test suite is located in `backend/tests/` and covers all critical business rules, threat detection thresholds, cryptographic invariants, and database transactions:

### 2.1. `test_api_and_trust.py` (Core API & Ingestion)
- **Health Verification**: Asserts `GET /health` returns 200 with `{"ok": true}` per PRD specification.
- **Report Ingestion**: Tests `POST /reports` with phone, UPI, URL, and SMS sender IDs. Asserts 201 response with `report_id`, `case_id`, and accurate `merged` flag.
- **Junk Ingestion Rejection**: Asserts 400 Bad Request on invalid phone lengths (`12345`), malformed UPI handles (`invalid@@upi`), tracking-polluted URLs, and missing required parameters.
- **Masked Lookup**: Asserts `GET /lookup` returns 200 with `NO_REPORTS` for unrecorded numbers, masks display value (`98XXXXX210`) when reports < 3, and unmasks when reports >= 3.
- **Database Reset**: Verifies `POST /admin/reset` flushes user reports and re-populates Appendix C verified entities.

### 2.2. `test_normalize.py` (Deterministic Ingestion Normalization)
- **Indian Mobile Formats**: Validates normalization across `+91 9876543210`, `09876543210`, `919876543210`, `98765 43210`, and `(098765) 43210`. All canonicalize to `+919876543210`.
- **UPI Case-Insensitivity**: Tests normalization of `Merchant.Store@ICICI` to `merchant.store@icici`.
- **URL Parameter Stripping**: Asserts tracking tokens (`utm_source`, `fbclid`, `gclid`) are stripped while preserving genuine functional query parameters in deterministic alphabetical order.
- **Helpline Whitelist**: Confirms shortcodes (`1930`, `1909`, `112`, `100`) bypass standard 10-digit mobile length checks.

### 2.3. `test_prd_audit.py` (Anti-Sybil & Mass Attack Defense)
- **Scenario A (Verified Business Mob Attack)**: Submits 40 synthetic spam reports with varying IP prefixes and timestamps against the verified bakery number (`+91 80 4100 2233`). Asserts that the verdict remains strictly `VERIFIED_BUSINESS` and fraud risk remains zero.
- **Scenario B (Coordinated Sybil Botnet Attack)**: Submits 25 coordinated reports against an unverified phone number sharing the same `/24` subnet, identical screenshot file hash, and burst timestamps (<10 min). Verifies that the Union-Find engine collapses the 25 reports into `distinct_reporters = 1`, and the verdict remains `SUSPICIOUS`, preventing an illicit `KNOWN_SCAM` badge.
- **Appendix C Entity Verification**: Asserts all 18 standard verified entities (banks, national helplines, official portals) are seeded and protected.

### 2.4. `test_dispute_system_and_rubric.py` (Challenges & Disputes)
- **Challenge Lifecycle**: Submits `POST /challenges` for a target identifier. Verifies challenge creation with `status: "under_review"`.
- **Lookup Verdict Capping**: Asserts that while a challenge is under review, `GET /lookup` returns `"challenged": true` and caps any potential `KNOWN_SCAM` verdict at `SUSPICIOUS`.
- **Admin Adjudication (Approval)**: Executes `POST /admin/disputes/{id}/decide` with `action: "APPROVE"`. Asserts target report is set to `QUARANTINED`, trust is recalculated without the false report, and challenge status becomes `RESOLVED`.
- **Admin Adjudication (Rejection)**: Executes dispute decision with `action: "REJECT"`. Asserts target report status remains `ACCEPTED`.
- **Immutable Audit Logging**: Asserts every dispute decision generates an immutable record in `dispute_audit_log` with administrator username, prior status, new status, and reason.

### 2.5. `test_evidence_analysis.py` & `test_evidence_manipulation_and_categories.py`
- **Dual-Hash Processing**: Validates SHA-256 calculation for byte integrity and 64-bit DCT pHash for visual similarity.
- **Hamming Distance Comparison**: Asserts that resized and recompressed screenshots maintain a pHash Hamming distance $\le 10$, triggering perceptual duplicate detection.
- **Honest Disclaimers**: Tests `compare_hashes()` endpoint to verify that forensic results include balanced, legally responsible disclaimers rather than false guarantees of absolute authenticity.

### 2.6. `test_pincode_map_resolution.py` & `test_categories_and_nationwide_map.py`
- **Pincode Centroid Lookup**: Verifies geographic resolution across metropolitan and rural Indian PIN codes (Bengaluru `560102`, `560069`, Mumbai `400001`, Delhi `110001`, Kolkata `700001`).
- **Radius Filtering**: Validates Haversine distance calculations in `GET /map`. Asserts clusters outside `radius_km` are excluded.
- **Severity Classification**: Asserts clusters are properly tagged (`CRIT` for $\ge 10$ reports, `HIGH` for $\ge 5$, `MED` for $< 5$).
- **Privacy Enforcement**: Confirms exact reporter coordinates are never emitted in the map API payload.

### 2.7. `test_three_pov.py` & `test_license_system.py`
- **Three POV Modes**: Validates database routing between `cyberforge.db` (Normal and Admin POV) and `cyberforge_demo.db` (Demo POV).
- **License Expiration Simulation**: Verifies that the 365-day enterprise administrator license and 5-minute hackathon demo license expire and renew accurately without affecting normal citizen reporting.

---

## 3. Frontend Automated Test Breakdown (21 Tests)

The frontend test suite is located in `cyberforge/frontend/tests/` and executed via Vitest:

```
 ✓ tests/api.test.ts (10 tests)
   - API client URL configuration
   - Header injection for x-cyberforge-pov
   - 400 Bad Request error parsing
   - 401 Unauthorized redirect triggers
   - 429 Rate limiting backoff handlers
   - Normalization helpers

 ✓ tests/VerdictBadge.test.tsx (4 tests)
   - Renders KNOWN_SCAM with red theme and alert icon
   - Renders SUSPICIOUS with amber theme
   - Renders NO_REPORTS with neutral green shield
   - Renders VERIFIED_BUSINESS with official blue verified badge

 ✓ tests/MapPage.test.tsx (1 test)
   - Permanent DOM container mounting for Leaflet mapRef
   - Avoids map re-initialization crashes during empty states

 ✓ tests/LookupResultCard.test.tsx (1 test)
   - Renders masked identifier for uncorroborated reports
   - Displays unmasked identifier when distinct_reporters >= 3
   - Renders challenged banner when under review

 ✓ tests/ReportPage.test.tsx (3 tests)
   - Form field validation and required inputs
   - Category dropdown population matching Appendix C
   - Submission loading states and success confirmation

 ✓ tests/App.test.tsx (2 tests)
   - Client-side hash navigation across routes
   - POV toggle switcher rendering
```

---

## 4. Mass Report Attack Demonstrations (Deep Dive)

### Scenario A: 40 Synthetic Reports Against Verified Bakery
- **Target**: `Fresh Bakes, Indiranagar` (Phone: `+91 80 4100 2233`, UPI: `freshbakes@okaxis`).
- **Attack Simulation**:
  - A malicious adversary executes a Python script generating 40 independent HTTP `POST /reports` requests.
  - To simulate advanced evasion, the script varies the simulated reporter IDs, generates 40 unique random `/24` IP subnets (`103.21.x.x`), and staggers report timestamps across multiple days.
  - The report claims the bakery committed a "fake-kyc-link" scam.
- **CyberForge Defense Execution**:
  1. `reports.py` normalizes `+91 80 4100 2233` to `+918041002233`.
  2. `reports.py` queries `verified_businesses` table. Match found: `Fresh Bakes, Indiranagar (category: LOCAL_BUSINESS)`.
  3. The report is recorded in `reports` table for auditing, but the case verdict is routed through `evaluate_trust(is_verified=True)`.
  4. `evaluate_trust()` immediately short-circuits:
     ```python
     if is_verified:
         return ("VERIFIED_BUSINESS", len(reports), 0.0)
     ```
- **Validation**:
  - `GET /lookup?type=phone&value=%2B918041002233` returns `verdict: "VERIFIED_BUSINESS"`.
  - Fraud risk is displayed as **ZERO (Protected Registry)**.
  - The 40 fake reports fail completely to change the status to `KNOWN_SCAM`.

---

### Scenario B: Coordinated Sybil Botnet Attack Against Unverified Target
- **Target**: An unverified local repair service (`+91 91234 56789`).
- **Attack Simulation**:
  - A rival business launches an automated bot farm submitting 25 defamatory reports within a 4-minute window.
  - The attacker generates 25 distinct simulated reporter tokens.
  - However, all 25 requests originate from the same office internet connection (`192.168.1.0/24`), use identical copy-pasted complaint text ("Rude driver took advance money and ran away"), and attach the same recompressed screenshot evidence.
- **CyberForge Defense Execution**:
  1. `privacy.py` extracts the `/24` subnet and computes an identical `ip_prefix_hmac` for all 25 reports.
  2. `privacy.py` normalizes the note and computes an identical `note_fingerprint`.
  3. `phash.py` computes the DCT perceptual hash and finds all screenshots have Hamming distance $\le 2$.
  4. `similarity.py` calculates pairwise correlation scores:
     - Same Subnet IP: $+0.10$
     - Burst Timing (<10m): $+0.10$
     - Same Note Fingerprint: $+0.20$
     - Matching pHash: $+0.25$
     - **Total Pairwise Score: 0.65** ($\ge 0.50$ threshold).
  5. An edge is created between every report in the pairwise graph.
  6. Disjoint-Set Union-Find executes `union()` across all 25 nodes, collapsing them into **1 single connected component**.
- **Validation**:
  - The system computes `distinct_reporters = 1`.
  - In `evaluate_trust()`:
    $$\text{distinct\_reporters} < 3 \implies \text{verdict} = \text{"SUSPICIOUS"}$$
  - The target is **NEVER marked as a KNOWN_SCAM**.
  - On `GET /lookup`, the identifier remains privacy-masked (`91XXXXX789`), completely preventing the rival's attempt to publicly defame the merchant.

---

## 5. Physical Mobile Device Validation

To ensure real-world readiness beyond desktop browsers, CyberForge has been compiled and validated on physical Android mobile hardware:

```
Mobile Environment & Build Specifications:
- Framework         : Capacitor 7 (Cross-Platform Mobile Runtime)
- Android SDK       : Target SDK 34 (Android 14) / Minimum SDK 22 (Android 5.1)
- Java Runtime      : OpenJDK 21.0.13 (E:\cyber\tools\jdk-21)
- Build Output      : app-debug.apk (4.57 MB / 4,792,320 bytes)
- Network Security  : Scoped cleartext HTTP permitted to http://192.168.60.239:8000
- Hardware Tested   : Physical Android Smartphone connected via Wi-Fi subnet
```

### Physical Test Operations Performed on Hardware:
1. **Application Launch**: Instant cold boot within 1.2 seconds, rendering the mobile splash screen and initializing the React single-page application inside the native WebView container.
2. **Live Backend Connectivity**: Mobile device successfully queried `http://192.168.60.239:8000/health`, establishing live bidirectional communication with the FastAPI server running on the host laptop.
3. **Live Report Ingestion from Mobile**: Submitted a live scam report from the physical smartphone. Report was processed, hashed via HMAC-SHA256, and written to `cyberforge.db` on the laptop backend.
4. **Geospatial Map Rendering**: Mobile Leaflet map rendered local PIN code clusters with touch-enabled pan and pinch-to-zoom gestures.
5. **Real-Time Language Translation**: Seamlessly toggled between English and Hindi UI strings on the mobile device without network latency.

