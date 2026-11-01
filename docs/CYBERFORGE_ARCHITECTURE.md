# CyberForge — System Architecture & Technical Design

---

## 1. High-Level Architectural Overview

CyberForge is structured into a four-tier architecture designed for speed, anonymity, and tamper-resistant trust evaluation:
1. **Presentation Layer**: Responsive React 18 / TypeScript single-page application and native Android Capacitor 7 WebView wrapper.
2. **API & Routing Layer**: High-throughput FastAPI ASGI application handling request lifecycle, authentication, CORS, and database routing based on user Point-of-View (POV).
3. **Business Logic & Cryptographic Engine**: Deterministic normalization, zero-PII HMAC hashing, pairwise multi-signal correlation scoring, and Union-Find graph clustering.
4. **Data Persistence Layer**: Concurrent dual-database SQLite architecture with Write-Ahead Logging (WAL) ensuring complete data isolation between production and demonstration environments.

```mermaid
graph TD
    %% User Personas & Client Applications
    subgraph Presentation_Layer ["Presentation Layer (Clients & Mobile)"]
        CitizenUser["👤 Community Citizen"]
        AdminUser["🛡️ Cyber Admin / Analyst"]
        
        subgraph Web_Client ["React 18 + TypeScript Web App"]
            UI_Pages["UI Pages\n(Report, Lookup, Map, Alerts, Disputes)"]
            POV_State["POV State Router\n(Normal / Admin / Demo)"]
            LeafletMap["Leaflet GIS Map Engine\n(Pincode Centroid Clustering)"]
        end

        subgraph Mobile_App ["Android Native App (Capacitor 7)"]
            NativeAPK["CyberForge APK (io.ionic.starter)\nTarget SDK 34 / Java 21"]
            CapacitorBridge["Capacitor Bridge & Cleartext HTTP"]
        end
    end

    %% Network Boundary
    CitizenUser -->|Interacts| Web_Client
    CitizenUser -->|Uses Phone| NativeAPK
    AdminUser -->|Authenticates| Web_Client
    NativeAPK -->|Wraps UI via WebView| Web_Client
    Web_Client -->|REST API over HTTP/JSON| API_Gateway

    %% API Layer
    subgraph API_Layer ["API & Ingestion Layer (FastAPI ASGI)"]
        API_Gateway["FastAPI Entrypoint (main.py)\nPort 8000 / 0.0.0.0"]
        
        POV_Middleware{"POV Middleware\n(DB & License Routing)"}
        API_Gateway --> POV_Middleware

        Router_Reports["POST /reports\n(reports.py)"]
        Router_Lookup["GET /lookup\n(lookup.py)"]
        Router_Map["GET /map\n(map.py)"]
        Router_Alerts["GET /alerts\n(alerts.py)"]
        Router_Challenges["POST /challenges\n(challenges.py)"]
        Router_Admin["/admin/*\n(admin.py)"]
        Router_Health["GET /health\n(main.py)"]

        POV_Middleware --> Router_Reports
        POV_Middleware --> Router_Lookup
        POV_Middleware --> Router_Map
        POV_Middleware --> Router_Alerts
        POV_Middleware --> Router_Challenges
        POV_Middleware --> Router_Admin
        POV_Middleware --> Router_Health
    end

    %% Business Logic Layer
    subgraph Logic_Layer ["Business Logic & Cryptographic Core"]
        Normalizer["Identifier Normalizer (normalize.py)\nE.164 Phone / UPI / Clean URL / Sender ID"]
        Hasher["Zero-PII Privacy Engine (privacy.py)\nHMAC-SHA256 Reporter & Subnet Hashing"]
        VerifiedRegistry["Protected Business Registry (verified.py)\nAppendix C Helplines & Merchants"]
        
        subgraph Trust_Engine ["Anti-Sybil Trust Engine (trust_engine.py)"]
            PairwiseCorrelator["Multi-Signal Correlation (similarity.py)\nReporter, SHA-256, pHash, TxRef, Note, Subnet, Timing"]
            UnionFind["Disjoint-Set Union-Find\nCollapses Coordinated Mobs to 1 Cluster"]
            VerdictCalc["Verdict Evaluator\nKNOWN_SCAM | SUSPICIOUS | NO_REPORTS | VERIFIED_BUSINESS"]
        end

        AlertRules["Area Alert Engine (alert_engine.py)\nSPIKE (2x Avg) & NEW_TYPE (30d Baseline)"]
        GeoEngine["Pincode Geocoder (areas.py)\nCentroid Coordinates & Haversine Distance"]
    end

    Router_Reports --> Normalizer
    Normalizer --> Hasher
    Hasher --> Trust_Engine
    Router_Reports --> VerifiedRegistry
    Router_Reports --> AlertRules
    Router_Lookup --> Normalizer
    Router_Lookup --> VerifiedRegistry
    Router_Lookup --> Trust_Engine
    Router_Map --> GeoEngine
    Router_Alerts --> AlertRules

    %% Data Persistence Layer
    subgraph Data_Layer ["Data Persistence Layer (SQLite WAL Mode)"]
        DB_Switch{"POV Context Switch"}
        POV_Middleware -.->|normal / admin| DB_Switch
        POV_Middleware -.->|demo| DB_Switch

        ProdDB[("Production DB\ncyberforge.db")]
        DemoDB[("Isolated Demo DB\ncyberforge_demo.db")]

        DB_Switch -->|Production| ProdDB
        DB_Switch -->|Demo Sandbox| DemoDB

        subgraph Tables ["8 Relational Tables (ACID)"]
            T_Cases["cases (Aggregated Threat Status)"]
            T_Reports["reports (Immutable Report Records)"]
            T_Evidence["evidence (SHA-256 & pHash Metadata)"]
            T_TxRefs["transaction_references (Hashed UTRs)"]
            T_Verified["verified_businesses (Appendix C Seeded)"]
            T_Challenges["challenges (Dispute State Machine)"]
            T_Alerts["alerts (Pincode Spike & Type Triggers)"]
            T_Audit["dispute_audit_log (Admin Decision Trail)"]
        end

        ProdDB --- Tables
        DemoDB --- Tables
    end
```

