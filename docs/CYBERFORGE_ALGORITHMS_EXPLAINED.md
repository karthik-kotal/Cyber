# CyberForge — Core Algorithms & Mathematical Formulations
*Comprehensive Algorithmic Reference for Judges and Technical Evaluators*

---

## 1. Multi-Signal Anti-Sybil Clustering (Union-Find)

### 1.1. Purpose & Problem Definition
In community-sourced fraud detection platforms, a classic attack vector is **Sybil flooding**: an attacker uses automated scripts, multiple SIM cards, or spoofed browser sessions to submit 40 or 50 fake scam reports against an innocent merchant. A naive voting engine would see 40 reports and classify the merchant as a `KNOWN_SCAM`.

CyberForge prevents this by calculating pairwise correlation across multiple independent signals and grouping correlated reports into **connected components** using the **Disjoint-Set Union-Find** algorithm.

### 1.2. The Pairwise Correlation Scoring Model (`similarity.py`)
For every pair of reports $R_i$ and $R_j$ submitted against the same identifier, CyberForge calculates a similarity weight:

$$\text{Similarity}(R_i, R_j) = \sum_{k=1}^{7} w_k \cdot \mathbb{I}(\text{Signal}_k)$$

Where the signals and weights $w_k$ are defined as:
1. **Identical Reporter Token** ($w_1 = 0.40$): $\text{HMAC}(R_i.\text{reporter}) == \text{HMAC}(R_j.\text{reporter})$
2. **Identical Screenshot File Hash** ($w_2 = 0.35$): $\text{SHA256}(R_i.\text{file}) == \text{SHA256}(R_j.\text{file})$
3. **Identical Transaction Reference** ($w_3 = 0.30$): $\text{HMAC}(R_i.\text{tx\_ref}) == \text{HMAC}(R_j.\text{tx\_ref})$
4. **Perceptual Image Hash Match** ($w_4 = 0.25$): $\text{HammingDistance}(R_i.\text{pHash}, R_j.\text{pHash}) \le 10$
5. **Identical Text Description Fingerprint** ($w_5 = 0.20$): $\text{SHA256}(\text{normalize}(R_i.\text{note})) == \text{SHA256}(\text{normalize}(R_j.\text{note}))$
6. **Same Subnet IP Prefix** ($w_6 = 0.10$): $\text{HMAC}(R_i.\text{ip\_subnet}) == \text{HMAC}(R_j.\text{ip\_subnet})$
7. **Burst Temporal Proximity** ($w_7 = 0.10$): $|R_i.\text{time} - R_j.\text{time}| < 10 \text{ minutes}$

**Edge Threshold Rule**: An undirected edge is established between report $i$ and report $j$ if:
$$\text{Similarity}(R_i, R_j) \ge 0.50 \quad \lor \quad R_i.\text{reporter\_hmac} == R_j.\text{reporter\_hmac}$$

### 1.3. Disjoint-Set Union-Find Implementation (`trust_engine.py`)
Once pairwise edges are constructed, CyberForge initializes a Disjoint-Set forest where every report is initially its own parent:
```python
parent = {i: i for i in range(len(reports))}

def find(i: int) -> int:
    if parent[i] == i:
        return i
    parent[i] = find(parent[i])  # Path compression
    return parent[i]

def union(i: int, j: int):
    root_i = find(i)
    root_j = find(j)
    if root_i != root_j:
        parent[root_i] = root_j
```

### 1.4. Complexity & Theoretical Analysis
- **Pairwise Comparison**: $O(N^2)$ where $N$ is the number of reports for a single identifier (typically $N < 100$ in practical cases).
- **Union-Find with Path Compression**: $O(M \cdot \alpha(N))$, where $\alpha$ is the Inverse Ackermann function (effectively constant, $\alpha(N) < 5$ for all physical universe inputs).
- **Total Time Complexity**: $O(N^2 \cdot K)$ where $K$ is the number of features compared. Execution time for 40 reports is less than 3 milliseconds on standard CPUs.

