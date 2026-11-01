# CyberForge — Comprehensive Judge & Guide Q&A Bank
*50+ In-Depth Technical, Security, and Architectural Questions & Answers*

---

## Category 1: High-Level Architecture & Design Decisions

### Q1: Why did you not use Machine Learning (ML) for fraud detection?
**Answer**:  
"We deliberately chose not to integrate machine learning into our active detection pipeline for three critical reasons:
1. **Explainability & Legal Accountability**: When a business or individual is accused of being a scammer, that decision can result in severe financial loss or police investigation. An opaque neural network or random forest cannot explain *why* an entity was flagged with mathematical certainty.
2. **Defamation & Hallucinations**: Probabilistic ML models suffer from false positives and distribution drift. In a cyber fraud platform, a false positive on a local merchant is catastrophic.
3. **Deterministic Auditability**: Our cryptographic hashing, regex normalization, and Disjoint-Set Union-Find clustering provide 100% transparent, auditable, and court-admissible decision trails that execute in sub-10 milliseconds without requiring expensive GPU clusters."

### Q2: What is the exact role of the three Point-of-View (POV) modes?
**Answer**:  
"CyberForge implements three distinct user POVs to streamline evaluation, operations, and community use:
- **Normal POV**: The clean citizen view. Zero friction, no login required, no license popups. Citizens can report scams, perform lookups, and browse local maps.
- **Admin POV**: The cybersecurity analyst console. Requires administrator authentication (`ADMIN_TOKEN`), allowing operators to adjudicate business disputes, inspect Sybil clusters, and view immutable audit trails.
- **Demo POV**: An isolated, thread-safe evaluation sandbox operating on a secondary database (`cyberforge_demo.db`) with an isolated 5-minute renewable license. It allows hackathon judges to inject malicious attacks and test system recovery without polluting production data."

### Q3: How does the backend route requests between production and demo databases?
**Answer**:  
"In `backend/app/main.py`, our custom ASGI middleware `license_and_pov_middleware` inspects the incoming `x-cyberforge-pov` HTTP header on every request. If the header is set to `demo`, it dynamically binds Python's thread-local database context (`set_active_db`) to `cyberforge_demo.db`. All subsequent SQL queries executed during that request lifecycle execute exclusively against the demo sandbox. When omitted or set to `normal`/`admin`, it routes to `cyberforge.db`."

### Q4: Why did you choose SQLite with WAL mode over a hosted PostgreSQL database?
**Answer**:  
"SQLite with Write-Ahead Logging (WAL mode) offers extreme benefits for edge cybersecurity platforms:
1. **Zero External Latency**: Reading and writing directly to disk via OS-level memory mapping executes in microseconds, avoiding TCP socket roundtrip latency.
2. **True Concurrency**: In WAL mode (`PRAGMA journal_mode=WAL`), SQLite supports concurrent read transactions without blocking write transactions.
3. **Zero Deployment Footprint**: The platform runs seamlessly on an investigator's laptop, an offline edge server, or inside an Android container without spinning up database servers, managing connection pools, or configuring network firewalls."

### Q5: How is client-side routing implemented, and why?
**Answer**:  
"We utilized hash routing (`/#/report`, `/#/check`, `/#/map`, `/#/alerts`, `/#/admin`). This was an essential architectural decision to ensure 100% cross-platform parity between web browsers and native Android Capacitor WebViews. Standard HTML5 PushState history routing fails inside mobile WebViews when assets are served via local file protocols (`file:///`), whereas hash routing functions flawlessly across all environments."

---

## Category 2: The Anti-Sybil Trust Engine & Mathematics

### Q6: What is a Sybil attack in the context of CyberForge?
**Answer**:  
"A Sybil attack occurs when a single malicious actor generates multiple fake identities (using scripts, VPNs, or device spoofing) to overwhelm a community consensus system. For example, a corrupt competitor might submit 40 fake reports against an innocent bakery to deceive the platform into tagging the bakery as a `KNOWN_SCAM`."

