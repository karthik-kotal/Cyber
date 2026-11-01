# CyberForge — Complete Project Guide & Technical Dossier
**Community Scam Map for India**  
*Mitigata Hackathon Finalist Submission & Academic Project Reference*

---

## 1. Executive Summary & Core Identity

### What is CyberForge?
**CyberForge** is a privacy-first, community-driven threat intelligence platform and mobile application engineered to combat cyber fraud in India. It enables citizens to report, verify, and visualize scam telephone numbers, UPI IDs, fraudulent phishing URLs, and SMS headers in real-time, while strictly protecting reporter anonymity and safeguarding legitimate businesses against coordinated mob defamation (Sybil attacks).

### The Problem It Solves
India experiences millions of scam attempts daily—from fake digital arrests and electricity disconnection threats to predatory loan apps and parcel customs extortion. Existing systems suffer from three fundamental flaws:
1. **Reporting Friction & Fear**: Citizens fear reporting scams because law enforcement portals demand national identity documents (Aadhaar, PAN), revealing their identity to attackers or exposing their contact details.
2. **Defamation & Sybil Vulnerability**: Naive crowdsourced systems allow malicious actors or competitors to flood fake reports against legitimate local merchants, destroying their reputation.
3. **No Localized Pre-Emptive Intelligence**: Users only discover fraud after money is lost; there is no localized, privacy-safe neighborhood alert system for emerging scam patterns.

### How CyberForge Solves It
- **Zero-PII Community Ingestion**: Reports require zero phone numbers or emails from reporters. Identities and subnet IPs are cryptographically salted and hashed using HMAC-SHA256.
- **Deterministic Multi-Signal Trust Engine**: Uses graph-based Union-Find clustering and multi-signal similarity (reporter HMAC, evidence SHA-256, perceptual image hash, transaction references, text fingerprints, and IP subnet HMAC) to collapse coordinated spam mobs into a single distinct entity.
- **Protected Verified Registry**: Built-in, tamper-resistant registry (Appendix C helplines like 1930, 1909, official bank toll-free numbers, and legitimate merchants) that can *never* be flagged as scams, even if attacked by thousands of synthetic bots.
- **Privacy-Preserving Neighborhood Scam Map**: Aggregates verified reports at the 6-digit postal PIN code level without revealing exact victim geolocation coordinates.
- **Cross-Platform Delivery**: Production-ready React web application packaged as an Android APK via Capacitor 7 with full offline fallbacks and local network sync.

---

## 2. Elevator Pitches Tailored by Audience

### 30-Second Pitch (Fast & Punchy)
> "CyberForge is a privacy-first scam intelligence platform for India. When someone gets a suspicious call or UPI payment request, they can look it up in two seconds or report it anonymously without sharing any personal information. What makes CyberForge unique is our deterministic Anti-Sybil Trust Engine: even if a rival business pays a bot farm to submit 40 fake reports against a local bakery, our multi-signal clustering detects the coordination and guarantees the business is never falsely flagged. It puts community power against cybercriminals while maintaining mathematical immunity against false accusations."

### 1-Minute Pitch (Comprehensive Hackathon Demo)
> "Every day, thousands of Indians fall victim to digital arrests, fake KYC links, and UPI refund scams. But today's reporting systems are either too slow or completely unprotected against malicious mob reporting. 
>
> We built CyberForge: an anonymous, community-driven scam map and identifier verification system. Anyone can look up a phone number, UPI ID, or URL. If three independent citizens corroborate the scam, it's marked as a Known Scam. But to prevent weaponized false reporting, CyberForge implements a two-tier defense: First, an Appendix C protected registry that makes verified helplines and local businesses mathematically immune to community bans. Second, an Anti-Sybil Graph Engine using Union-Find clustering that analyzes IP subnets, perceptual image hashes, and report timing to group coordinated bots into a single vote. 
> 
> With 128 automated backend tests, 21 frontend tests, and a live Android APK tested on physical devices, CyberForge delivers production-grade cybersecurity for Indian citizens."

