"""
Dashboard router — student wastage summary.
"""

from datetime import timedelta, timezone, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from app.models.user import User
from app.models.wastage import WastageLog
from app.schemas.wastage import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """
    Returns:
    - avg_bdmr: 7-day rolling average of BDMR
    - plain_wastage: latest single day's figure
    - plate_wastage: latest single day's figure
    - last_updated: timestamp of the most recent wastage_logs entry
    """
    # Get the 7 most recent wastage logs by date
    recent_logs = (
        db.query(WastageLog)
        .order_by(WastageLog.date.desc())
        .limit(7)
        .all()
    )

    if not recent_logs:
        return DashboardSummary()

    # Latest entry
    latest = recent_logs[0]

    # 7-day rolling average BDMR
    avg_bdmr = sum(log.bdmr for log in recent_logs) / len(recent_logs)

    return DashboardSummary(
        avg_bdmr=round(avg_bdmr, 2),
        plain_wastage=latest.plain_wastage,
        plate_wastage=latest.plate_wastage,
        last_updated=latest.entered_at,
    )
