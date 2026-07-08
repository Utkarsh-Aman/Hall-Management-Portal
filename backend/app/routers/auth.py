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
    get_current_user,
    get_db,
    record_failed_login,
)
from app.models.allowed_roll import AllowedRollNumber
from app.models.user import User, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    MustChangePasswordResponse,
    RefreshResponse,
    SetupVerifyRequest,
    SetupVerifyResponse,
    SetupCompleteRequest,
    ForgotPasswordRequestOTP,
    ForgotPasswordVerifyOTP,
    ForgotPasswordReset,
    UserBrief,
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
# Student Setup Flow (replaces old Signup)
# ---------------------------------------------------------------------------

@router.post("/setup/verify", response_model=SetupVerifyResponse)
def setup_verify(body: SetupVerifyRequest, db: Session = Depends(get_db)):
    roll_no = body.roll_no.strip()
    
    # 1. Check if user is already registered
    existing_user = db.query(User).filter(User.roll_no == roll_no).first()
    if existing_user and existing_user.password_set:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this roll number is already registered. Please log in.",
        )
        
    # 2. Check AllowedRollNumber for the setup code
    allowed = db.query(AllowedRollNumber).filter(AllowedRollNumber.roll_no == roll_no).first()
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roll number not found. Contact the hall office.",
        )
        
    if not allowed.setup_code or allowed.setup_code != body.setup_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid setup code. Please check the code sent to your email.",
        )
        
    return SetupVerifyResponse(
        name=allowed.name,
        email=allowed.email,
        room_no=allowed.room_number
    )


@router.post("/setup/complete", response_model=LoginResponse)
def setup_complete(body: SetupCompleteRequest, response: Response, db: Session = Depends(get_db)):
    roll_no = body.roll_no.strip()
    
    # 1. Verify again
    existing_user = db.query(User).filter(User.roll_no == roll_no).first()
    if existing_user and existing_user.password_set:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account is already registered. Please log in.",
        )
        
    allowed = db.query(AllowedRollNumber).filter(AllowedRollNumber.roll_no == roll_no).first()
    if not allowed or not allowed.setup_code or allowed.setup_code != body.setup_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid setup code.",
        )
        
    # 2. Create the User
    if not existing_user:
        user = User(
            identifier=allowed.email or f"{roll_no}@student.iitk.ac.in",
            email=allowed.email,
            password_hash=hash_password(body.password),
            role=UserRole.student,
            name=body.name,
            room_no=body.room_no,
            roll_no=roll_no,
            is_active=True,
            password_set=True,
            must_change_password=False,
            otp_attempts=0,
        )
        db.add(user)
    else:
        user = existing_user
        user.password_hash = hash_password(body.password)
        user.password_set = True
        user.name = body.name
        user.room_no = body.room_no
        
    # 3. Clear the setup code
    allowed.setup_code = None
    db.commit()
    db.refresh(user)
    
    # 4. Issue tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

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
# Forgot Password
# ---------------------------------------------------------------------------

@router.post("/forgot-password/request-otp")
def forgot_password_request_otp(body: ForgotPasswordRequestOTP, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    # Rate limit
    check_otp_rate_limit(email)

    user = db.query(User).filter(User.identifier == email).first()
    if not user or not user.password_set:
        # Don't reveal if user exists or not for security, just return success
        return {"message": "If the email is registered, an OTP has been sent."}

    # Generate OTP
    otp = generate_otp()
    otp_hash = hash_password(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    user.otp_hash = otp_hash
    user.otp_expires_at = expires_at
    user.otp_attempts = 0
    db.commit()

    # Send OTP via email (console in dev)
    send_otp_email(email, otp)

    return {"message": "If the email is registered, an OTP has been sent."}


@router.post("/forgot-password/verify-otp", response_model=VerifyOTPResponse)
def forgot_password_verify_otp(body: ForgotPasswordVerifyOTP, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    user = db.query(User).filter(User.identifier == email).first()
    if not user or not user.password_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request.",
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

    # OTP is valid — generate reset token (re-using signup token for simplicity)
    reset_token = create_signup_token(email)

    # Clear OTP fields
    user.otp_hash = None
    user.otp_expires_at = None
    db.commit()

    return VerifyOTPResponse(reset_token=reset_token)


@router.post("/forgot-password/reset-password", response_model=LoginResponse)
def forgot_password_reset(body: ForgotPasswordReset, response: Response, db: Session = Depends(get_db)):
    # Decode the token
    payload = decode_token(body.reset_token)
    if not payload or payload.get("type") != "signup":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    email = payload.get("email")
    user = db.query(User).filter(User.identifier == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found.",
        )

    # Set new password
    user.password_hash = hash_password(body.new_password)
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
# Get current user info (for session restore after refresh)
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserBrief)
def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return full user info for the currently authenticated user."""
    return UserBrief(
        id=current_user.id,
        identifier=current_user.identifier,
        name=current_user.name,
        role=current_user.role.value,
        email=current_user.email,
        roll_no=current_user.roll_no,
        room_no=current_user.room_no,
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
