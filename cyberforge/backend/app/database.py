import sqlite3
import os
from contextlib import contextmanager
from typing import Generator
from app.config import settings
from app.verified import APPENDIX_C_VERIFIED


def get_db_path() -> str:
    return os.environ.get("DATABASE_PATH", settings.DATABASE_PATH)


def init_db(db_path: str = None) -> None:
    path = db_path or get_db_path()
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    with conn:
        # 1. Cases Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS cases (
            identifier TEXT PRIMARY KEY,
            identifier_type TEXT NOT NULL,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            report_count INTEGER NOT NULL DEFAULT 0,
            distinct_reporters INTEGER NOT NULL DEFAULT 0,
            verdict TEXT NOT NULL DEFAULT 'NO_REPORTS',
            scam_type TEXT,
            primary_pincode TEXT,
            challenged INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        );
        """)

        # 2. Reports Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            identifier TEXT NOT NULL,
            identifier_type TEXT NOT NULL,
            channel TEXT,
            scam_type TEXT NOT NULL,
            occurred_at TEXT NOT NULL,
            reported_at TEXT,
            reporter_id TEXT,
            reporter_hmac TEXT NOT NULL,
            ip_prefix TEXT,
            ip_prefix_hmac TEXT NOT NULL,
            pincode TEXT,
            locality TEXT,
            city TEXT,
            note TEXT,
            note_fingerprint TEXT,
            has_screenshot INTEGER DEFAULT 0,
            amount_lost_inr REAL DEFAULT 0,
            loss_amount REAL DEFAULT 0,
            evidence_url TEXT,
            file_sha256 TEXT,
            phash TEXT,
            tx_ref_hmac TEXT,
            ocr_fingerprint TEXT,
            status TEXT NOT NULL DEFAULT 'ACCEPTED',
            created_at TEXT NOT NULL
        );
        """)

        # Schema migrations for reports
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(reports);")
        existing_cols = {row[1] for row in cur.fetchall()}
        new_cols = [
            ("channel", "TEXT"),
            ("category", "TEXT"),
            ("reported_at", "TEXT"),
            ("reporter_id", "TEXT"),
            ("ip_prefix", "TEXT"),
            ("locality", "TEXT"),
            ("city", "TEXT"),
            ("note", "TEXT"),
            ("has_screenshot", "INTEGER DEFAULT 0"),
            ("amount_lost_inr", "REAL DEFAULT 0"),
            ("file_sha256", "TEXT"),
            ("phash", "TEXT"),
            ("tx_ref_hmac", "TEXT"),
            ("ocr_fingerprint", "TEXT"),
            ("is_disputed", "INTEGER DEFAULT 0"),
            ("dispute_reason", "TEXT"),
            ("disputed_at", "TEXT"),
        ]
        for cname, ctype in new_cols:
            if cname not in existing_cols:
                conn.execute(f"ALTER TABLE reports ADD COLUMN {cname} {ctype};")

        # Indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_identifier ON reports(identifier);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_reporter_hmac ON reports(reporter_hmac);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_occurred_at ON reports(occurred_at);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_pincode ON reports(pincode);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_scam_type ON reports(scam_type);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_is_disputed ON reports(is_disputed);")

        # 3. Evidence Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS evidence (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            identifier TEXT NOT NULL,
            file_sha256 TEXT NOT NULL,
            phash TEXT,
            ocr_fingerprint TEXT,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_evidence_sha256 ON evidence(file_sha256);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_evidence_phash ON evidence(phash);")

        # 4. Transaction References Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS transaction_references (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            identifier TEXT NOT NULL,
            tx_ref_hmac TEXT NOT NULL,
            tx_type TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_ref_hmac_tab ON transaction_references(tx_ref_hmac);")

        # 5. Verified Businesses Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS verified_businesses (
            identifier TEXT PRIMARY KEY,
            identifier_type TEXT NOT NULL,
            business_name TEXT NOT NULL,
            category TEXT NOT NULL,
            raw_value TEXT,
            created_at TEXT NOT NULL
        );
        """)

        # 6. Challenges Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS challenges (
            id TEXT PRIMARY KEY,
            report_id TEXT,
            identifier TEXT NOT NULL,
            identifier_type TEXT,
            claimant_name TEXT,
            contact_email TEXT,
            proof_note TEXT,
            status TEXT NOT NULL DEFAULT 'under_review',
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            updated_at TEXT
        );
        """)
        cur.execute("PRAGMA table_info(challenges);")
        challenge_cols = {row[1] for row in cur.fetchall()}
        for cname, ctype in [("report_id", "TEXT"), ("updated_at", "TEXT")]:
            if cname not in challenge_cols:
                conn.execute(f"ALTER TABLE challenges ADD COLUMN {cname} {ctype};")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_challenges_identifier ON challenges(identifier);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_challenges_report_id ON challenges(report_id);")

        # 7. Alerts Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            identifier TEXT,
            pincode TEXT,
            scam_type TEXT,
            description TEXT,
            severity TEXT,
            window TEXT NOT NULL DEFAULT '24h',
            count INTEGER NOT NULL DEFAULT 0,
            baseline_per_day REAL,
            created_at TEXT NOT NULL
        );
        """)
        cur.execute("PRAGMA table_info(alerts);")
        existing_alert_cols = {row[1] for row in cur.fetchall()}
        for col_name, col_type in [
            ("identifier", "TEXT"),
            ("description", "TEXT"),
            ("severity", "TEXT"),
            ("window", "TEXT NOT NULL DEFAULT '24h'"),
            ("count", "INTEGER NOT NULL DEFAULT 0"),
            ("baseline_per_day", "REAL")
        ]:
            if col_name not in existing_alert_cols:
                conn.execute(f"ALTER TABLE alerts ADD COLUMN {col_name} {col_type};")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_pincode ON alerts(pincode);")

        # Seed Appendix C verified businesses
        for item in APPENDIX_C_VERIFIED:
            conn.execute(
                """
                INSERT OR REPLACE INTO verified_businesses (
                    identifier, identifier_type, business_name, category, raw_value, created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
                """,
                (item["normalized"], item["type"], item["belongs_to"], item["category"], item["raw"])
            )

    conn.close()


@contextmanager
def get_db_connection(db_path: str = None) -> Generator[sqlite3.Connection, None, None]:
    path = db_path or get_db_path()
    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
    finally:
        conn.close()
