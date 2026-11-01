# CyberForge — Academic Guide & Hackathon Presentation Playbook
*Presentation Scripts, Live Demo Sequences, and Defense Strategies*

---

## 1. Strategy by Evaluator Persona

### Persona A: The College Project Guide (Academic & Architectural Focus)
- **Key Guide Priorities**: Rigorous engineering discipline, sound theoretical foundations, clean separation of concerns, deterministic data structures, and academic integrity.
- **Key Talking Points**:
  - *"We deliberately chose not to include black-box ML models because in cybersecurity and legal defamation, hallucinations and false positives destroy lives. Our platform is 100% auditable, grounded in discrete graph algorithms and cryptographic standards."*
  - Emphasize **STRIDE Threat Modeling**, **Disjoint-Set Union-Find** with path compression ($O(M \cdot \alpha(N))$ time complexity), and **HMAC-SHA256 Zero-PII ingestion**.
  - Highlight the **128 automated backend unit/integration tests** and **21 frontend Vitest component tests**, proving software engineering rigor.

### Persona B: Hackathon Judges (Mitigata Cybersecurity Evaluators)
- **Key Judge Priorities**: Real-world practicality in India, anti-abuse resilience (how do you prevent rivals from spamming fake reports?), user experience, and working code.
- **Key Talking Points**:
  - Show live attacks! Demonstrate 40 synthetic reports hitting a local bakery and show why the bakery's score remains untouched.
  - Show the **Android native APK running on a physical smartphone** interacting with the backend server over Wi-Fi.
  - Explain the **Appendix C verified shield** and the **bonus dispute recourse system (`POST /challenges`)** which caps verdicts at `SUSPICIOUS` while disputes are under review.

---

## 2. Presentation Scripts by Time Limit

### The 30-Second Elevator Pitch
> "CyberForge is a privacy-first scam intelligence platform for India. When someone gets a suspicious call or UPI payment request, they can look it up in two seconds or report it anonymously without sharing any personal information. What makes CyberForge unique is our deterministic Anti-Sybil Trust Engine: even if a rival business pays a bot farm to submit 40 fake reports against a local bakery, our multi-signal clustering detects the coordination and guarantees the business is never falsely flagged. It puts community power against cybercriminals while maintaining mathematical immunity against false accusations."

---

### The 1-Minute Pitch
> "Every day, thousands of Indians fall victim to digital arrests, fake KYC links, and UPI refund scams. But today's reporting systems are either too slow or completely unprotected against malicious mob reporting. 
>
> We built CyberForge: an anonymous, community-driven scam map and identifier verification system. Anyone can look up a phone number, UPI ID, or URL. If three independent citizens corroborate the scam, it's marked as a Known Scam. But to prevent weaponized false reporting, CyberForge implements a two-tier defense: First, an Appendix C protected registry that makes verified helplines and local businesses mathematically immune to community bans. Second, an Anti-Sybil Graph Engine using Union-Find clustering that analyzes IP subnets, perceptual image hashes, and report timing to group coordinated bots into a single vote. 
> 
> With 128 automated backend tests, 21 frontend tests, and a live Android APK tested on physical devices, CyberForge delivers production-grade cybersecurity for Indian citizens."

---

### The 3-Minute Comprehensive Hackathon Presentation
> "Good morning, respected judges. In 2026, cyber fraud in India has evolved into an industrial enterprise. Victims lose life savings in minutes to digital arrests, loan app harassment, and fake electricity disconnection SMS messages.
>
> But when victims want to warn their community, they hit two walls: First, reporting portals demand Aadhaar and personal details, causing reporting fear. Second, whenever open crowdsourced platforms emerge, cybercriminals and unethical competitors flood them with fake reports to take down innocent merchants.
>
> To solve this, we engineered **CyberForge – Community Scam Map**.
>
> CyberForge operates on three foundational pillars:
> 
> **Pillar 1: Zero-PII Anonymous Ingestion**  
> Citizens can report scams in seconds without creating an account or revealing their identity. The backend instantly converts reporter tokens and `/24` IP subnets into irreversible HMAC-SHA256 digests. Whistleblowers are mathematically protected against doxing.
>
> **Pillar 2: Deterministic Anti-Sybil Graph Clustering**  
> How do we stop a bot farm from submitting 40 fake reports against a local shop? Unlike black-box ML models that hallucinate or require heavy GPU clusters, CyberForge uses a multi-signal pairwise correlation matrix. We analyze 7 distinct signals: reporter HMACs, evidence SHA-256 hashes, DCT perceptual image hashes, transaction references, text description fingerprints, subnet IPs, and temporal burst proximity. Our Disjoint-Set Union-Find algorithm with path compression collapses coordinated bots into a single distinct vote. 40 coordinated reports count as exactly 1 reporter.
>
> **Pillar 3: Protected Registries & Legal Dispute Recourse**  
> We protect national helplines like 1930 and 1909, banks, and verified businesses in a certified registry that can never be labeled a scam. Furthermore, any merchant can file a formal challenge via our dispute endpoint. The moment a dispute is lodged, the system immediately caps the threat verdict at `SUSPICIOUS`, completely preventing defamatory `KNOWN_SCAM` labels while our admin console adjudicates evidence with a complete audit trail.
>
> CyberForge is fully realized: 128 passing backend tests, 21 passing frontend tests, and an active Android APK running live on our physical device. Thank you, and we welcome your questions!"