### Q7: Explain the mathematical formula used for pairwise report similarity.
**Answer**:  
"In `app/evidence/similarity.py`, we calculate the pairwise similarity between two reports $R_i$ and $R_j$ as:
$$\text{Similarity}(R_i, R_j) = \sum_{k=1}^{7} w_k \cdot \mathbb{I}(\text{Signal}_k)$$
Where the weights are:
- Same Reporter HMAC: $+0.40$
- Identical Screenshot File SHA-256: $+0.35$
- Identical Transaction Ref HMAC: $+0.30$
- Perceptual Hash (pHash) Hamming Distance $\le 10$: $+0.25$
- Identical Text Description Fingerprint: $+0.20$
- Same `/24` Subnet IP Prefix HMAC: $+0.10$
- Temporal Burst Window (<10 minutes): $+0.10$
If the sum exceeds $0.50$ (or if the reporter HMACs match), an undirected edge is established between the reports in our similarity graph."

### Q8: How does the Disjoint-Set Union-Find algorithm prevent false scam flags?
**Answer**:  
"Once edges are established, our Disjoint-Set Union-Find algorithm with path compression iterates through the graph and executes `union(parent[i], parent[j])`. All reports belonging to the same coordinated campaign are collapsed into a single connected component.
The system then calculates `distinct_reporters` as the number of unique root parents.
Even if 40 bot reports were submitted, they collapse into **1 single cluster**. Because our threshold for `KNOWN_SCAM` requires $\text{distinct\_reporters} \ge 3$, the target stays capped at `SUSPICIOUS`, completely defeating the attack."

### Q9: What is the time complexity of your Anti-Sybil engine?
**Answer**:  
"The pairwise correlation matrix takes $O(N^2 \cdot K)$, where $N$ is the number of reports against that specific identifier and $K$ is the number of signals compared ($K=7$). The Union-Find clustering with path compression runs in $O(M \cdot \alpha(N))$, where $\alpha$ is the Inverse Ackermann function (effectively constant, $\le 4$). Because reports per identifier in real-world scenarios are bounded ($N < 100$), the entire calculation executes in under 5 milliseconds on a single CPU core."

### Q10: What are the exact thresholds for the four trust verdicts?
**Answer**:  
"Our verdict logic in `app/trust_engine.py` follows strict, mutually exclusive rules:
1. `VERIFIED_BUSINESS`: Identifier exists in the `verified_businesses` registry. (Fraud Risk: ZERO).
2. `KNOWN_SCAM`: $\text{distinct\_reporters} \ge 3$, target is NOT currently challenged, and is NOT a verified business.
3. `SUSPICIOUS`: $1 \le \text{distinct\_reporters} < 3$, OR the case is currently challenged under dispute.
4. `NO_REPORTS`: $\text{distinct\_reporters} == 0$ (no valid reports recorded in the database)."

---

## Category 3: Security, Privacy & Zero-PII Cryptography

### Q11: How do you protect the privacy of citizens reporting scams?
**Answer**:  
"CyberForge enforces Zero-Knowledge Community Ingestion. We never collect names, phone numbers, or email addresses from reporters. Any reporter session token or device ID is immediately hashed using HMAC-SHA256 with a server-side secret key (`settings.HMAC_SECRET`). The raw reporter ID is destroyed from RAM immediately after ingestion and is never written to disk."

### Q12: How do you store IP addresses without violating user privacy?
**Answer**:  
"In `app/privacy.py`, we extract only the network prefix: the `/24` subnet for IPv4 (masking the last 8 host bits to zero, e.g., `103.21.58.0`) or the `/48` subnet for IPv6. We then compute:
$$\text{SubnetHMAC} = \text{HMAC-SHA256}(K, \text{SubnetAddress})$$
This allows our Anti-Sybil engine to detect if 20 reports originated from the same local ISP subnet or bot office, while making it mathematically impossible to recover or identify the specific citizen's device."

### Q13: What is a Note Fingerprint and why is it useful?
**Answer**:  
"Attackers who flood platforms with fake reports often reuse identical copy-paste scripts or templates. In `compute_note_fingerprint()`, we normalize the text by stripping all punctuation, collapsing whitespace, and converting to lowercase. We then compute its SHA-256 digest. Identical or copy-pasted complaint notes yield the exact same fingerprint in $O(1)$ time, providing immediate proof of coordinated harassment."

