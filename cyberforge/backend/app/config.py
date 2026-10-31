import os
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "Community Scam Map for India"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Secret key for HMAC privacy hashing of reporter identifiers and transaction references
    HMAC_SECRET: str = os.getenv("HMAC_SECRET", "dev-cyberforge-insecure-hmac-secret-do-not-use-in-prod")

    # SQLite DB paths (Production and Demo Sandbox)
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "cyberforge.db")
    DEMO_DATABASE_PATH: str = os.getenv("DEMO_DATABASE_PATH", "cyberforge_demo.db")

    # Trust Engine thresholds
    KNOWN_SCAM_MIN_SOURCES: int = int(os.getenv("KNOWN_SCAM_MIN_SOURCES", "3"))

    # Alert thresholds
    SPIKE_WINDOW_HOURS: int = int(os.getenv("SPIKE_WINDOW_HOURS", "24"))
    SPIKE_BASELINE_DAYS: int = int(os.getenv("SPIKE_BASELINE_DAYS", "7"))
    SPIKE_REPORT_THRESHOLD: int = int(os.getenv("SPIKE_REPORT_THRESHOLD", "3"))

    # Administrator security
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "CyberForgeAdmin2026!")
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "cyberforge-admin-secret-token-2026")
    DEMO_ADMIN_TOKEN: str = os.getenv("DEMO_ADMIN_TOKEN", "cyberforge-demo-token-2026")

    # Evidence Analysis & Similarity Configurations
    MAX_EVIDENCE_SIZE_BYTES: int = int(os.getenv("MAX_EVIDENCE_SIZE_BYTES", str(10 * 1024 * 1024)))  # 10 MB
    PHASH_MAX_HAMMING_DISTANCE: int = int(os.getenv("PHASH_MAX_HAMMING_DISTANCE", "10"))
    ENABLE_OCR: bool = os.getenv("ENABLE_OCR", "true").lower() in ("true", "1", "yes")
    OCR_SIMILARITY_THRESHOLD: float = float(os.getenv("OCR_SIMILARITY_THRESHOLD", "0.85"))
    SIMILARITY_COLLAPSE_THRESHOLD: float = float(os.getenv("SIMILARITY_COLLAPSE_THRESHOLD", "0.65"))


settings = Settings()
