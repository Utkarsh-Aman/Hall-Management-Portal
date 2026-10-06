"""
Staff router - extras item CRUD, booking views, wastage management.
"""

from datetime import date, datetime, timezone, timedelta
import csv
import io
from zoneinfo import ZoneInfo

from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from app.models.extras import ExtrasBooking, ExtrasItem, BookingStatus
from app.models.user import User
from app.models.wastage import WastageLog
from app.schemas.extras import (
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    StaffBookingResponse,
)
from app.schemas.wastage import WastageCreate, WastageResponse

class BulkDeleteRequest(BaseModel):
    password: str

router = APIRouter(prefix="/staff", tags=["staff"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_prep_time(opens_at: datetime, closes_at: datetime) -> int:
    """Compute prep time in minutes from open→close times."""
    return max(int((closes_at - opens_at).total_seconds() // 60), 0)


# ---------------------------------------------------------------------------
# Items CRUD
# ---------------------------------------------------------------------------

@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    body: ItemCreate,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    opens_at = body.closes_at - timedelta(hours=48)
    prep_time = _compute_prep_time(opens_at, body.closes_at)

    item = ExtrasItem(
        name=body.name,
        price=body.price,
        date=body.date,
        meal_type=body.meal_type,
        opens_at=opens_at,
        closes_at=body.closes_at,
        prep_time_mins=prep_time,
        is_recurring=body.is_recurring,
        recurring_weekday=(
            body.recurring_weekday
            if body.recurring_weekday is not None
            else body.date.weekday()
        ) if body.is_recurring else None,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/items", response_model=list[ItemResponse])
def list_all_items(
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    items = db.query(ExtrasItem).order_by(ExtrasItem.created_at.desc()).all()
    return items


@router.put("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    body: ItemUpdate,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    item = db.query(ExtrasItem).filter(ExtrasItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    if body.name is not None:
        item.name = body.name
    if body.price is not None:
        item.price = body.price
    if body.date is not None:
        item.date = body.date
    if body.meal_type is not None:
        item.meal_type = body.meal_type
    if body.closes_at is not None:
        item.closes_at = body.closes_at
        item.opens_at = item.closes_at - timedelta(hours=48)
    if body.is_recurring is not None:
        item.is_recurring = body.is_recurring
        if not body.is_recurring:
            item.recurring_weekday = None
    if body.recurring_weekday is not None:
        item.recurring_weekday = body.recurring_weekday
    elif item.is_recurring and body.date is not None:
        item.recurring_weekday = body.date.weekday()
    if body.is_active is not None:
        item.is_active = body.is_active

    # Recompute prep time
    item.prep_time_mins = _compute_prep_time(item.opens_at, item.closes_at)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    item = db.query(ExtrasItem).filter(ExtrasItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    # Soft-delete: deactivate instead of removing, to preserve booking history
    item.is_active = False
    db.commit()

    return {"message": "Item deactivated."}


# ---------------------------------------------------------------------------
# View all bookings (mess_staff)
# ---------------------------------------------------------------------------

@router.post("/bookings/trigger-missed")
def trigger_missed_bookings(
    current_user: User = Depends(require_role("mess_staff")),
):
    from app.services.scheduler import mark_missed_bookings
    mark_missed_bookings()
    return {"message": "Successfully ran the missed bookings check for past meals."}

@router.delete("/bookings/{booking_id}")
def delete_booking_staff(
    booking_id: int,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    booking = db.query(ExtrasBooking).filter(ExtrasBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    
    if booking.status == BookingStatus.served:
        raise HTTPException(status_code=400, detail="A served booking cannot be cancelled.")

    booking.status = BookingStatus.cancelled
    db.commit()
    return {"message": "Booking cancelled."}

@router.post("/bookings/{booking_id}/serve")
def serve_booking_staff(
    booking_id: int,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    booking = db.query(ExtrasBooking).filter(ExtrasBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    
    if booking.status != BookingStatus.booked:
        raise HTTPException(status_code=400, detail="Only an active booking can be served.")

    booking.status = BookingStatus.served
    booking.qr_used_at = datetime.now(timezone.utc)
    booking.served_by = current_user.id
    db.commit()
    return {"message": "Booking marked as served."}


@router.post("/bookings/{booking_id}/cancel-request/approve")
def approve_cancel_request(
    booking_id: int,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    booking = db.query(ExtrasBooking).filter(ExtrasBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != BookingStatus.cancel_requested:
        raise HTTPException(status_code=400, detail="This booking has no pending cancellation request.")

    booking.status = BookingStatus.cancelled
    db.commit()
    return {"message": "Cancellation request approved."}


@router.post("/bookings/{booking_id}/cancel-request/reject")
def reject_cancel_request(
    booking_id: int,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    booking = db.query(ExtrasBooking).filter(ExtrasBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != BookingStatus.cancel_requested:
        raise HTTPException(status_code=400, detail="This booking has no pending cancellation request.")

    booking.status = BookingStatus.booked
    db.commit()
    return {"message": "Cancellation request rejected."}

@router.post("/items/{item_id}/bookings/bulk-delete")
def bulk_delete_bookings(
    item_id: int,
    body: BulkDeleteRequest,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    from app.services.auth_service import verify_password
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password.")
        
    bookings = db.query(ExtrasBooking).filter(ExtrasBooking.item_id == item_id).all()
    count = len(bookings)
    for b in bookings:
        db.delete(b)
    db.commit()
    return {"message": f"Deleted {count} bookings."}

@router.get("/bookings", response_model=list[StaffBookingResponse])
def list_all_bookings(
    filter_date: date | None = Query(None, alias="date"),
    item_id: int | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    query = db.query(ExtrasBooking).join(User, ExtrasBooking.student_id == User.id).join(ExtrasItem, ExtrasBooking.item_id == ExtrasItem.id).order_by(ExtrasBooking.booked_at.desc())

    if filter_date:
        query = query.filter(ExtrasItem.date == filter_date)

    if item_id:
        query = query.filter(ExtrasBooking.item_id == item_id)
        
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.name.ilike(search_term)) | (User.identifier.ilike(search_term))
        )

    bookings = query.all()

    result = []
    for b in bookings:
        student = db.query(User).filter(User.id == b.student_id).first()
        item = db.query(ExtrasItem).filter(ExtrasItem.id == b.item_id).first()
        result.append(
            StaffBookingResponse(
                id=b.id,
                student_identifier=student.identifier if student else "Unknown",
                student_name=student.name if student else "Unknown",
                item_name=item.name if item else "Unknown",
                item_date=item.date if item else None,
                meal_type=item.meal_type.value if item else "Unknown",
                qty=b.qty,
                total_price=b.total_price,
                status=b.status.value,
                booked_at=b.booked_at,
                qr_used_at=b.qr_used_at,
                closes_at=item.closes_at if item else datetime.now(timezone.utc),
            )
        )

    return result


@router.get("/reports/extras/export")
def export_extras_csv(
    start_date: date,
    end_date: date,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(ExtrasBooking, ExtrasItem, User)
        .join(ExtrasItem, ExtrasBooking.item_id == ExtrasItem.id)
        .join(User, ExtrasBooking.student_id == User.id)
        .filter(
            ExtrasItem.date >= start_date,
            ExtrasItem.date <= end_date,
            ExtrasBooking.status.in_([
                BookingStatus.booked,
                BookingStatus.served,
                BookingStatus.missed,
            ]),
        )
        .order_by(ExtrasItem.date, ExtrasItem.meal_type, User.roll_no, ExtrasItem.name)
    )

    results = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Meal", "Roll Number", "Name", "Room Number",
        "Item", "Quantity", "Status", "Amount (INR)",
    ])

    for booking, item, student in results:
        writer.writerow([
            item.date,
            item.meal_type.value.capitalize(),
            student.roll_no or student.identifier.split("@")[0],
            student.name,
            student.room_no or "",
            item.name,
            booking.qty,
            booking.status.value.upper(),
            f"{booking.total_price:.2f}",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=extras_report_{start_date}_to_{end_date}.csv"
        }
    )


# ---------------------------------------------------------------------------
# Wastage management
# ---------------------------------------------------------------------------

@router.post("/wastage", response_model=WastageResponse)
def upsert_wastage(
    body: WastageCreate,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()

    if body.date != today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wastage can only be entered or edited for today's date in India time.",
        )

    # There is exactly one editable entry for the current India calendar date.
    existing = (
        db.query(WastageLog)
        .filter(WastageLog.date == body.date)
        .first()
    )

    if existing:
        existing.bdmr = body.bdmr
        existing.plain_wastage = body.plain_wastage
        existing.plate_wastage = body.plate_wastage
        existing.entered_by = current_user.id
        existing.entered_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    entry = WastageLog(
        date=body.date,
        bdmr=body.bdmr,
        plain_wastage=body.plain_wastage,
        plate_wastage=body.plate_wastage,
        entered_by=current_user.id,
        entered_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/wastage", response_model=list[WastageResponse])
def list_wastage(
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(WastageLog)
        .order_by(WastageLog.date.desc())
        .all()
    )
    return logs
