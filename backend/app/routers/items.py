"""
Items router — student-facing view of available extras.
"""

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
    """Return all active extras items for students to browse."""
    items = (
        db.query(ExtrasItem)
        .filter(ExtrasItem.is_active.is_(True))
        .order_by(ExtrasItem.opens_at)
        .all()
    )
    return items
