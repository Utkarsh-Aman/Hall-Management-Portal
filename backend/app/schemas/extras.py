"""
Pydantic schemas for extras items and bookings.
"""

from datetime import datetime, time
from decimal import Decimal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Extras Items
# ---------------------------------------------------------------------------

class ItemCreate(BaseModel):
    """Staff creates a new extras item."""
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., gt=0)
    opens_at: time
    closes_at: time
    is_recurring: bool = False
    recurring_weekday: int | None = Field(None, ge=0, le=6)


class ItemUpdate(BaseModel):
    """Staff updates an extras item (all fields optional)."""
    name: str | None = Field(None, min_length=1, max_length=255)
    price: Decimal | None = Field(None, gt=0)
    opens_at: time | None = None
    closes_at: time | None = None
    is_recurring: bool | None = None
    recurring_weekday: int | None = Field(None, ge=0, le=6)
    is_active: bool | None = None


class ItemResponse(BaseModel):
    id: int
    name: str
    price: Decimal
    opens_at: time
    closes_at: time
    prep_time_mins: int
    is_recurring: bool
    recurring_weekday: int | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------

class BookingCreate(BaseModel):
    """Student places a booking."""
    item_id: int
    qty: int = Field(..., ge=1, le=10)


class BookingResponse(BaseModel):
    id: int
    item_id: int
    item_name: str = ""
    qty: int
    total_price: Decimal
    status: str
    qr_token: str
    booked_at: datetime
    qr_used_at: datetime | None = None

    model_config = {"from_attributes": True}


class BookingListResponse(BaseModel):
    bookings: list[BookingResponse]
    running_total: Decimal


class StaffBookingResponse(BaseModel):
    """Booking view for mess_staff — includes student identifier."""
    id: int
    student_identifier: str = ""
    item_name: str = ""
    qty: int
    total_price: Decimal
    status: str
    booked_at: datetime
    qr_used_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Worker scan
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    qr_token: str


class ScanSuccessResponse(BaseModel):
    message: str = "Marked as served."
    booking_id: int
    item_name: str
    qty: int
    student_identifier: str


class ScanAlreadyUsedResponse(BaseModel):
    already_served: bool = True
    served_at: datetime
    message: str = "This QR code was already used."
