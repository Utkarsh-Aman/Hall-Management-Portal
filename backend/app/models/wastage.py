"""
Wastage logs model — one entry per day, editable same-day.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WastageLog(Base):
    __tablename__ = "wastage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    bdmr: Mapped[float] = mapped_column(Float, nullable=False)
    plain_wastage: Mapped[float] = mapped_column(Float, nullable=False)
    plate_wastage: Mapped[float] = mapped_column(Float, nullable=False)

    entered_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    entered_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
