# api/auth.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from .db import get_conn

SECRET = "dev-secret-change"  # TODO: move to .env
ALGO = "HS256"
ACCESS_MIN = 60 * 24
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["Auth"])


def _init_tables():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
        CREATE TABLE IF NOT EXISTS User (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'user'
        )"""
        )
        conn.commit()
    finally:
        conn.close()


_init_tables()


class RegisterRequest(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _create_token(sub: str, role: str = "user") -> str:
    now = datetime.utcnow()
    payload = {
        "sub": sub,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_MIN)).timestamp()),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


@router.post("/register", response_model=Token)
def register(req: RegisterRequest):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM User WHERE email=?", (req.email,))
        if cur.fetchone():
            raise HTTPException(400, "Email already registered")
        cur.execute(
            "INSERT INTO User(email,password_hash) VALUES(?,?)",
            (req.email, pwd.hash(req.password)),
        )
        conn.commit()
        token = _create_token(req.email, "user")
        return Token(access_token=token)
    finally:
        conn.close()


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT password_hash, role FROM User WHERE email=?", (form.username,)
        )
        row = cur.fetchone()
        if not row or not pwd.verify(form.password, row["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        return Token(access_token=_create_token(form.username, row["role"]))
    finally:
        conn.close()


class AbhaLogin(BaseModel):
    abha_id: str
    mode: str  # "doctor" or "patient"


@router.post("/abha-login", response_model=Token)
def abha_login(req: AbhaLogin):
    if req.mode not in ("doctor", "patient"):
        raise HTTPException(400, "mode must be 'doctor' or 'patient'")
    return Token(access_token=_create_token(sub=f"abha:{req.abha_id}", role=req.mode))