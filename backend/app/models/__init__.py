# Models package — import all models here so Alembic can auto-detect them.

from app.models.user import User, UserRole
from app.models.allowed_roll import AllowedRollNumber
from app.models.extras import ExtrasItem, ExtrasBooking, BookingStatus
from app.models.menu import WeeklyMenu, MealType
from app.models.wastage import WastageLog
from app.models.notice import Notice

__all__ = [
    "User",
    "UserRole",
    "AllowedRollNumber",
    "ExtrasItem",
    "ExtrasBooking",
    "BookingStatus",
    "WeeklyMenu",
    "MealType",
    "WastageLog",
    "Notice",
]
