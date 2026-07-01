"""
Weekly menu model — 7 days × 3 meals grid.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"


class WeeklyMenu(Base):
    __tablename__ = "weekly_menu"
    __table_args__ = (
        UniqueConstraint("day_of_week", "meal_type", name="uq_day_meal"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 0=Monday .. 6=Sunday
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    meal_type: Mapped[MealType] = mapped_column(Enum(MealType), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    updated_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
