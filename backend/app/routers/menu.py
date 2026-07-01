"""
Menu router — read-only weekly menu for students, editable for staff.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from app.models.menu import MealType, WeeklyMenu
from app.models.user import User
from app.schemas.menu import MenuSlotResponse, MenuSlotUpdate, WeeklyMenuResponse

router = APIRouter(tags=["menu"])


# ---------------------------------------------------------------------------
# Student-facing: read-only weekly menu
# ---------------------------------------------------------------------------

@router.get("/menu/weekly", response_model=WeeklyMenuResponse)
def get_weekly_menu(
    current_user: User = Depends(require_role("student", "mess_staff")),
    db: Session = Depends(get_db),
):
    slots = (
        db.query(WeeklyMenu)
        .order_by(WeeklyMenu.day_of_week, WeeklyMenu.meal_type)
        .all()
    )
    return WeeklyMenuResponse(
        slots=[
            MenuSlotResponse(
                id=s.id,
                day_of_week=s.day_of_week,
                meal_type=s.meal_type.value,
                description=s.description,
                updated_by=s.updated_by,
                updated_at=s.updated_at,
            )
            for s in slots
        ]
    )


# ---------------------------------------------------------------------------
# Staff: get full menu for editing
# ---------------------------------------------------------------------------

@router.get("/staff/menu", response_model=WeeklyMenuResponse)
def get_staff_menu(
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    slots = (
        db.query(WeeklyMenu)
        .order_by(WeeklyMenu.day_of_week, WeeklyMenu.meal_type)
        .all()
    )
    return WeeklyMenuResponse(
        slots=[
            MenuSlotResponse(
                id=s.id,
                day_of_week=s.day_of_week,
                meal_type=s.meal_type.value,
                description=s.description,
                updated_by=s.updated_by,
                updated_at=s.updated_at,
            )
            for s in slots
        ]
    )


# ---------------------------------------------------------------------------
# Staff: update one menu slot (upsert)
# ---------------------------------------------------------------------------

@router.put("/staff/menu/{day}/{meal}", response_model=MenuSlotResponse)
def update_menu_slot(
    day: int,
    meal: str,
    body: MenuSlotUpdate,
    current_user: User = Depends(require_role("mess_staff")),
    db: Session = Depends(get_db),
):
    if day < 0 or day > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day must be 0 (Monday) to 6 (Sunday).",
        )

    try:
        meal_type = MealType(meal)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="meal must be 'breakfast', 'lunch', or 'dinner'.",
        )

    existing = (
        db.query(WeeklyMenu)
        .filter(
            WeeklyMenu.day_of_week == day,
            WeeklyMenu.meal_type == meal_type,
        )
        .first()
    )

    now = datetime.now(timezone.utc)

    if existing:
        existing.description = body.description
        existing.updated_by = current_user.id
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        return MenuSlotResponse(
            id=existing.id,
            day_of_week=existing.day_of_week,
            meal_type=existing.meal_type.value,
            description=existing.description,
            updated_by=existing.updated_by,
            updated_at=existing.updated_at,
        )

    slot = WeeklyMenu(
        day_of_week=day,
        meal_type=meal_type,
        description=body.description,
        updated_by=current_user.id,
        updated_at=now,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)

    return MenuSlotResponse(
        id=slot.id,
        day_of_week=slot.day_of_week,
        meal_type=slot.meal_type.value,
        description=slot.description,
        updated_by=slot.updated_by,
        updated_at=slot.updated_at,
    )
