"""
Authentication service — JWT token creation/verification, password hashing, OTP generation.
"""

import secrets
import string
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings


# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

def create_access_token(user_id: int, role: str) -> str:
    """Create a short-lived access token (15 min by default)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int, role: str) -> str:
    """Create a longer-lived refresh token (7 days by default)."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_signup_token(email: str) -> str:
    """Short-lived token (10 min) used between OTP verification and password set."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "email": email,
        "exp": expire,
        "type": "signup",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_change_password_token(user_id: int) -> str:
    """Short-lived token (10 min) for forced password change flow."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "change_password",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload dict or None if invalid."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# OTP generation
# ---------------------------------------------------------------------------

def generate_otp() -> str:
    """Generate a random 6-digit numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(6))


# ---------------------------------------------------------------------------
# Temporary password generation (for staff accounts)
# ---------------------------------------------------------------------------

def generate_temp_password() -> str:
    """Generate a strong 16-character random password."""
    return secrets.token_urlsafe(12)
