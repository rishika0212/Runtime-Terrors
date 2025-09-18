# api/migrations.py
from __future__ import annotations

import sqlite3
from pathlib import Path

from .db import DB_PATH

def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def run() -> None:
    if not Path(DB_PATH).exists():
        # Let api/db.py raise a clear error when first accessed
        return
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute("PRAGMA foreign_keys=ON;")
        # User table (aligned with api/auth.py)
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
        if not _column_exists(conn, "User", "created_at"):
            conn.execute("ALTER TABLE User ADD COLUMN created_at DATETIME")
            conn.execute(
                "UPDATE User SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL"
            )
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

        # PatientForm table
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS PatientForm (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_user_id INTEGER NULL,
                doctor_abha_id TEXT NULL,
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
        # Add doctor_abha_id if missing (older DBs)
        if not _column_exists(conn, "PatientForm", "doctor_abha_id"):
            conn.execute("ALTER TABLE PatientForm ADD COLUMN doctor_abha_id TEXT NULL")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_patientform_doctor ON PatientForm(doctor_user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_patientform_doctor_abha ON PatientForm(doctor_abha_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_patientform_icd ON PatientForm(icd_system, icd_code)")
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

        conn.commit()
    finally:
        conn.close()