### 3-Minute Pitch (Technical Evaluation / Guide Defense)
> "Respected evaluators, existing crowdsourced reputation systems fail because they treat every incoming HTTP request as an independent vote. In cybersecurity, this is fatal: an adversary with an automated script can destroy a competitor or cover their tracks with Sybil flooding.
>
> In CyberForge, we solved this using deterministic cryptography and graph algorithms—without relying on unverified or hallucinating black-box ML models:
> 1. **Ingestion & Normalization**: Inputs undergo strict regex normalization. Indian mobile numbers are canonicalized to E.164 (`+91XXXXXXXXXX`), UPI IDs are validated against NPCI format, URLs are stripped of tracking parameters, and SMS headers are standardized.
> 2. **Zero-PII Storage**: Reporter IDs and client IPs are never written to disk in plain text. We hash reporter tokens and `/24` subnets with HMAC-SHA256 using a server-side secret key, ensuring irreversible privacy while preserving our ability to detect subnet-level clusters.
> 3. **The Multi-Signal Trust Engine**: When reports arrive for an identifier, we run a pairwise similarity matrix evaluating reporter HMACs (weight 0.40), evidence file SHA-256 hashes (0.35), transaction reference hashes (0.30), perceptual DCT image hashes (0.25), normalized note fingerprints (0.20), and burst timing under 10 minutes (0.10). An edge is formed when correlation exceeds 0.50, and Disjoint-Set Union-Find computes connected components. Coordinated mob attacks collapse into a single cluster.
> 4. **Protected Business Shield & Dispute Recourse**: Legitimate businesses are safeguarded by a protected registry. Furthermore, any citizen or merchant can submit an official challenge under `POST /challenges`. The moment a challenge is under review, the system automatically caps the verdict at `SUSPICIOUS`, completely preventing a defamatory `KNOWN_SCAM` label while administrators adjudicate evidence.
> 5. **Spatial Aggregation**: Scams are mapped strictly by postal PIN code centroids, displaying clusters with severity tags (CRIT, HIGH, MED) and detecting localized spikes without exposing user coordinates.
>
> The system has been validated across 128 backend tests, 21 frontend vitest suites, and a native Android build executing on physical hardware."

---

## 3. Technology Stack Breakdown

| Technology | Actual Version / Usage | Why Used in CyberForge |
|---|---|---|
| **Python** | 3.11 | High performance, strict type annotations, native cryptography libraries. |
| **FastAPI** | 0.115+ | High-throughput asynchronous ASGI web framework with automatic OpenAPI documentation. |
| **SQLite with WAL Mode** | 3.x (`cyberforge.db`, `cyberforge_demo.db`) | Zero-latency, ACID-compliant embedded database with Write-Ahead Logging for high concurrency and zero server maintenance overhead. |
| **HMAC-SHA256 & SHA256** | Python `hashlib` & `hmac` | Irreversible privacy hashing for reporter identifiers, IP subnets, and evidence integrity without leaking PII. |
| **Perceptual Hashing (pHash)** | Discrete Cosine Transform (DCT) | Robust screenshot near-duplicate detection resistant to resizing, compression, or format changes. |
| **React** | 18.3.1 | Declarative component architecture for rapid, reactive state management and fast UI updates. |
| **TypeScript** | 5.5+ | Full end-to-end type safety eliminating runtime type bugs across API models and components. |
| **Tailwind CSS** | 3.4+ | Utility-first responsive design system with custom Indian cybersecurity themes and accessible color contrasts. |
| **Leaflet & React-Leaflet** | 1.9+ / 4.2+ | Lightweight, open-source geospatial mapping library that renders pincode clusters without proprietary API token costs (Google Maps). |
| **Vite** | 5.4+ | Next-generation frontend tooling providing lightning-fast HMR and optimized production bundling. |
| **Capacitor** | 7.0+ | Cross-platform runtime enabling the React web application to run as a native Android APK with native WebView capabilities. |
| **Gradle & Android SDK** | Gradle 8.11.1, SDK 34, JDK 21 | Native Android build automation generating release and debug APKs. |
| **Pytest** | 8.3+ (128 tests passing) | Comprehensive test framework verifying API contracts, Sybil resistance, and edge cases. |
| **Vitest** | 2.1+ (21 tests passing) | Vite-native unit and component test runner testing React UI rendering, POVs, and API clients. |

