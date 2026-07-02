"""
User model — covers all four roles: student, mess_staff, mess_worker, hall_office.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    """The four MVP roles."""
    student = "student"
    mess_staff = "mess_staff"
    mess_worker = "mess_worker"
    hall_office = "hall_office"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # For students this is their email; for staff it's a generated staff_id
    identifier: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    room_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    roll_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # OTP fields (used only during student signup)
    otp_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    otp_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Signup state
    password_set: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Forced password change (for staff accounts created by hall_office)
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Rate-limiting for login
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Audit
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