### 1.5. Real-World Attack Scenario Example
- **Attack**: A rogue competitor submits 40 fake reports against a local bakery. The attacker changes their simulated device ID every time, but re-uses the same fake screenshot (or submits from the same local Wi-Fi router `/24` subnet within an 8-minute window with identical copy-pasted text).
- **Evaluation**:
  - File Hash match ($+0.35$) + Same Subnet ($+0.10$) + Burst Time ($+0.10$) = **0.55** ($\ge 0.50$).
  - Edge is created between every bot report.
  - Union-Find merges all 40 reports into a single cluster.
- **Outcome**: `distinct_reporters = 1`. Because $1 < 3$, the target never reaches `KNOWN_SCAM`!

---

## 2. Perceptual Image Hashing (pHash with DCT)

### 2.1. Purpose & Vulnerability Addressed
Cryptographic hashes like SHA-256 are brittle: if an attacker modifies a single pixel, recompresses a screenshot from JPEG to PNG, or strips EXIF metadata, the SHA-256 hash completely changes. Perceptual Hashing (pHash) generates a hash based on the frequency characteristics of an image, making it invariant to resizing, compression artifacts, and minor color shifts.

### 2.2. Algorithmic Steps (`app/evidence/phash.py`)
1. **Grayscale Conversion**: Reduces 24-bit RGB or 32-bit RGBA image to 8-bit luminance.
2. **Fixed Resizing**: Downscales image to $32 \times 32$ pixels.
3. **Discrete Cosine Transform (DCT)**: Transforms spatial pixel intensities into the frequency domain:
   $$F(u, v) = \frac{1}{4} C(u) C(v) \sum_{x=0}^{31} \sum_{y=0}^{31} f(x, y) \cos\left[\frac{(2x+1)u\pi}{64}\right] \cos\left[\frac{(2y+1)v\pi}{64}\right]$$
4. **Low-Frequency Extraction**: Extracts the top-left $8 \times 8$ matrix representing the fundamental structural frequencies of the image (omitting the $(0,0)$ DC term).
5. **Median Thresholding**: Calculates the median value of the 64 coefficients. Sets each bit to `1` if greater than the median, and `0` otherwise.
6. **Bit Packing**: Packs the 64 bits into a 16-character hexadecimal string.

### 2.3. Hamming Distance Comparison
Two evidence screenshots are considered visually identical or near-duplicates if the Hamming distance (number of differing bits) between their 64-bit pHashes is $\le 10$:
$$\text{HammingDistance}(H_1, H_2) = \text{popcount}(H_1 \oplus H_2) \le 10$$

---

## 3. Zero-PII Privacy Preservation (HMAC-SHA256)

### 3.1. Purpose & Threat Model
Indian citizens hesitate to report cybercrime due to privacy concerns: corrupt actors might discover who reported them, or a database leak might expose victims to harassment.

### 3.2. Cryptographic Formulation (`app/privacy.py`)
CyberForge never stores raw reporter contact information or full client IP addresses:

1. **Reporter ID Hashing**:
   $$\text{ReporterHMAC} = \text{HMAC-SHA256}(K, \text{reporter\_id})$$
   Where $K$ is the server-side environment secret (`settings.HMAC_SECRET`). Even if the reporter supplies a raw phone number or UUID, it is irreversibly hashed.
   
2. **Subnet Masking & Hashing**:
   - For IPv4: Masks the host bits to zero, isolating the `/24` network prefix (e.g., `103.21.58.112` $\to$ `103.21.58.0`).
   - For IPv6: Masks to `/48` prefix.
   - Computes:
     $$\text{SubnetHMAC} = \text{HMAC-SHA256}(K, \text{SubnetAddress})$$
   This guarantees that two reports from the same internet cafe or bot office yield the same subnet HMAC, but zero knowledge of the actual client host machine is preserved.

3. **Deterministic Note Fingerprinting**:
   $$\text{NoteFingerprint} = \text{SHA256}(\text{collapse\_whitespace}(\text{strip\_punctuation}(\text{lowercase}(\text{note}))))$$
   Permits instantaneous $O(1)$ detection of coordinated copy-paste harassment scripts across different reporter tokens.

---

## 4. Deterministic Input Normalization (`normalize.py`)

