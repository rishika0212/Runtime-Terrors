# scripts/migrate_patient_form.py
"""
Create/upgrade auth and patient form tables in db/terminology.db (SQLite).
- User: email/password_hash/role (kept compatible with api/auth.py)
- PatientForm: minimal fields for doctor-filled patient form

Run:
  python scripts/migrate_patient_form.py

This script is idempotent and safe to run multiple times.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "db" / "terminology.db"


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def ensure_user_table(conn: sqlite3.Connection) -> None:
    # Mirror api/auth.py defaults; avoid changing existing constraints
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS User (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # Add created_at if missing (useful for auditing)
    if not column_exists(conn, "User", "created_at"):
        # SQLite cannot add a column with a non-constant default; add column, backfill, then trigger
        conn.execute("ALTER TABLE User ADD COLUMN created_at DATETIME")
        conn.execute("UPDATE User SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL")
    # Ensure inserts set created_at automatically when not provided
    conn.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_user_created_at
        AFTER INSERT ON User
        FOR EACH ROW
        WHEN NEW.created_at IS NULL
        BEGIN
            UPDATE User SET created_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        """
    )


def ensure_patient_form_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS PatientForm (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_user_id INTEGER NULL,
            abha_id TEXT NULL,
            patient_name TEXT NOT NULL,
            age INTEGER NULL,
            sex TEXT NULL,
            contact TEXT NULL,
            symptoms TEXT NULL,
            diagnosis TEXT NULL,
            icd_system TEXT NULL DEFAULT 'ICD-11',
            icd_code TEXT NULL,
            notes TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doctor_user_id) REFERENCES User(id) ON DELETE SET NULL
        )
        """
    )
    # Helpful indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_patientform_doctor ON PatientForm(doctor_user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_patientform_icd ON PatientForm(icd_system, icd_code)")

    # Update trigger for updated_at
    conn.execute(
        """
        CREATE TRIGGER IF NOT EXISTS trg_patientform_updated
        AFTER UPDATE ON PatientForm
        FOR EACH ROW
        BEGIN
            UPDATE PatientForm SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;
        """
    )


def ensure_doctor_abha_column(conn: sqlite3.Connection) -> None:
    """Add doctor_abha_id column and index for ABHA doctor ownership if missing."""
    if not column_exists(conn, "PatientForm", "doctor_abha_id"):
        conn.execute("ALTER TABLE PatientForm ADD COLUMN doctor_abha_id TEXT NULL")
    # Index for quick filtering on ABHA doctor
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_patientform_doctor_abha ON PatientForm(doctor_abha_id)"
    )


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found at {DB_PATH}. Make sure terminology.db exists.")
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        ensure_user_table(conn)
        ensure_patient_form_table(conn)
        ensure_doctor_abha_column(conn)
        conn.commit()
        # Quick summary
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('User','PatientForm')")
        have = cur.fetchone()[0]
        print(f"✅ Migration complete. Tables present: {have}/2 (User, PatientForm)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()