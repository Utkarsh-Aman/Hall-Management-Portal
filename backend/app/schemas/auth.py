"""
Pydantic schemas for authentication endpoints.
"""

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Student Setup Flow (replaces old Signup)
# ---------------------------------------------------------------------------

class SetupVerifyRequest(BaseModel):
    """Step 1: student verifies their setup code."""
    roll_no: str
    setup_code: str = Field(..., min_length=8, max_length=8)

class SetupVerifyResponse(BaseModel):
    name: str | None = None
    email: str | None = None
    room_no: str | None = None
    message: str = "Setup code verified. Set your password."

class SetupCompleteRequest(BaseModel):
    """Step 2: student sets their password and finalizes details."""
    roll_no: str
    setup_code: str = Field(..., min_length=8, max_length=8)
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    room_no: str | None = Field(None, max_length=50)

# ---------------------------------------------------------------------------
# Forgot Password Flow
# ---------------------------------------------------------------------------

class ForgotPasswordRequestOTP(BaseModel):
    """Step 1: user requests an OTP to their email."""
    email: EmailStr

class ForgotPasswordVerifyOTP(BaseModel):
    """Step 2: user verifies the OTP."""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class ForgotPasswordReset(BaseModel):
    """Step 3: user sets their new password."""
    reset_token: str
    new_password: str = Field(..., min_length=8, max_length=128)

class VerifyOTPResponse(BaseModel):
    reset_token: str
    message: str = "OTP verified. Set your new password."


class ChangePasswordRequest(BaseModel):
    """Authenticated user changing their password."""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserBrief"


class MustChangePasswordResponse(BaseModel):
    """Returned when a staff account must change its temp password."""
    must_change_password: bool = True
    change_token: str
    message: str = "You must change your password before continuing."


# ---------------------------------------------------------------------------
# Change password (forced)
# ---------------------------------------------------------------------------

class ChangePasswordRequest(BaseModel):
    change_token: str
    new_password: str = Field(..., min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class UserBrief(BaseModel):
    id: int
    identifier: str
    name: str
    role: str
    email: str | None = None
    roll_no: str | None = None
    room_no: str | None = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str
