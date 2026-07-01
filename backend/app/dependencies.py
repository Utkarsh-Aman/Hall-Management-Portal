"""
FastAPI dependencies — database session, authentication, role guards, rate limiting.
"""

import time as time_mod
from collections import defaultdict
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.services.auth_service import decode_token


# ---------------------------------------------------------------------------
# Database session
# ---------------------------------------------------------------------------

def get_db():
    """Yield a SQLAlchemy session, ensuring it's closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Authentication — extract user from JWT
# ---------------------------------------------------------------------------

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Extract Bearer token from the Authorization header, decode it,
    and return the corresponding User object. Raises 401 if invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header.",
        )

    token = auth_header.split(" ", 1)[1]
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject.",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    return user


# Type alias for cleaner route signatures
CurrentUser = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Role-based access control
# ---------------------------------------------------------------------------

def require_role(*allowed_roles: str):
    """
    Returns a dependency that checks the current user's role.

    Usage:
        @router.get("/staff/items", dependencies=[Depends(require_role("mess_staff"))])
    Or:
        def endpoint(user: User = Depends(require_role("mess_staff"))):
    """

    def _role_checker(current_user: CurrentUser) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}.",
            )
        return current_user

    return _role_checker


# ---------------------------------------------------------------------------
# Rate limiting (in-memory — single-process MVP)
# ---------------------------------------------------------------------------
# Structure: { key: [(timestamp, ...)] }
# For production, swap to Redis-based rate limiting.

_rate_limit_store: dict[str, list[float]] = defaultdict(list)


def _cleanup_old_entries(key: str, window_seconds: int) -> None:
    """Remove entries older than the window."""
    cutoff = time_mod.time() - window_seconds
    _rate_limit_store[key] = [
        t for t in _rate_limit_store[key] if t > cutoff
    ]


def check_otp_rate_limit(email: str) -> None:
    """
    Max 3 OTP requests per email per 15 minutes.
    Raises 429 if exceeded.
    """
    key = f"otp:{email}"
    window = 15 * 60  # 15 minutes

    _cleanup_old_entries(key, window)

    if len(_rate_limit_store[key]) >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please wait 15 minutes.",
        )

    _rate_limit_store[key].append(time_mod.time())


def check_login_rate_limit(identifier: str) -> None:
    """
    Max 5 failed login attempts per identifier per 15 minutes.
    Raises 429 if exceeded.
    """
    key = f"login:{identifier}"
    window = 15 * 60

    _cleanup_old_entries(key, window)

    if len(_rate_limit_store[key]) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Account locked for 15 minutes.",
        )


def record_failed_login(identifier: str) -> None:
    """Record a failed login attempt for rate limiting."""
    key = f"login:{identifier}"
    _rate_limit_store[key].append(time_mod.time())


def clear_login_attempts(identifier: str) -> None:
    """Clear failed login attempts after a successful login."""
    key = f"login:{identifier}"
    _rate_limit_store.pop(key, None)