---

## 2. Layer-by-Layer Architectural Breakdown

### 1. Presentation Layer (Frontend & Mobile)
- **Framework**: React 18 single-page application written strictly in TypeScript.
- **Styling**: Tailwind CSS utility classes styled for rapid mobile-first rendering.
- **Routing**: Client-side hash routing (`/#/report`, `/#/check`, `/#/map`, `/#/alerts`, `/#/admin`, `/#/license`). Hash routing was deliberately chosen so the application functions identically whether hosted from an HTTP server or loaded internally inside an Android `file:///android_asset/` or Capacitor WebView.
- **Geographic Visuals**: Leaflet and React-Leaflet render geographic circles around postal PIN code centroids. Coordinates are fetched dynamically from the backend without third-party geocoding dependencies.
- **Android Integration**: The web application is bundled inside an Android container using Capacitor 7. The native wrapper configures:
  - `AndroidManifest.xml`: Network security permission `<uses-permission android:name="android.permission.INTERNET" />`.
  - `network_security_config.xml`: Cleartext HTTP permission for local development IP addresses (`192.168.60.239:8000`), allowing physical mobile phones on the same Wi-Fi network to submit live scam reports and perform lookups.

### 2. API & Routing Layer (FastAPI ASGI)
- **FastAPI Engine**: Mounted on `http://0.0.0.0:8000` to accept connections from both `localhost` and local area network (LAN) mobile devices.
- **POV Middleware (`license_and_pov_middleware`)**: Inspects the incoming `x-cyberforge-pov` HTTP header:
  - If `x-cyberforge-pov: demo`: Binds the database session thread-locally to `cyberforge_demo.db` and enforces the isolated 5-minute hackathon evaluation license.
  - If `x-cyberforge-pov: admin` or `normal`: Binds to `cyberforge.db` and enforces standard production license validations.
- **Dual Endpoint Mounting**: Mounts endpoints at both the root level (e.g. `/reports`, `/lookup`, `/map`, `/alerts`, `/admin/reset` per Mitigata specification) and under `/api/*` for standardized frontend AJAX consumption.

### 3. Business Logic & Cryptographic Engine
- **Deterministic Normalizer (`normalize.py`)**: Sanitizes and validates all user inputs before touching the database:
  - Phones: Strips spaces, dashes, brackets, and `+91`/`0` prefixes. Rejects numbers not matching Indian mobile (`[6-9]\d{9}`), landline STD, or toll-free (1800/1860) formats.
  - UPI IDs: Verifies `handle@bank` syntax, lowercases handles.
  - URLs: Strips protocol variations, removes tracking query parameters (`utm_*`, `fbclid`, `gclid`), and normalizes hostnames.
  - SMS Headers: Validates 6-character telecommunication sender IDs (e.g., `VM-HDFCBK` -> `HDFCBK`).
- **Zero-PII Privacy Engine (`privacy.py`)**:
  - Reporter ID: Hashed via `HMAC-SHA256(key=HMAC_SECRET, message=reporter_id)`. The original reporter ID is destroyed from RAM immediately after ingestion.
  - IP Subnet: Extracts `/24` prefix (e.g., `103.21.58.0`) and hashes via `HMAC-SHA256`. Preserves ability to detect bot farms operating on the same subnet without ever recording the citizen's actual IP address.
  - Note Fingerprint: Strips punctuation, collapses whitespace, and generates a SHA-256 digest of report descriptions to instantly flag copy-pasted scam scripts.
- **Anti-Sybil Trust Engine (`trust_engine.py` & `similarity.py`)**:
  - Computes pairwise correlation scores between all reports submitted against the same identifier.
  - Utilizes a Disjoint-Set Union-Find data structure with path compression to calculate connected components.
  - Returns `distinct_reporters`: the true count of independent, uncorrelated reporting clusters.