---

## 3. Recommended 10-Slide Pitch Deck Structure

| Slide # | Slide Title | Visual Content / Key Takeaway |
|---|---|---|
| **Slide 1** | **Title Slide: CyberForge** | Project name, tagline ("Community Scam Map for India"), team members, Mitigata Hackathon logo. |
| **Slide 2** | **The Crisis: Cyber Fraud in India** | Statistics on digital arrest scams, UPI frauds, and fear of reporting due to PII leakage. |
| **Slide 3** | **The Core Dilemma: Sybil Attacks & Mob Defamation** | Why naive community voting fails: competitors weaponizing fake reports against innocent merchants. |
| **Slide 4** | **The CyberForge Solution: 3 Pillars** | Zero-PII Privacy (HMAC-SHA256), Anti-Sybil Graph Engine (Union-Find), and Protected Business Shield. |
| **Slide 5** | **System Architecture** | Four-tier diagram: React Web / Android APK $\to$ FastAPI ASGI $\to$ Business Logic Core $\to$ SQLite WAL. |
| **Slide 6** | **The Anti-Sybil Algorithm (Deep Dive)** | Diagram showing 7-signal pairwise correlation weights and Disjoint-Set collapsing 40 bots into 1 cluster. |
| **Slide 7** | **Privacy Masking & Neighborhood Scam Map** | Screenshots of masked lookups (`98XXXXX210`) and PIN code centroid map with CRIT/HIGH severity clusters. |
| **Slide 8** | **Dispute Recourse & Admin Adjudication** | Business challenge flow, automatic verdict capping, and immutable dispute audit log. |
| **Slide 9** | **Mobile Delivery & Production Verification** | Android APK specs (Target SDK 34, 4.57MB), local Wi-Fi sync, 128 backend tests, 21 frontend tests. |
| **Slide 10** | **Conclusion & Roadmap** | Summary of impact, future integration with telecom carrier STIR/SHAKEN headers, open Q&A. |

---

## 4. Live Hackathon Demonstration Checklist

Follow this exact sequence during the live presentation to guarantee an error-free, high-impact demonstration:

### Step 1: Prove System Health & Architecture (30 seconds)
1. Open web browser to `http://localhost:5173/#/check`.
2. Open terminal and show Uvicorn backend running on `0.0.0.0:8000` with passing health check:
   `curl http://localhost:8000/health` $\to$ `{"ok": true, "status": "healthy"}`.
3. Show the POV switcher in the top navigation bar demonstrating **Normal**, **Admin**, and **Demo** modes.

### Step 2: Demonstrate Anonymous Identifier Lookup & Masking (45 seconds)
1. In the **Check** tab, look up an unrecorded phone number (e.g. `9876543210`).
2. Show the result: `NO_REPORTS` badge, neutral green shield, display value masked as `98XXXXX210`.
3. Look up an official helpline: `1930` or `1909`.
4. Show the instant `VERIFIED_BUSINESS` badge with **Fraud Risk: ZERO (Protected Registry)**.

### Step 3: Demonstrate Real-Time Scam Reporting (45 seconds)
1. Switch to the **Report** tab (`/#/report`).
2. Enter a scam number (e.g., `+91 99887 76655`), select channel `Phone call`, category `digital-arrest`, pincode `560102` (HSR Layout), and enter a realistic victim narrative.
3. Click **Submit Report**.
4. Show the instantaneous 201 Created confirmation banner and the generated `report_id`.
5. Switch to the **Check** tab and re-query `+91 99887 76655`:
   - Show status is now `SUSPICIOUS` (1 reporter).
   - Show display value remains privacy-masked (`99XXXXX655`) to protect against single-report doxing.

### Step 4: Demonstrate Anti-Sybil Defense (Mass Report Attack) (60 seconds)
1. Switch to **Admin POV** and open the **Sybil & Mass Report Investigation** tab.
2. Show the multi-signal forensic panel displaying how reports are clustered.
3. Point out that even if 25 reports are submitted from the same subnet with identical screenshot hashes, the Union-Find engine displays `distinct_reporters: 1`.
4. Emphasize to the judges: *"Because distinct reporters is 1, the target never reaches KNOWN_SCAM status, defeating the attack entirely."*

### Step 5: Demonstrate Business Dispute Recourse (45 seconds)
1. Show the **Dispute Adjudication** tab in the Admin Console.
2. Demonstrate how a merchant who filed a challenge has their case labeled `Action Required (Under Review)`.
3. Click **Approve Dispute**. Enter justification: *"Verified GST and Trade License"*.
4. Show that the false report is immediately set to `QUARANTINED`, trust score is recalculated in real-time, and the action is permanently written to the **Decision Audit Log**.

### Step 6: Demonstrate Native Android Smartphone Execution (30 seconds)
1. Hold up the physical Android mobile phone.
2. Show the CyberForge native app running on Android 14.
3. Perform a live lookup or pan the Leaflet scam map on the physical touch screen, showing zero-lag local Wi-Fi synchronization with the laptop backend.

