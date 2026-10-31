# CyberForge — Community Scam Map for India

Report and verify scams in seconds, anonymously.

## Repository Overview

- **Backend (`backend/` and `cyberforge/backend/`):**
  - FastAPI application with SQLite database
  - Identifier normalization (Indian Mobile, Helplines 1930/1909, 1800/1860 toll-free, Landlines with STD, UPI IDs, URLs, SMS Sender IDs)
  - Privacy-preserving architecture (zero storage of raw reporter identities, raw IPs, or raw incident text)
  - Anti-Sybil Trust Engine with Union-Find disjoint-set clustering (tested against all 4 PRD attack vectors)
  - Complete PRD Appendix B (all 25 areas with coordinates) and Appendix C (all 19 verified entities)
  - Evidence analysis: SHA-256 deduplication, Perceptual Hashing (pHash), OCR text normalization, and Transaction Reference matching
  - 100% test coverage with 61 unit, integration, and attack simulation tests passing

- **Frontend (`cyberforge/frontend/`):**
  - Mobile-first React + Vite + Tailwind CSS interface (Developer B)

## Backend Quickstart & Tests

```bash
# Navigate to backend directory
cd cyberforge/backend
# or: cd backend

# Install dependencies
pip install -r requirements.txt

# Run all 61 tests
pytest tests -v

# Run the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