---

## 4. Complete Repository Structure

```
E:\cyber\
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI application entry, CORS, POV routing middleware
│   │   ├── config.py                # Pydantic BaseSettings, HMAC secrets, thresholds
│   │   ├── database.py              # SQLite schema, WAL mode, table creation, active DB routing
│   │   ├── normalize.py             # Phone, UPI, URL, Sender ID regex & canonicalization
│   │   ├── privacy.py               # HMAC-SHA256, IP subnet masking, note fingerprinting
│   │   ├── verified.py              # Appendix C protected entities (helplines, banks, merchants)
│   │   ├── trust_engine.py          # Union-Find multi-signal clustering & verdict calculation
│   │   ├── alert_engine.py          # SPIKE (2x 7-day avg) and NEW_TYPE 24h area alert triggers
│   │   ├── areas.py                 # Pincode geocoding table, locality names, Haversine formula
│   │   ├── license.py               # Enterprise 365-day & Demo 5-minute license state managers
│   │   ├── schemas.py               # Pydantic v2 schemas for all requests, responses, and errors
│   │   ├── evidence/
│   │   │   ├── __init__.py
│   │   │   ├── hasher.py            # SHA-256 evidence hashing
│   │   │   ├── phash.py             # 64-bit DCT perceptual hash implementation
│   │   │   ├── similarity.py        # Pairwise multi-signal scoring & correlation weights
│   │   │   ├── manipulation.py      # Dual-hash integrity validation & disclaimers
│   │   │   ├── ocr.py               # OCR text token fingerprinting
│   │   │   └── tx_matcher.py        # UPI/IMPS/UTR transaction reference extraction & HMAC
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── reports.py           # POST /reports (ingestion, deduplication, merging)
│   │       ├── lookup.py            # GET /lookup (trust verdict, masking, evidence list)
│   │       ├── map.py               # GET /map (pincode cluster aggregation, severity)
│   │       ├── alerts.py            # GET /alerts (SPIKE, NEW_TYPE area alerts)
│   │       ├── challenges.py        # POST /challenges (dispute filing, verdict capping)
│   │       └── admin.py             # POST /admin/reset, disputes adjudication, audit log, reports
│   ├── tests/
│   │   ├── test_api_and_trust.py
│   │   ├── test_categories_and_nationwide_map.py
│   │   ├── test_dispute_system_and_rubric.py
│   │   ├── test_evidence_analysis.py
│   │   ├── test_evidence_manipulation_and_categories.py
│   │   ├── test_license_system.py
│   │   ├── test_normalize.py
│   │   ├── test_pincode_map_resolution.py
│   │   ├── test_prd_audit.py
│   │   └── test_three_pov.py
│   └── requirements.txt
│
├── cyberforge/
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx              # Root component, routing, bottom navigation
│       │   ├── main.tsx             # Entry point
│       │   ├── pages/
│       │   │   ├── ReportPage.tsx   # Anonymous scam report submission form
│       │   │   ├── LookupPage.tsx   # Identifier search with masked preview & evidence
│       │   │   ├── MapPage.tsx      # Leaflet geospatial map with pincode radius filtering
│       │   │   ├── AlertsPage.tsx   # Area emergency alerts (SPIKE, NEW_TYPE)
│       │   │   ├── ChallengePage.tsx# Citizen dispute filing modal & form
│       │   │   ├── AdminDashboardPage.tsx # Multi-signal Sybil console, disputes, audit log
│       │   │   ├── LicensePage.tsx  # License status, renewal, POV switcher
│       │   │   └── EntryPage.tsx    # Welcome landing screen
│       │   ├── components/
│       │   │   ├── Navbar.tsx       # Brand header, POV indicator, language switcher
│       │   │   ├── BottomNav.tsx    # Mobile navigation bar
│       │   │   ├── VerdictBadge.tsx # Semantic color-coded trust badge
│       │   │   └── LookupResultCard.tsx # Detailed lookup card
│       │   ├── context/
│       │   │   └── LicenseContext.tsx # Global license state & renewal context
│       │   ├── hooks/
│       │   │   ├── usePOV.ts        # 'normal' | 'admin' | 'demo' POV switcher
│       │   │   ├── useLang.ts       # English & Hindi localization hook
│       │   │   └── useApiData.ts    # Reusable data fetcher
│       │   ├── services/
│       │   │   └── api.ts           # Central HTTP client (handles base URLs & headers)
│       │   ├── constants/
│       │   │   └── verifiedBusinesses.ts # Frontend mirror of Appendix C verified entities
│       │   └── types/
│       │       └── api.ts           # TypeScript interfaces matching FastAPI schemas
│       ├── android/                 # Capacitor native Android studio project
│       │   ├── app/src/main/
│       │   │   ├── AndroidManifest.xml
│       │   │   └── res/xml/network_security_config.xml
│       │   └── build.gradle
│       ├── capacitor.config.ts      # Capacitor configuration
│       ├── package.json
│       └── vite.config.ts
│
└── docs/                            # Complete technical documentation suite
```

