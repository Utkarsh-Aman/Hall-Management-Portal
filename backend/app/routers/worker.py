"""
Worker router - QR scanning and today's booking queue.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_db, require_role
from app.models.extras import BookingStatus, ExtrasBooking, ExtrasItem
from app.models.user import User
from app.schemas.extras import ScanAlreadyUsedResponse, ScanRequest, ScanSuccessResponse

router = APIRouter(prefix="/worker", tags=["worker"])


# ---------------------------------------------------------------------------
# Atomic QR scan - mark served
# ---------------------------------------------------------------------------

@router.post("/scan")
def scan_qr(
    body: ScanRequest,
    current_user: User = Depends(require_role("mess_worker")),
    db: Session = Depends(get_db),
):
    if not settings.QR_SCANNING_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="QR scanning is temporarily disabled. Use the manual queue instead.",
        )

    now = datetime.now(timezone.utc)

    # Atomic conditional update: only an active booking can be served.
    rows_updated = (
        db.query(ExtrasBooking)
        .filter(
            ExtrasBooking.qr_token == body.qr_token,
            ExtrasBooking.status == BookingStatus.booked,
        )
        .update(
            {
                ExtrasBooking.status: BookingStatus.served,
                ExtrasBooking.qr_used_at: now,
                ExtrasBooking.served_by: current_user.id,
            },
            synchronize_session="fetch",
        )
    )
    db.commit()

    if rows_updated == 1:
        # Fetch the booking for response details
        booking = (
            db.query(ExtrasBooking)
            .filter(ExtrasBooking.qr_token == body.qr_token)
            .first()
        )
        item = db.query(ExtrasItem).filter(ExtrasItem.id == booking.item_id).first()
        student = db.query(User).filter(User.id == booking.student_id).first()

        return ScanSuccessResponse(
            booking_id=booking.id,
            item_name=item.name if item else "Unknown",
            qty=booking.qty,
            student_identifier=student.identifier if student else "Unknown",
        )

    # If no rows updated, check if it was already served or doesn't exist
    booking = (
        db.query(ExtrasBooking)
        .filter(ExtrasBooking.qr_token == body.qr_token)
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QR code not recognized.",
        )

    if booking.status == BookingStatus.served and booking.qr_used_at is not None:
        return ScanAlreadyUsedResponse(served_at=booking.qr_used_at)

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Booking is {booking.status.value.replace('_', ' ')} and cannot be served.",
    )


# ---------------------------------------------------------------------------
# Today's queue (fallback list)
# ---------------------------------------------------------------------------

@router.get("/bookings/today")
def todays_bookings(
    current_user: User = Depends(require_role("mess_worker")),
    db: Session = Depends(get_db),
):
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()

    bookings = (
        db.query(ExtrasBooking)
        .join(ExtrasItem, ExtrasBooking.item_id == ExtrasItem.id)
        .filter(
            ExtrasItem.date == today,
            ExtrasBooking.status == BookingStatus.booked,
        )
        .order_by(ExtrasBooking.booked_at.asc())
        .all()
    )

    result = []
    for b in bookings:
        item = db.query(ExtrasItem).filter(ExtrasItem.id == b.item_id).first()
        student = db.query(User).filter(User.id == b.student_id).first()
        result.append({
            "id": b.id,
            "item_name": item.name if item else "Unknown",
            "qty": b.qty,
            "student_identifier": student.identifier if student else "Unknown",
            "qr_token": b.qr_token,
            "booked_at": b.booked_at.isoformat(),
        })

    return result
