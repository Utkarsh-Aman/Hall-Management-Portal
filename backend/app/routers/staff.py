"""
Staff router — extras item CRUD, booking views, wastage management.
"""

from datetime import date, datetime, time, timezone
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from sqlalchemy import func
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

router = APIRouter(prefix="/staff", tags=["staff"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_prep_time(opens_at: time, closes_at: time) -> int:
    """Compute prep time in minutes from open→close times."""
    open_mins = opens_at.hour * 60 + opens_at.minute
    close_mins = closes_at.hour * 60 + closes_at.minute
    diff = close_mins - open_mins
    return max(diff, 0)


# ---------------------------------------------------------------------------
# Items CRUD
# ---------------------------------------------------------------------------

@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    body: ItemCreate,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    prep_time = _compute_prep_time(body.opens_at, body.closes_at)

    item = ExtrasItem(
        name=body.name,
        price=body.price,
        opens_at=body.opens_at,
        closes_at=body.closes_at,
        prep_time_mins=prep_time,
        is_recurring=body.is_recurring,
        recurring_weekday=body.recurring_weekday if body.is_recurring else None,
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
    if body.opens_at is not None:
        item.opens_at = body.opens_at
    if body.closes_at is not None:
        item.closes_at = body.closes_at
    if body.is_recurring is not None:
        item.is_recurring = body.is_recurring
    if body.recurring_weekday is not None:
        item.recurring_weekday = body.recurring_weekday
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

@router.get("/bookings", response_model=list[StaffBookingResponse])
def list_all_bookings(
    filter_date: date | None = Query(None, alias="date"),
    item_id: int | None = Query(None),
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    query = db.query(ExtrasBooking).order_by(ExtrasBooking.booked_at.desc())

    if filter_date:
        query = query.filter(
            ExtrasBooking.booked_at >= datetime.combine(filter_date, time.min),
            ExtrasBooking.booked_at <= datetime.combine(filter_date, time.max),
        )

    if item_id:
        query = query.filter(ExtrasBooking.item_id == item_id)

    bookings = query.all()

    result = []
    for b in bookings:
        student = db.query(User).filter(User.id == b.student_id).first()
        item = db.query(ExtrasItem).filter(ExtrasItem.id == b.item_id).first()
        result.append(
            StaffBookingResponse(
                id=b.id,
                student_identifier=student.identifier if student else "Unknown",
                item_name=item.name if item else "Unknown",
                qty=b.qty,
                total_price=b.total_price,
                status=b.status.value,
                booked_at=b.booked_at,
                qr_used_at=b.qr_used_at,
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
        db.query(
            User.identifier.label("roll_no"),
            User.name.label("name"),
            func.sum(ExtrasBooking.total_price).label("total_amount")
        )
        .join(ExtrasBooking, User.id == ExtrasBooking.student_id)
        .filter(
            ExtrasBooking.booked_at >= datetime.combine(start_date, time.min),
            ExtrasBooking.booked_at <= datetime.combine(end_date, time.max),
            ExtrasBooking.status == BookingStatus.served
        )
        .group_by(User.identifier, User.name)
        .order_by(User.identifier)
    )

    results = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Roll Number", "Name", "Total Extras Amount"])

    for row in results:
        writer.writerow([row.roll_no, row.name, f"{row.total_amount:.2f}"])

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
    today = date.today()

    # Only allow editing today's entry or creating a new one
    existing = (
        db.query(WastageLog)
        .filter(WastageLog.date == body.date)
        .first()
    )

    if existing:
        if body.date != today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only edit today's wastage entry.",
            )
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
