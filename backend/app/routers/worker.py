"""
Worker router — QR scanning and today's booking queue.
"""

from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from app.models.extras import BookingStatus, ExtrasBooking, ExtrasItem
from app.models.user import User
from app.schemas.extras import ScanAlreadyUsedResponse, ScanRequest, ScanSuccessResponse

router = APIRouter(prefix="/worker", tags=["worker"])


# ---------------------------------------------------------------------------
# Atomic QR scan — mark served
# ---------------------------------------------------------------------------

@router.post("/scan")
def scan_qr(
    body: ScanRequest,
    current_user: User = Depends(require_role("mess_worker")),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # Atomic conditional update: only succeeds if status is still 'booked' or 'cancel_requested'
    rows_updated = (
        db.query(ExtrasBooking)
        .filter(
            ExtrasBooking.qr_token == body.qr_token,
            ExtrasBooking.status.in_([BookingStatus.booked, BookingStatus.cancel_requested]),
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

    # Already served
    return ScanAlreadyUsedResponse(
        served_at=booking.qr_used_at,
    )


# ---------------------------------------------------------------------------
# Today's queue (fallback list)
# ---------------------------------------------------------------------------

@router.get("/bookings/today")
def todays_bookings(
    current_user: User = Depends(require_role("mess_worker")),
    db: Session = Depends(get_db),
):
    today_start = datetime.combine(datetime.now(timezone.utc).date(), time.min)

    bookings = (
        db.query(ExtrasBooking)
        .filter(
            ExtrasBooking.booked_at >= today_start,
            ExtrasBooking.status.in_([BookingStatus.booked, BookingStatus.cancel_requested]),
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
