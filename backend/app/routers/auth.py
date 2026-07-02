"""
Auth router — signup (OTP flow), login, refresh, logout, forced password change.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session

from app.dependencies import (
    check_login_rate_limit,
    check_otp_rate_limit,
    clear_login_attempts,
    get_db,
    record_failed_login,
)
from app.models.allowed_roll import AllowedRollNumber
from app.models.user import User, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    MustChangePasswordResponse,
    RefreshResponse,
    RequestOTPRequest,
    RequestOTPResponse,
    SetPasswordRequest,
    UserBrief,
    VerifyOTPRequest,
    VerifyOTPResponse,
)
from app.services.auth_service import (
    create_access_token,
    create_change_password_token,
    create_refresh_token,
    create_signup_token,
    decode_token,
    generate_otp,
    hash_password,
    verify_password,
)
from app.services.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Student signup — Step 1: Request OTP
# ---------------------------------------------------------------------------

@router.post("/signup/request-otp", response_model=RequestOTPResponse)
def request_otp(body: RequestOTPRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    # Check email is allowed
    allowed = (
        db.query(AllowedRollNumber)
        .filter(AllowedRollNumber.email == email)
        .first()
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email isn't recognized. Contact the hall office to be added.",
        )

    # Check if user already exists with this email and has set password
    existing = db.query(User).filter(User.identifier == email).first()
    if existing and existing.password_set:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in.",
        )

    # Rate limit
    check_otp_rate_limit(email)

    # Generate OTP
    otp = generate_otp()
    otp_hash = hash_password(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    if existing:
        # Update existing pending user
        existing.otp_hash = otp_hash
        existing.otp_expires_at = expires_at
        existing.otp_attempts = 0
    else:
        # Create a pending user (password_set=False)
        user = User(
            identifier=email,
            email=email,
            password_hash="",  # Not set yet
            role=UserRole.student,
            name=allowed.name or email.split("@")[0],  # Temporary or prefilled name
            is_active=True,
            otp_hash=otp_hash,
            otp_expires_at=expires_at,
            otp_attempts=0,
            password_set=False,
            must_change_password=False,
        )
        db.add(user)

    db.commit()

    # Send OTP via email (console in dev)
    send_otp_email(email, otp)

    return RequestOTPResponse()


# ---------------------------------------------------------------------------
# Student signup — Step 2: Verify OTP
# ---------------------------------------------------------------------------

@router.post("/signup/verify-otp", response_model=VerifyOTPResponse)
def verify_otp(body: VerifyOTPRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    user = db.query(User).filter(User.identifier == email).first()
    if not user or user.password_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending signup found for this email.",
        )

    # Check expiry
    if not user.otp_expires_at or datetime.now(timezone.utc).replace(tzinfo=None) > user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one.",
        )

    # Check max attempts
    if user.otp_attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please request a new OTP.",
        )

    # Verify OTP
    if not verify_password(body.otp, user.otp_hash):
        user.otp_attempts += 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP. Please try again.",
        )

    # OTP is valid — generate signup token
    signup_token = create_signup_token(email)

    # Clear OTP fields
    user.otp_hash = None
    user.otp_expires_at = None
    # Fetch prefill info from AllowedRollNumber if available
    allowed = db.query(AllowedRollNumber).filter(AllowedRollNumber.email == email).first()

    return VerifyOTPResponse(
        signup_token=signup_token,
        name=allowed.name if allowed else None,
        room_no=allowed.room_number if allowed else None,
        roll_no=allowed.roll_no if allowed else None,
    )


# ---------------------------------------------------------------------------
# Student signup — Step 3: Set password
# ---------------------------------------------------------------------------

@router.post("/signup/set-password", response_model=LoginResponse)
def set_password(body: SetPasswordRequest, response: Response, db: Session = Depends(get_db)):
    # Decode the signup token
    payload = decode_token(body.signup_token)
    if not payload or payload.get("type") != "signup":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired signup token.",
        )

    email = payload.get("email")
    user = db.query(User).filter(User.identifier == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found.",
        )

    if user.password_set:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password already set. Please log in.",
        )

    # Set password, name, room_no, and roll_no
    user.password_hash = hash_password(body.password)
    user.password_set = True
    user.name = body.name
    user.room_no = body.room_no
    user.roll_no = body.roll_no
    db.commit()

    # Issue tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

    # Set refresh token as httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/",
    )

    return LoginResponse(
        access_token=access_token,
        user=UserBrief(
            id=user.id,
            identifier=user.identifier,
            name=user.name,
            role=user.role.value,
            email=user.email,
            roll_no=user.roll_no,
            room_no=user.room_no,
        ),
    )


# ---------------------------------------------------------------------------
# Login (all roles)
# ---------------------------------------------------------------------------

@router.post("/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    identifier = body.identifier.strip()

    # Rate limit check
    check_login_rate_limit(identifier)

    user = db.query(User).filter(User.identifier == identifier).first()

    if not user:
        record_failed_login(identifier)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact the hall office.",
        )

    if not user.password_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account setup is incomplete. Please complete signup first.",
        )

    if not verify_password(body.password, user.password_hash):
        record_failed_login(identifier)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    # Clear failed attempts on successful login
    clear_login_attempts(identifier)

    # Check if forced password change is needed
    if user.must_change_password:
        change_token = create_change_password_token(user.id)
        return MustChangePasswordResponse(change_token=change_token)

    # Issue tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )

    return LoginResponse(
        access_token=access_token,
        user=UserBrief(
            id=user.id,
            identifier=user.identifier,
            name=user.name,
            role=user.role.value,
            email=user.email,
            roll_no=user.roll_no,
            room_no=user.room_no,
        ),
    )


# ---------------------------------------------------------------------------
# Forced password change (for staff accounts created by hall_office)
# ---------------------------------------------------------------------------

@router.post("/change-password", response_model=LoginResponse)
def change_password(body: ChangePasswordRequest, response: Response, db: Session = Depends(get_db)):
    payload = decode_token(body.change_token)
    if not payload or payload.get("type") != "change_password":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired change-password token.",
        )

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    db.commit()

    # Issue real tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )

    return LoginResponse(
        access_token=access_token,
        user=UserBrief(
            id=user.id,
            identifier=user.identifier,
            name=user.name,
            role=user.role.value,
            email=user.email,
            roll_no=user.roll_no,
            room_no=user.room_no,
        ),
    )


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=RefreshResponse)
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token.",
        )

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
        )

    access_token = create_access_token(user.id, user.role.value)

    return RefreshResponse(access_token=access_token)


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

@router.post("/logout", response_model=MessageResponse)
def logout(response: Response):
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        secure=False,
        samesite="lax",
    )
    return MessageResponse(message="Logged out.")
