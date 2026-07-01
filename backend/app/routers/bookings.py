"""
Bookings router — student creates bookings, views history, gets QR images.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from app.models.extras import BookingStatus, ExtrasBooking, ExtrasItem
from app.models.user import User
from app.schemas.extras import (
    BookingCreate,
    BookingListResponse,
    BookingResponse,
)
from app.services.qr_service import generate_qr_image

router = APIRouter(prefix="/bookings", tags=["bookings"])


# ---------------------------------------------------------------------------
# Create a booking
# ---------------------------------------------------------------------------

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    # Fetch item
    item = (
        db.query(ExtrasItem)
        .filter(ExtrasItem.id == body.item_id, ExtrasItem.is_active.is_(True))
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or is no longer available.",
        )

    # Calculate total price (locked at booking time)
    total_price = item.price * body.qty

    # Generate unique QR token
    qr_token = uuid.uuid4().hex

    booking = ExtrasBooking(
        student_id=current_user.id,
        item_id=item.id,
        qty=body.qty,
        total_price=total_price,
        status=BookingStatus.booked,
        qr_token=qr_token,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return BookingResponse(
        id=booking.id,
        item_id=booking.item_id,
        item_name=item.name,
        qty=booking.qty,
        total_price=booking.total_price,
        status=booking.status.value,
        qr_token=booking.qr_token,
        booked_at=booking.booked_at,
    )


# ---------------------------------------------------------------------------
# Get own booking history + running total
# ---------------------------------------------------------------------------

@router.get("/me", response_model=BookingListResponse)
def get_my_bookings(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    bookings = (
        db.query(ExtrasBooking)
        .filter(ExtrasBooking.student_id == current_user.id)
        .order_by(ExtrasBooking.booked_at.desc())
        .all()
    )

    result = []
    running_total = 0

    for b in bookings:
        item = db.query(ExtrasItem).filter(ExtrasItem.id == b.item_id).first()
        result.append(
            BookingResponse(
                id=b.id,
                item_id=b.item_id,
                item_name=item.name if item else "Unknown",
                qty=b.qty,
                total_price=b.total_price,
                status=b.status.value,
                qr_token=b.qr_token,
                booked_at=b.booked_at,
                qr_used_at=b.qr_used_at,
            )
        )
        running_total += float(b.total_price)

    return BookingListResponse(
        bookings=result,
        running_total=running_total,
    )


# ---------------------------------------------------------------------------
# Get QR code image for a booking
# ---------------------------------------------------------------------------

@router.get("/{booking_id}/qr")
def get_booking_qr(
    booking_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    booking = (
        db.query(ExtrasBooking)
        .filter(
            ExtrasBooking.id == booking_id,
            ExtrasBooking.student_id == current_user.id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found.",
        )

    png_bytes = generate_qr_image(booking.qr_token)

    return RawResponse(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )
