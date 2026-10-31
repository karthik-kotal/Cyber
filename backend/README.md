# CyberForge Backend — Community Scam Map for India

Backend API, Database, Privacy Layer, and Anti-Sybil Trust Engine for anonymous scam reporting in India.

## Features Built

- **FastAPI Backend:** Clean modular architecture with Pydantic v2 schemas and deterministic normalization.
- **Privacy Layer:** Zero storage of raw reporter identifiers, IP addresses, or unhashed incident descriptions (HMAC-SHA256 hashed).
- **Identifier Normalization:** Full support for Indian mobile formats (`+91`, `0`, spaces, dashes), toll-free numbers (`1800`), helplines (`1930`, `112`), landlines with STD codes, UPI IDs (`@bank`), URLs, Emails, and bank account identifiers.
- **Anti-Sybil Trust Engine:** Disjoint-set clustering collapsing duplicate reporters, identical copy-pasted notes, IP subnets, and burst submissions.
- **Dynamic Masking & Unmasking:** Identifiers remain masked (`+91 98765 XXXXX`) until verified by $\ge 3$ independent distinct reporters.
- **Dispute & Challenge Engine:** Active challenges cap community verdicts at `SUSPICIOUS` and flag cases for review.
- **Real-Time Alert Engine:** Detects `SPIKE` surges in 24h windows and `NEW_TYPE` emerging scams per PIN code.
- **Verified Business Registry:** Seeded with national emergency numbers (`1930`, `112`) and official bank customer care lines that can never be poisoned into scams.
- **Admin Reset:** Protected route for test harnesses and database resets.

## Running Tests

```bash
$env:PYTHONPATH="C:\Users\Acer\.gemini\antigravity\scratch\cyberforge\backend"
python -m pytest tests -v
```
All 27 unit, integration, and attack simulation tests pass.

