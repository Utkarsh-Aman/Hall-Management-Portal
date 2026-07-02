"""
Bookings router — student creates bookings, views history, gets QR images.
"""

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response as RawResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import io
import csv
from datetime import date

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
        item_date=item.date,
        meal_type=item.meal_type.value,
        qty=booking.qty,
        total_price=booking.total_price,
        status=booking.status.value,
        qr_token=booking.qr_token,
        booked_at=booking.booked_at,
        closes_at=item.closes_at,
    )


# ---------------------------------------------------------------------------
# Get own booking history + running total
# ---------------------------------------------------------------------------

@router.get("/me", response_model=BookingListResponse)
def get_my_bookings(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(ExtrasBooking)
        .join(ExtrasItem)
        .filter(ExtrasBooking.student_id == current_user.id)
        .order_by(ExtrasBooking.booked_at.desc())
    )
    
    if start_date:
        query = query.filter(ExtrasItem.date >= start_date)
    if end_date:
        query = query.filter(ExtrasItem.date <= end_date)
        
    bookings = query.all()

    # Calculate global running total
    running_total = (
        db.query(func.sum(ExtrasBooking.total_price))
        .filter(
            ExtrasBooking.student_id == current_user.id,
            ExtrasBooking.status.not_in([BookingStatus.cancelled, BookingStatus.cancel_requested])
        )
        .scalar()
    ) or 0

    result = []
    for b in bookings:
        item = b.item
        result.append(
            BookingResponse(
                id=b.id,
                item_id=b.item_id,
                item_name=item.name,
                item_date=item.date,
                meal_type=item.meal_type.value,
                qty=b.qty,
                total_price=b.total_price,
                status=b.status.value,
                qr_token=b.qr_token,
                booked_at=b.booked_at,
                qr_used_at=b.qr_used_at,
                closes_at=item.closes_at,
            )
        )

    return BookingListResponse(
        bookings=result,
        running_total=running_total,
    )

@router.get("/me/export")
def export_my_bookings(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    bookings = (
        db.query(ExtrasBooking)
        .join(ExtrasItem)
        .filter(ExtrasBooking.student_id == current_user.id)
        .order_by(ExtrasItem.date.desc(), ExtrasBooking.booked_at.desc())
        .all()
    )
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Meal", "Item", "Quantity", "Price (INR)", "Status", "Booked At"])
    
    for b in bookings:
        item = b.item
        writer.writerow([
            item.date,
            item.meal_type.value.capitalize(),
            item.name,
            b.qty,
            f"{b.total_price:.2f}",
            b.status.value.upper(),
            b.booked_at.strftime("%Y-%m-%d %H:%M")
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=my_bookings_history.csv"}
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
# ---------------------------------------------------------------------------
# Modify / Cancel / Request Cancel
# ---------------------------------------------------------------------------

@router.put("/{booking_id}")
def modify_booking(
    booking_id: int,
    qty: int = Query(..., ge=1, le=10),
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    booking = db.query(ExtrasBooking).filter(
        ExtrasBooking.id == booking_id, 
        ExtrasBooking.student_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    item = booking.item
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # Check if window is open
    if now >= item.closes_at:
        raise HTTPException(status_code=400, detail="Booking window has closed.")
        
    booking.qty = qty
    booking.total_price = item.price * qty
    db.commit()
    db.refresh(booking)
    
    return {"message": "Booking modified successfully.", "new_qty": qty, "new_total": booking.total_price}

@router.delete("/{booking_id}")
def cancel_booking(
    booking_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    booking = db.query(ExtrasBooking).filter(
        ExtrasBooking.id == booking_id, 
        ExtrasBooking.student_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    item = booking.item
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    if now >= item.closes_at:
        raise HTTPException(status_code=400, detail="Booking window has closed. Use request cancellation instead.")
        
    booking.status = BookingStatus.cancelled
    db.commit()
    return {"message": "Booking cancelled."}

@router.post("/{booking_id}/request-cancel")
def request_cancel_booking(
    booking_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    booking = db.query(ExtrasBooking).filter(
        ExtrasBooking.id == booking_id, 
        ExtrasBooking.student_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    if booking.status != BookingStatus.booked:
        raise HTTPException(status_code=400, detail="Cannot request cancellation for this booking.")
        
    booking.status = BookingStatus.cancel_requested
    db.commit()
    return {"message": "Cancellation requested."}
