"""
Extras items and bookings models.
"""

import enum
from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExtrasItem(Base):
    __tablename__ = "extras_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    opens_at: Mapped[time] = mapped_column(Time, nullable=False)
    closes_at: Mapped[time] = mapped_column(Time, nullable=False)
    prep_time_mins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 0=Monday .. 6=Sunday (ISO weekday minus 1)
    recurring_weekday: Mapped[int | None] = mapped_column(Integer, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationship for joins
    bookings: Mapped[list["ExtrasBooking"]] = relationship(back_populates="item")


class BookingStatus(str, enum.Enum):
    booked = "booked"
    served = "served"


class ExtrasBooking(Base):
    __tablename__ = "extras_bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("extras_items.id"), nullable=False
    )
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.booked, nullable=False
    )

    qr_token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    qr_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    served_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    booked_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationships
    item: Mapped["ExtrasItem"] = relationship(back_populates="bookings")
