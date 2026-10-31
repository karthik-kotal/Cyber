# CyberForge — Forensic Investigation Report: 40 Bakery Reports

**Document:** `docs/CYBERFORGE_BAKERY_INVESTIGATION.md`  
**Investigation Target:** Alleged coordinated mass-reporting against a verified local bakery  
**Investigated Databases:** `E:\cyber\backend\cyberforge.db`, `E:\cyber\backend\cyberforge_demo.db`  
**Code Reference:** `backend/app/verified.py`, `backend/app/trust_engine.py`, `backend/tests/test_prd_audit.py`  
**Date of Audit:** November 1, 2026  

---

## 1. Executive Summary

An investigation was conducted into the reported pattern of approximately 40 members reporting the same local bakery. 

The investigation determined that:
1. **The Business Exists as an Official Verified Business:** The entity is **Fresh Bakes, Indiranagar (made up)**, registered with phone number `+91 80 4100 2233` (`+918041002233`) and UPI ID `freshbakes@okaxis`.
2. **Actual Persistent Database Count:** The production database (`cyberforge.db`) currently holds **0 persistent reports** against Fresh Bakes.
3. **Origin of the 40 Reports:** The 40 reports were submitted in an adversarial test scenario (`test_attack_1_forty_friends_reporting_real_bakery` in `backend/tests/test_prd_audit.py`) within an isolated test fixture to verify anti-extortion protections.
4. **Trust Engine Behavior:** When 40 reports are submitted against Fresh Bakes, CyberForge's trust engine recognizes the registered business in `APPENDIX_C_VERIFIED` / `verified_businesses` table. The verdict remains strictly `VERIFIED_BUSINESS`.
5. **No Defamation or Alert Spikes:** High report volume does **not** override verified status, and verified businesses are immune to automated scam alerts.

---

## 2. Entity Identification & Metadata

| Field | Registered Value in Database |
| :--- | :--- |
| **Business Name** | Fresh Bakes, Indiranagar (made up) |
| **Normalized Phone Identifier** | `+918041002233` |
| **Raw Display Identifier** | `+91 80 4100 2233` |
| **Secondary Identifier (UPI)** | `freshbakes@okaxis` |
| **Category** | `LOCAL_BUSINESS` |
| **Area / Locality** | Indiranagar, Bengaluru |
| **Pincode** | `560038` |
| **Geographic Centroid (Appendix B)** | Latitude `12.9784`, Longitude `77.6408` |
| **Database Table** | `verified_businesses` (Primary Key: `identifier`) |

---

## 3. Database Investigation Findings

Direct SQL inspection of both `cyberforge.db` (production) and `cyberforge_demo.db` (demo sandbox) yielded the following results:

```sql
SELECT count(*) FROM reports WHERE identifier LIKE '%41002233%' OR identifier LIKE '%Fresh%';
-- Result: 0 rows in cyberforge.db
-- Result: 0 rows in cyberforge_demo.db

SELECT identifier, business_name, category, raw_value FROM verified_businesses WHERE identifier LIKE '%41002233%';
-- Result: ('+918041002233', 'Fresh Bakes, Indiranagar (made up)', 'LOCAL_BUSINESS', '+91 80 4100 2233')
```

### Analysis of the 40-Report Attack Scenario
In `backend/tests/test_prd_audit.py`, lines 17–33:
- **Test Name:** `test_attack_1_forty_friends_reporting_real_bakery`
- **Simulation:** 40 simulated accounts (`friend_0` to `friend_39`) from 40 different IP subnets (`49.207.0.0` through `49.207.39.0`) submit reports in the Indiranagar pincode (`560038`) with notes like `"Fake defamation note 0"`, accusing the bakery of a `"digital-arrest"` scam.
- **Time Window:** Rapid sequential submission within 1 second.
- **Evaluation:** The trust engine evaluates `is_verified` against `verified_businesses`. 
- **Observed Result:**
  - `lookup.verdict == "VERIFIED_BUSINESS"`
  - `lookup.distinct_reporters == 0` (non-scam entity)
  - `lookup.display_value == "+91 80 4100 2233"` (unmasked official name displayed)

---

## 4. Evaluation of Technical Indicators

| Indicator | Finding | Significance |
| :--- | :--- | :--- |
| **Report Count** | 0 persistent / 40 in test harness | Report volume alone never determines guilt. |
| **Unique Reporter IDs** | 40 synthetic accounts (`friend_i`) | Simulated sybil group attempting crowd defamation. |
| **IP Addresses** | Distributed (`49.207.i.0`) | Demonstrates that even IP rotation cannot overcome business protection. |
| **Description Similarity** | High similarity (`"Fake defamation note {i}"`) | Coordinated attack pattern. |
| **Evidence Images** | None attached | Unsubstantiated claims. |
| **Duplicate Image Hashes**| N/A | No screenshots submitted. |
| **Alert Generation** | 0 alerts generated | `alert_engine.py` explicitly skips verified business identifiers. |

---

## 5. Trust Engine & Verdict Logic

1. **Pre-Evaluation Check (`backend/app/trust_engine.py`):**
   ```python
   if is_verified:
       return "VERIFIED_BUSINESS", 0, normalized_value, evidence_summary
   ```
2. **Public API Contract (`backend/app/routes/lookup.py`):**
   - Returns HTTP 200 with `verdict: "VERIFIED_BUSINESS"`.
   - Never exposes reporter identities, reporter IP prefixes, or malicious defamation notes.
   - Evidence section provides verified business badge and category (`LOCAL_BUSINESS`).
3. **Alert Immunity (`backend/app/alert_engine.py`):**
   - Verified businesses cannot trigger spike alerts or new scam category alerts, preventing coordinated review bombs from causing public panic.

---

## 6. Conclusion & Limitations

### Final Verdict: `INCONCLUSIVE AS SCAM / CONFIRMED COORDINATED TEST HARNESS`
- The bakery is **not a scam**. It is a verified authentic local business protected by Appendix C.
- The 40 reports were not an active live consumer event but an automated security verification test designed to confirm that CyberForge successfully stops fake reports and extortion attacks.

### Limitations & Honest Disclosure:
- **Protection Scope:** Pre-registration protects against frivolous community mobbing. If a verified business account is compromised or legitimately involved in fraud, removal from the `verified_businesses` registry requires administrator action (`DELETE /api/admin/verified-businesses/{id}`).
- **Privacy Assurance:** Public responses never reveal who submitted reports or their IP addresses.
