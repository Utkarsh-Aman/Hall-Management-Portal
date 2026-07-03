"""
Pydantic schemas for hall_office endpoints.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class StaffCreateRequest(BaseModel):
    """Hall office creates a new staff account."""
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(
        ...,
        pattern=r"^(mess_staff|mess_worker)$",
        description="Must be 'mess_staff' or 'mess_worker'.",
    )


class StaffCreateResponse(BaseModel):
    """Returned once — contains the temporary password."""
    id: int
    identifier: str
    name: str
    role: str
    temp_password: str
    message: str = "Account created. Share this password securely — it will not be shown again."


class StaffListItem(BaseModel):
    id: int
    identifier: str
    name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StaffToggleRequest(BaseModel):
    is_active: bool


class RollNumberUploadResponse(BaseModel):
    count: int
    message: str


class AllowedRollCreate(BaseModel):
    roll_no: str = Field(..., min_length=1, max_length=50)
    name: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    room_number: str | None = Field(None, max_length=50)


class AllowedRollResponse(BaseModel):
    roll_no: str
    name: str | None
    email: str | None
    room_number: str | None
    setup_code: str | None = None
    uploaded_at: datetime
    uploaded_by: int

    model_config = {"from_attributes": True}