---

## 5. Feature Implementation Matrix

| Feature | User Functionality | Backend Implementation | Database Tables Used | Verification Status |
|---|---|---|---|---|
| **Anonymous Scam Reporting** | Report scam phone, UPI, URL, or sender ID with category, date, and pincode. | `POST /reports` (`reports.py`), normalization in `normalize.py`. | `reports`, `cases` | **Fully Implemented & Tested** (128 passing tests) |
| **Identifier Lookup** | Instant lookup of threat level, report count, distinct reporters, first/last seen. | `GET /lookup` (`lookup.py`), masking in `lookup.py`. | `cases`, `reports`, `verified_businesses` | **Fully Implemented & Tested** |
| **Geospatial Scam Map** | Displays scam clusters grouped by 6-digit PIN code with severity ratings. | `GET /map` (`map.py`), geocoding in `areas.py`. | `reports`, `areas.py` table | **Fully Implemented & Tested** (Tested with nationwide pincodes) |
| **Neighborhood Alerts** | Alerts residents to abnormal scam spikes or newly emerged scam types. | `GET /alerts` (`alerts.py`), rule engine in `alert_engine.py`. | `alerts`, `reports` | **Fully Implemented & Tested** |
| **Dispute Filing (Challenges)** | Allows legitimate owners to challenge defamatory reports. | `POST /challenges` (`challenges.py`). | `challenges`, `cases` | **Fully Implemented & Tested** |
| **Admin Dispute Adjudication** | Admin reviews evidence, approves (quarantines) or rejects dispute, logs audit trail. | `POST /admin/disputes/{id}/decide`, `GET /admin/disputes/audit-log`. | `challenges`, `reports`, `cases`, `dispute_audit_log` | **Fully Implemented & Tested** |
| **Multi-Signal Anti-Sybil Engine** | Groups coordinated spam reports using Union-Find clustering into 1 vote. | `evaluate_trust()` (`trust_engine.py`), `similarity.py`. | In-memory pairwise matrix on `reports` | **Fully Implemented & Tested** |
| **Verified Business Protection** | Protects banks, helplines, and local stores from ever reaching `KNOWN_SCAM`. | `verified.py`, `evaluate_trust()` in `trust_engine.py`. | `verified_businesses` | **Fully Implemented & Tested** (Verified in Scenario A) |
| **Three POV Modes** | Normal (citizen), Admin (full console), Demo (isolated 5-minute sandbox). | `usePOV.ts`, `license_and_pov_middleware` in `main.py`. | `cyberforge.db` vs `cyberforge_demo.db` | **Fully Implemented & Tested** |
| **Android Mobile Application** | Native APK communicating with local backend server over Wi-Fi. | Capacitor 7, `network_security_config.xml`. | Local storage & REST API | **Built & Verified on Physical Device** (APK 4.57MB) |
| **Evidence Analysis & pHash** | Detects duplicate or tampered screenshot evidence. | `hasher.py`, `phash.py`, `manipulation.py`. | `evidence` | **Fully Implemented & Tested** |
| **Dual Language Support** | Real-time English and Hindi translation across all views. | `useLang.ts` frontend dictionary. | Client-side bundle | **Fully Implemented & Tested** |