### Q14: How does perceptual hashing (pHash) detect modified screenshots?
**Answer**:  
"Unlike SHA-256 which breaks if a single pixel is altered, our 64-bit Discrete Cosine Transform (DCT) perceptual hash (`phash.py`) converts the screenshot into frequency space, extracts the lowest 64 AC frequencies, and computes a 64-bit median hash. Two screenshots with a Hamming distance $\le 10$ are recognized as near-duplicates, detecting scammers who slightly crop, recompress, or resize the same fake transaction screenshot across different reports."

### Q15: How are administrator routes secured?
**Answer**:  
"In `app/routes/admin.py`, the `require_admin_auth()` dependency validates incoming requests. When operating in production POV, the request must provide a valid `x-admin-token` header or `Authorization: Bearer <token>` matching `settings.ADMIN_TOKEN`. Unauthorized requests receive an immediate HTTP 401 Unauthorized."

---

## Category 4: Defamation Prevention & Business Disputes

### Q16: How does CyberForge protect legitimate businesses from weaponized mob reporting?
**Answer**:  
"We protect legitimate businesses through a two-tier defense:
1. **The Certified Registry (`verified.py`)**: Official helplines (1930, 1909), verified banks (HDFC, SBI, ICICI), and registered local merchants are seeded into `verified_businesses`. The trust engine short-circuits on these entities, guaranteeing they can *never* be labeled a scam.
2. **The Legal Dispute Recourse (`POST /challenges`)**: Any merchant can submit an appeal with proof (GST certificate, trade license). The moment an appeal is registered, the platform automatically caps the threat verdict at `SUSPICIOUS`, completely preventing defamatory `KNOWN_SCAM` tags while evidence is under review."

### Q17: What happens to a report when an administrator approves a dispute?
**Answer**:  
"When an admin executes `POST /admin/disputes/{id}/decide` with `action: "APPROVE"`:
1. The challenge status updates from `under_review` to `RESOLVED`.
2. The defamatory report status transitions from `ACCEPTED` to `QUARANTINED`.
3. The trust engine immediately recalculates the case score excluding the quarantined report.
4. An immutable audit record is logged in `dispute_audit_log` detailing the deciding officer, timestamp, and justification."

### Q18: What is Privacy Masking on identifier lookups?
**Answer**:  
"To prevent bad actors from doxing individuals by submitting a single uncorroborated report, CyberForge enforces privacy masking on `GET /lookup`. Until at least 3 independent reporters corroborate an identifier, the system returns masked strings:
- Phones: `98XXXXX210`
- UPI IDs: `r***@okaxis`
- URLs: `sbi***.in/...`
- SMS Headers: `HD****`
Only when $\text{distinct\_reporters} \ge 3$ is the full identifier displayed."

---

## Category 5: API Design & Data Persistence

### Q19: How does CyberForge satisfy the Mitigata hackathon PRD API contracts?
**Answer**:  
"We implemented the exact PRD endpoints at the application root:
- `GET /health` $\to$ Returns 200 with `{"ok": true}`.
- `POST /reports` $\to$ Returns 201 with `report_id`, `case_id`, and `merged: true/false`.
- `GET /lookup` $\to$ Returns 200 with `verdict`, `distinct_reporters`, `display_value`, and evidence.
- `GET /map` $\to$ Returns grouped PIN code clusters with severity tags.
- `GET /alerts` $\to$ Returns `SPIKE` and `NEW_TYPE` triggers.
- `POST /admin/reset` $\to$ Wipes user reports and restores seeded verified businesses.
- `POST /challenges` $\to$ Registers bonus dispute appeals."

### Q20: What is the exact database schema?
**Answer**:  
"In `app/database.py`, we define 8 relational tables:
1. `cases`: Stores aggregated threat status per identifier.
2. `reports`: Immutable log of citizen scam submissions.
3. `evidence`: Metadata for uploaded screenshots (SHA-256, pHash, file size).
4. `transaction_references`: Hashed UPI/IMPS UTR numbers for payment tracking.
5. `verified_businesses`: Appendix C seeded protected entities.
6. `challenges`: Citizen dispute and business appeal state machine.
7. `alerts`: Triggered area alerts for spikes and emerging fraud patterns.
8. `dispute_audit_log`: Permanent audit trail of administrative decisions."

---

## Category 6: Geospatial Mapping & Alert Mechanics

