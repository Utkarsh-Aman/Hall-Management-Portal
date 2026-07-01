"""
Allowed roll numbers table — populated by hall_office CSV upload.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AllowedRollNumber(Base):
    __tablename__ = "allowed_roll_numbers"

    roll_no: Mapped[str] = mapped_column(String(50), primary_key=True)
    uploaded_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