### 4.1. Indian Mobile Number Canonicalization
- **Rule**: Strips all non-digit characters (`+`, `-`, `(`, `)`, spaces, dots).
- **Prefix Handling**:
  - If starts with `+91` or `91` followed by 10 digits: strips `91`.
  - If starts with leading `0` followed by 10 digits: strips `0`.
- **Validation**: Enforces Indian mobile regex: `^[6-9]\d{9}$`.
- **Canonical Storage**: Stores as E.164 format: `+91` followed by the 10 digits (e.g. `+919876543210`).
- **Shortcodes & Helplines**: Dedicated regex whitelist for national helplines: `^(1930|1909|112|100|101|102|108|1091|1075|1098|1902|139|155260)$`. Toll-free numbers: `^(1800|1860)\d{4,8}$`.

### 4.2. UPI ID Normalization
- **Rule**: Matches NPCI specification `^[a-zA-Z0-9.\-_]{2,50}@[a-zA-Z0-9.\-_]{2,30}$`.
- Lowercases handle and PSP handle (e.g., `Victim.Pay@SBI` $\to$ `victim.pay@sbi`).

### 4.3. URL Canonicalization & Tracking Stripping
- **Protocol**: Strips redundant `http://` or `https://` schemes and trailing slashes.
- **Tracking Parameter Sanitization**: Parses query string and strips all surveillance and affiliate tokens:
  `{"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref", "_hsenc", "mc_cid", "igshid", "si"}`.
- Re-encodes cleaned parameters in sorted alphabetical order to guarantee identical query hashes.

---

## 5. Geospatial Centroid & Radius Filtering (Haversine Formula)

### 5.1. Centroid Resolution (`areas.py`)
To prevent exposing victim home addresses, CyberForge anchors all geographic operations to official 6-digit postal PIN code centroids. A pre-compiled geospatial dictionary maps Indian postal codes to exact centroid coordinates (e.g. `560102` $\to$ `lat: 12.9116, lng: 77.6473`, `560069` $\to$ `lat: 12.9174, lng: 77.5855`).

### 5.2. Spherical Distance Formula
When querying `GET /map?pincode=P&radius_km=R`, the distance between center pincode $(lat_1, lon_1)$ and target cluster $(lat_2, lon_2)$ is computed via the Haversine formula:

$$\Delta\phi = \frac{(lat_2 - lat_1) \cdot \pi}{180}, \quad \Delta\lambda = \frac{(lon_2 - lon_1) \cdot \pi}{180}$$

$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\left(\frac{lat_1 \cdot \pi}{180}\right) \cdot \cos\left(\frac{lat_2 \cdot \pi}{180}\right) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$

$$d = 2 \cdot R_{\text{earth}} \cdot \arcsin\left(\sqrt{a}\right) \quad \text{where } R_{\text{earth}} = 6371.0 \text{ km}$$

If $d \le \text{radius\_km}$, the cluster is returned in the response array.

---

## 6. Real-Time Area Alert Engine (`alert_engine.py`)

### 6.1. SPIKE Detection Algorithm
- **Condition**: Triggers when reports in the last 24 hours for a specific PIN code spike significantly above background baseline:
  $$\text{Count}_{24\text{h}} \ge 2.0 \times \text{BaselinePerDay}_{7\text{d}} \quad \text{and} \quad \text{Count}_{24\text{h}} \ge 5$$
- **Anti-Spam Corroboration**: Requires $\text{DistinctReporters}_{24\text{h}} \ge 2$ to ensure a single disgruntled actor cannot fabricate an artificial community panic alert.
- **De-duplication**: Suppresses multiple alerts for the same PIN code within the same 24-hour sliding window.

### 6.2. NEW_TYPE Emerging Threat Detection
- **Condition**: Triggers when a scam category (e.g. `digital-arrest`) is reported in a PIN code within the last 24 hours, but was completely absent from reports in that PIN code during the preceding 30 days:
  $$\text{Count}(\text{category}, \text{pincode}, \text{window}=24\text{h}) \ge 1 \quad \land \quad \text{Count}(\text{category}, \text{pincode}, \text{window}=30\text{d} \setminus 24\text{h}) == 0$$
- Gives neighborhood residents immediate early warning when a new modus operandi migrates into their district.