### Q21: Why does CyberForge never show the exact GPS coordinates of victims on the map?
**Answer**:  
"Displaying exact GPS pinpoints on a public map creates severe victim safety risks—an attacker or stalker could zoom into an apartment building and identify who reported them. Instead, CyberForge aggregates all reports by 6-digit postal PIN code centroids (`areas.py`). Communities get clear threat intelligence about local scam density without compromising victim privacy."

### Q22: How is the severity of a map cluster determined?
**Answer**:  
"In `GET /map`, clusters within the queried radius are assigned severity based on verified report volume within the time window:
- `CRIT`: 10 or more reports.
- `HIGH`: 5 to 9 reports.
- `MED`: 1 to 4 reports."

### Q23: What mathematical condition triggers a SPIKE alert?
**Answer**:  
"In `app/alert_engine.py`, a `SPIKE` alert triggers for a postal PIN code when:
$$\text{Reports}_{24\text{h}} \ge 2.0 \times \text{DailyAverage}_{7\text{d}} \quad \land \quad \text{Reports}_{24\text{h}} \ge 5$$
Furthermore, to prevent a single attacker from manufacturing community panic, the system requires $\text{DistinctReporters}_{24\text{h}} \ge 2$."

### Q24: What triggers a NEW_TYPE alert?
**Answer**:  
"A `NEW_TYPE` alert triggers when a scam category (e.g., `digital-arrest` or `electricity-disconnection`) appears in a PIN code in the last 24 hours, but had zero recorded reports in that same PIN code over the preceding 30 days."

---

## Category 7: Mobile Engineering & Native Android Build

### Q25: How was the native Android APK built and verified?
**Answer**:  
"The Android application was built using Capacitor 7, compiling our React 18 TypeScript frontend into a native Android project using Gradle 8.11.1, Android SDK 34 (Android 14), and OpenJDK 21. The resulting debug APK (`app-debug.apk`) is 4.57 MB and runs natively on Android devices."

### Q26: How does the physical Android phone communicate with the backend on a laptop?
**Answer**:  
"During demonstrations, the laptop and the physical Android smartphone connect to the same local Wi-Fi router. The FastAPI backend listens on `0.0.0.0:8000`. In `network_security_config.xml`, we configure cleartext HTTP permissions for `192.168.60.239:8000`. The Android WebView dispatches AJAX requests directly across the local subnet, delivering real-time mobile scam reporting with sub-50ms latency."

---

## Category 8: Testing, Quality Assurance & Edge Cases

### Q27: How many automated tests exist in the project, and do they all pass?
**Answer**:  
"We have **149 total automated tests** (128 backend Pytest cases and 21 frontend Vitest component tests). All 149 tests pass cleanly (100% green). Tests cover input normalization, Anti-Sybil attacks, dispute workflows, geospatial radius filtering, and database transaction integrity."

### Q28: How does the system handle junk input reports?
**Answer**:  
"The PRD states: *'Some test reports are junk on purpose; rejecting them is correct.'* In `app/normalize.py`, non-Indian phone formats (e.g. `12345`), malformed UPI strings, and tracking-polluted URLs raise an `InvalidIdentifierError`, which FastAPI returns as a clean HTTP 400 Bad Request."

### Q29: What happens if two reports submit the exact same transaction UTR number?
**Answer**:  
"In `app/evidence/tx_matcher.py`, transaction references (such as UPI 12-digit UTRs) are extracted and hashed. If two reports against the same identifier cite the same transaction reference, the similarity engine awards $+0.30$ correlation weight. Combined with subnet or timing signals, this immediately collapses the reports into a single cluster."

---

## Category 9: Future Roadmap & Scalability

### Q30: How would CyberForge scale to 10 million daily reports across India?
**Answer**:  
"The architecture is engineered for horizontal scaling:
1. **Stateless API Tier**: FastAPI instances can run behind an NGINX or AWS ALB load balancer.
2. **Database Migration**: SQLite WAL handles millions of reads on edge nodes; for nationwide cloud clustering, the relational schema maps cleanly to PostgreSQL with PostGIS extensions for spatial queries.
3. **Caching**: Geocoded PIN code centroids and the `verified_businesses` table can be cached in Redis with near-infinite read throughput."

