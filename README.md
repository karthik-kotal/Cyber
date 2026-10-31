# CyberForge — Community Scam Map for India

Report and verify scams in seconds, anonymously. Built for India's digital safety.

---

## Table of Contents
1. [What Community Scam Map Does](#1-what-community-scam-map-does)
2. [How to Run the Frontend](#2-how-to-run-the-frontend)
3. [How to Run the Backend](#3-how-to-run-the-backend)
4. [How to Configure the Database](#4-how-to-configure-the-database)
5. [How to Configure the Server](#5-how-to-configure-the-server)
6. [How Reporting Works](#6-how-reporting-works)
7. [How Lookup Works](#7-how-lookup-works)
8. [How the Trust Rules Work](#8-how-the-trust-rules-work)
9. [How Alerts Are Generated](#9-how-alerts-are-generated)
10. [How Identifiers Are Masked](#10-how-identifiers-are-masked)
11. [How Privacy Is Protected](#11-how-privacy-is-protected)
12. [How the License System Works](#12-how-the-license-system-works)
13. [How to Generate the Short License (5-Min Demo)](#13-how-to-generate-the-short-license-5-min-demo)
14. [How to Generate the Long License](#14-how-to-generate-the-long-license)
15. [How to Test the 4-Step License Demo (No Restart)](#15-how-to-test-the-4-step-license-demo-no-restart)
16. [How to Deploy the Application (HTTPS)](#16-how-to-deploy-the-application-https)
17. [Dispute System (Report Reference ID)](#17-dispute-system-report-reference-id)
18. [Verified Businesses & Helplines](#18-verified-businesses--helplines)
19. [Known Limitations](#19-known-limitations)

---

## 1. What Community Scam Map Does

CyberForge Community Scam Map is a mobile-first, privacy-preserving crowd-sourced defense system designed to protect citizens from cyber scams (digital arrest scams, investment fraud, utility bill impersonations, UPI phishing, fake customer support).

It allows citizens to:
- **Report scams anonymously in under 60 seconds** without login, phone number, or name.
- **Check any phone number, bank account, UPI ID, or URL before paying** to get an instant trust verdict (`NO_REPORTS`, `SUSPICIOUS`, `KNOWN_SCAM`, or `VERIFIED_BUSINESS`).
- **View geographic scam clusters** across India without exposing victim locations.
- **Receive real-time scam alerts** (sudden spikes in an area or newly emerging scam patterns).
- **Dispute individual false reports** using report Reference IDs without wiping evidence.
- **Operate under cryptographic license control** that enforces organizational activation and instant renewal without server restarts.

---

## 2. How to Run the Frontend

The frontend is a lightweight, mobile-first React 18 + Vite + Tailwind CSS application supporting both English and Hindi.

```bash
cd cyberforge/frontend

# Install dependencies (if not already installed)
npm install

# Run the dev server on port 5173
npm run dev -- --host 0.0.0.0 --port 5173

# Run unit tests (Vitest)
npm test -- --run

# Run TypeScript type check
npx tsc --noEmit

# Production build
npm run build
```

The frontend will be accessible at: `http://localhost:5173`

---

## 3. How to Run the Backend

The backend is built with FastAPI and Python 3.11+.

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run all 93 unit and integration tests
pytest -v

# Start the server on port 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be accessible at: `http://localhost:8000`  
Interactive Swagger docs: `http://localhost:8000/docs`

---

## 4. How to Configure the Database

- The application uses **SQLite** with Write-Ahead Logging (`WAL` mode) for fast, zero-configuration atomic transactions.
- By default, the database file is created at `data/scam_map.db`.
- To specify a custom database location, set the `DATABASE_PATH` environment variable:
  ```bash
  # Windows PowerShell
  $env:DATABASE_PATH = "E:\cyber\data\scam_map.db"

  # Linux / macOS
  export DATABASE_PATH="/path/to/custom_scam_map.db"
  ```
- The database auto-initializes tables and seeds verified businesses upon first startup.
- To reset and seed the database for clean testing:
  ```bash
  curl -X POST http://localhost:8000/api/admin/reset
  ```

---

## 5. How to Configure the Server

Configuration is managed via environment variables (or `.env` file):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `API_V1_PREFIX` | `/api` | Base path prefix for all endpoints |
| `DATABASE_PATH` | `data/scam_map.db` | Path to SQLite database file |
| `ADMIN_TOKEN` | `cyberforge-secret-token-2026` | Token for admin routes (`/api/admin/verified-businesses`) |
| `KNOWN_SCAM_MIN_SOURCES` | `3` | Minimum independent clusters required for `KNOWN_SCAM` |
| `SIMILARITY_COLLAPSE_THRESHOLD`| `0.70` | Composite score threshold to collapse coordinated reports |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Frontend backend URL (or empty for dev proxy) |

---

## 6. How Reporting Works

1. **Anonymous Submission:** Citizens select an identifier category (`PHONE`, `BANK_ACCOUNT`, `UPI`, `WHATSAPP`, `URL`, `EMAIL`, `SMS`, `OTHER`), enter the identifier, choose the scam type, enter an optional 6-digit PIN code, and add evidence (screenshots, transaction references, notes).
2. **Instant Normalization:**
   - Phone numbers: stripped of spaces and dashes, converted to E.164 standard (`+919876543210` and `09876543210` map to the same normalized entity).
   - Bank accounts: preserved as account strings (e.g. `ACC:12345678901` or `IFSC:ACC`) and strictly separated from phone numbers.
   - UPI IDs: converted to lowercase and validated for valid `@provider` handles.
   - URLs: stripped of tracking query parameters (`utm_*`, `fbclid`), paths normalized.
3. **Reference ID Generation:** Each accepted report receives a unique UUIDv4 `report_id` (Reference ID). This ID is returned in the API response and displayed to the reporter.

---

## 7. How Lookup Works

1. Enter any identifier to inspect (`GET /api/lookup?identifier=...`).
2. The backend normalizes the input, locates all accepted reports, checks business registries, and evaluates trust rules.
3. Verdicts:
   - **`NO_REPORTS`**: 0 reports found. Friendly all-clear.
   - **`SUSPICIOUS`**: 1 or 2 independent reporters, or coordinated single-cluster reports (e.g., 20 reports from same Wi-Fi), or report under active dispute.
   - **`KNOWN_SCAM`**: 3 or more distinct, independent reporters from different subnets/networks with uncoordinated reports.
   - **`VERIFIED_BUSINESS`**: Official helpline (e.g. `1930`, `1909`) or verified business (e.g., SBI, HDFC, Amazon India). Always overrides scam classification to prevent malicious vandalism.

---

## 8. How the Trust Rules Work

The trust engine uses an **explainable Union-Find disjoint-set clustering algorithm** (`trust_engine.py`) designed to defeat coordinated sybil attacks:

### Sybil Defense & Collapsing Rules:
- **Same Reporter:** Multiple reports from the same reporter HMAC always collapse into **1 cluster**. One person reporting 6 times only counts as **1 person** (`SUSPICIOUS`, never `KNOWN_SCAM`).
- **Same Subnet / Wi-Fi:** 22 fake accounts reporting from the same `/24` IP prefix collapse into **1 cluster**. They will never escalate an entity to `KNOWN_SCAM`.
- **Duplicate Notes:** Coordinated copy-paste notes collapse into **1 cluster**.
- **Shared Evidence:** Matching image perceptual hashes (`pHash`), file SHA-256 hashes, or transaction reference IDs collapse reports into **1 cluster**.
- **Disputed Reports:** If a report Reference ID is disputed, it is marked `is_disputed = 1`, and the identifier's verdict is strictly capped at `SUSPICIOUS` with `challenged: true`.

---

## 9. How Alerts Are Generated

The alert engine (`alert_engine.py`) monitors valid community reports:
1. **`SPIKE` Alert:** Triggered when reports in a 6-digit pincode area jump dramatically in a 24-hour window compared to a 7-day baseline.
   - **Anti-False Alert Guard:** Requires at least **2 distinct, independent reporters** (`COUNT(DISTINCT reporter_hmac) >= 2`). Repeated reports by one person or bot accounts on the same Wi-Fi **never** trigger a spike alert. Disputed reports and verified businesses are excluded.
2. **`NEW_TYPE` Alert:** Triggered when a novel scam type is detected in an area that had zero occurrences in the preceding 7 days.

---

## 10. How Identifiers Are Masked

To balance public warning with individual privacy:
- Identifiers with **fewer than 3 independent reporters** are masked in public lookup responses:
  - Phone: `+919876543210` -> `98XXXXX210`
  - Bank Account: `ACC:123456789012` -> `ACC:12XXXXXX9012`
  - UPI ID: `scammer@okhdfcbank` -> `scXXXXXr@okhdfcbank`
- Identifiers with **3 or more independent reporters** (`KNOWN_SCAM`) are unmasked (`+919876543210`) so users can identify the threat.
- Verified businesses and official helplines are always displayed in full.

---

## 11. How Privacy Is Protected

CyberForge guarantees **automatic disqualification safety** as specified in the hackathon brief:
1. **Zero Storage of Reporter Identities:** Reporter names, emails, and device IDs are never collected.
2. **No Raw IPs in Public APIs:** IP addresses are salted, hashed with HMAC-SHA256 at the `/24` subnet level, and used solely for in-memory sybil clustering.
3. **No Exact GPS Coordinates:** The map never stores or displays user GPS coordinates. All pins are aggregated to 6-digit postal area centroids.
4. **Non-Accusatory Wording:** The result screen displays objective community data:
   - ✅ *"Reported by 7 people near you"*
   - 🚫 Never uses defamatory phrasing like *"This person is a fraud"*.
5. **Mandatory Privacy Disclaimer:** Every lookup response includes:
   > *"Reports are anonymous. Reporter identities and exact locations are not displayed."*

---

## 12. How the License System Works

- **Enforcement Point:** Backend middleware in `backend/app/main.py`.
- **Cryptographic Verification:** HMAC-SHA256 signature generated over `{licensee}:{expires_at}` using the signing key in `backend/app/license.py`.
- **Zero Restart Renewal:** New licenses are activated dynamically via `POST /api/license/activate` without restarting the server or dropping connections.
- **Expiration Behavior:** When expired, all non-exempt API endpoints return **HTTP 403 `{"error": "LICENSE_EXPIRED"}`**, and the frontend displays the full-screen `"Licence expired"` screen with an instant renewal form.

---

## 13. How to Generate the Short License (5-Min Demo)

Run the license generator script:

```bash
# Generate short license expiring in 5 minutes
python scripts/generate_license.py --type short --licensee "Demo Bank"
```

Output files created in `licenses/`:
- `licenses/short_license.json`: JSON payload for API upload.
- `licenses/short_license.key`: Single-string key (`licensee:expires_at:signature`) for copy-pasting into the frontend renewal form.

---

## 14. How to Generate the Long License

```bash
# Generate long license valid for 365 days
python scripts/generate_license.py --type long --licensee "Demo Bank"
```

Output files created in `licenses/`:
- `licenses/long_license.json`
- `licenses/long_license.key`

---

## 15. How to Test the 4-Step License Demo (No Restart)

The judging brief requires a 4-step license demo that works live with no server restart:

### Step 1: Confirm Initial Active License
```bash
curl http://localhost:8000/api/license/status
# Expected: {"status": "ACTIVE", "active": true, ...}
```

### Step 2: Activate Expired / 5-Minute License
```bash
# Generate instant expired license (or use short_license.json after 5 min)
python scripts/generate_license.py --type expired

# Upload to server
curl -X POST http://localhost:8000/api/license/activate \
  -H "Content-Type: application/json" \
  -d @licenses/already_expired_license.json

# Check status:
curl http://localhost:8000/api/license/status
# Expected: {"status": "EXPIRED", "active": false}

# Verify protected endpoints are blocked:
curl http://localhost:8000/api/lookup?identifier=9108128632
# Expected: HTTP 403 {"error": "LICENSE_EXPIRED"}
```
*In the browser at `http://localhost:5173`, the full-screen "Licence expired" screen appears.*

### Step 3: Renew with Long License (No Restart)
Copy the key from `licenses/long_license.key` and paste it into the renewal input on screen, or run:
```bash
curl -X POST http://localhost:8000/api/license/activate \
  -H "Content-Type: application/json" \
  -d @licenses/long_license.json
```

### Step 4: Confirm App Is Immediately Restored
```bash
curl http://localhost:8000/api/license/status
# Expected: {"status": "ACTIVE", "active": true}

# Normal lookups resume immediately:
curl http://localhost:8000/api/lookup?identifier=9108128632
# Expected: HTTP 200 with normal lookup result!
```
*The browser screen instantly unlocks without restarting uvicorn or the browser!*

---

## 16. How to Deploy the Application (HTTPS)

### Option A: Systemd + Reverse Proxy (Nginx / Caddy on VPS)
1. **Backend Service:**
   ```ini
   [Unit]
   Description=CyberForge Backend
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/opt/cyberforge/backend
   ExecStart=/opt/cyberforge/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
2. **Caddy (Automatic HTTPS):**
   ```caddyfile
   scam-map.yourdomain.in {
       # Serve built React frontend
       root * /opt/cyberforge/cyberforge/frontend/dist
       file_server

       # Reverse proxy API calls to FastAPI
       handle /api/* {
           reverse_proxy 127.0.0.1:8000
       }
       handle /health {
           reverse_proxy 127.0.0.1:8000
       }
       try_files {path} /index.html
   }
   ```

### Option B: Cloud Hosting (Railway / Render / Fly.io)
- Set build command: `pip install -r backend/requirements.txt && cd cyberforge/frontend && npm install && npm run build`
- Set start command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`

---

## 17. Dispute System (Report Reference ID)

- Disputes are strictly filed against a specific report **Reference ID** (`report_id`), **not** a raw phone number, bank account, or identifier.
- Filing a dispute against a phone number returns **HTTP 400 Bad Request**.
- Filing a dispute against a non-existent ID returns **HTTP 404 Not Found**.
- Disputing marks the specific report as `is_disputed = 1`, caps the entity verdict at `SUSPICIOUS`, preserves all evidence, and displays the `⚠️ Disputed` badge.

---

## 18. Verified Businesses & Helplines

The database contains pre-seeded verified entities (Appendix C):
- National Cyber Helpline: `1930`
- Do Not Call Registry: `1909`
- State Bank of India Toll-Free: `18001234`
- HDFC Bank Helpline: `18002026161`
- ICICI Bank Toll-Free: `18001080`
- Verified businesses always return `VERIFIED_BUSINESS` and are immune to community vandalism.

---

## 19. Known Limitations

- **Centroid Resolution:** Pincodes without centroid mapping in the national registry are cataloged under "Unmapped Area Reports" to prevent inventing misleading coordinates.
- **In-Memory License Manager:** Dynamically uploaded licenses are held in memory during the demo; for permanent multi-instance deployments, backing license state with Redis or SQLite is recommended.