- **Protected Registry (`verified.py`)**:
  - Contains hardcoded, certified helplines (TRAI 1909, Cybercrime 1930), bank customer care numbers, verified SMS sender IDs, and official government portals.
  - Bypasses community trust calculations: verified entities always yield `VERIFIED_BUSINESS` and are immune to community-driven scam designations.

### 4. Data Persistence Layer (SQLite with WAL Mode)
- **Database Engine**: Python's native `sqlite3` configured with `PRAGMA journal_mode=WAL` (Write-Ahead Logging).
- **Concurrency & Speed**: WAL mode allows concurrent readers to access tables without blocking writers, delivering sub-millisecond query responses under high query volumes.
- **Schema Design**: 8 strictly typed relational tables enforcing referential integrity, unique constraints, and indexed queries.

---

## 3. Communication & Data Flow Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as 📱 Citizen (Android APK / Web)
    participant API as 🚀 FastAPI (reports.py)
    participant Norm as 🔍 Normalizer & Privacy
    participant Trust as 🛡️ Trust Engine (Union-Find)
    participant DB as 💾 SQLite (cyberforge.db)
    actor Merchant as 🏪 Business / Citizen
    participant AdminAPI as ⚖️ Admin & Dispute API

    %% Scam Reporting Flow
    Citizen->>API: POST /reports (Identifier, Category, Pincode, Note)
    API->>Norm: Normalize identifier & hash reporter PII (HMAC-SHA256)
    Norm-->>API: Canonical value & hashed tokens
    API->>DB: Query existing reports for identifier
    DB-->>API: Existing report records
    API->>Trust: Run pairwise similarity & Union-Find clustering
    Trust-->>API: distinct_reporters count & trust verdict
    API->>DB: INSERT report & UPSERT case record
    API-->>Citizen: 201 Created {"report_id": "...", "case_id": "...", "merged": true}

    %% Dispute & Challenge Flow
    Merchant->>AdminAPI: POST /challenges (Target ID, Claimant Name, Proof Note)
    AdminAPI->>DB: INSERT challenge ("under_review") & UPDATE case (challenged=1)
    AdminAPI-->>Merchant: 201 Created {"challenge_id": "...", "status": "under_review"}
    Note over Citizen,DB: Future GET /lookup requests for this ID are capped at SUSPICIOUS

    %% Admin Adjudication Flow
    AdminAPI->>DB: POST /admin/disputes/{id}/decide (action: "APPROVE")
    DB->>DB: Set challenge="resolved", target report="QUARANTINED"
    AdminAPI->>Trust: Recalculate case verdict excluding quarantined report
    Trust-->>AdminAPI: Updated distinct_reporters & updated verdict
    AdminAPI->>DB: UPDATE case & INSERT dispute_audit_log
    AdminAPI-->>Merchant: 200 OK {"action": "APPROVE", "new_report_status": "QUARANTINED"}
```

---

## 4. Key Architectural Design Decisions & Trade-Offs

| Decision | Alternative Considered | Why CyberForge Chose This Approach |
|---|---|---|
| **Deterministic Heuristics & Graph Clustering instead of Machine Learning** | Fine-tuned LLM or Random Forest classifier | **Zero Hallucinations & Absolute Auditability**: In legal disputes and cybercrime reporting, a false scam accusation destroys lives and businesses. A deterministic algorithm with explicit mathematical weights (0.40 HMAC, 0.35 SHA-256, etc.) can be defended in court or before judges, requires zero GPU overhead, and runs in sub-10 milliseconds. |
| **HMAC-SHA256 Hashing instead of Raw Database Storage** | Storing plain text IPs and reporter contact details | **Zero-PII Compliance & Whistleblower Protection**: Eliminates citizen fear of retaliation. If the CyberForge database were ever breached, attackers would find zero IP addresses, zero reporter phone numbers, and zero personal names. |
| **SQLite with WAL Mode instead of PostgreSQL/MySQL** | Hosted PostgreSQL cluster | **Zero Deployment Overhead & Complete Portability**: CyberForge runs anywhere—on a laptop, an edge Raspberry Pi, an offline workstation, or inside a container—without configuring database users, ports, passwords, or network listeners. WAL mode easily handles thousands of requests per second. |
| **Pincode Centroid Clustering instead of GPS Coordinates** | Requesting browser GPS geolocation | **Victim Privacy Preservation**: Displaying an exact GPS coordinate on a map risks pinpointing a victim's private home. Grouping by 6-digit postal PIN code centroids protects victim privacy while alerting the neighborhood. |
| **Client-Side Hash Routing (`/#/`) instead of HTML5 History PushState** | Standard browser pathname routing (`/report`) | **Native Android File Compatibility**: PushState routing fails inside native Android WebViews when local asset files are served (`file:///`). Hash routing guarantees seamless cross-platform execution on both web browsers and native APKs. |

