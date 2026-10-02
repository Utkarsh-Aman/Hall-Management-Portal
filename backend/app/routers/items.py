"""
Items router - student-facing view of available extras.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from app.models.extras import ExtrasItem
from app.models.user import User
from app.schemas.extras import ItemResponse

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemResponse])
def list_available_items(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """Return active extras items from the current meal onwards until tomorrow's dinner."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_ist = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    tomorrow_ist = today_ist + timedelta(days=1)
    
    # We want items whose closes_at is in the future
    # Or, we can just return items where opens_at <= now <= closes_at for the "currently bookable" items.
    # But the requirement says "The interface will show only the current meal onwards until tomorrow's dinner".
    # We can just fetch all active items whose closes_at > now and closes_at < now + 48 hours.
    # Since opens_at is set to closes_at - 48 hours, any item with opens_at < now + 48h is within the 48h window.
    # We will just fetch items where closes_at > now and order by opens_at.
    
    items = (
        db.query(ExtrasItem)
        .filter(
            ExtrasItem.is_active.is_(True),
            ExtrasItem.opens_at <= now,
            ExtrasItem.closes_at > now,
            ExtrasItem.date >= today_ist,
            ExtrasItem.date <= tomorrow_ist,
        )
        .order_by(ExtrasItem.opens_at)
        .all()
    )
    return items
