"""
Pydantic schemas for authentication endpoints.
"""

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Student signup flow
# ---------------------------------------------------------------------------

class RequestOTPRequest(BaseModel):
    """Step 1: student requests an OTP."""
    email: EmailStr
    roll_no: str = Field(..., min_length=1, max_length=50)


class RequestOTPResponse(BaseModel):
    message: str = "OTP sent to your email."


class VerifyOTPRequest(BaseModel):
    """Step 2: student verifies the OTP."""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class VerifyOTPResponse(BaseModel):
    signup_token: str
    message: str = "OTP verified. Set your password."


class SetPasswordRequest(BaseModel):
    """Step 3: student sets their password after OTP verification."""
    signup_token: str
    password: str = Field(..., min_length=8, max_length=128)


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

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str
