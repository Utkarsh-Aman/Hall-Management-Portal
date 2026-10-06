"""
Dashboard router - student wastage summary.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func
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
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    period_start = today - timedelta(days=6)

    # The BDMR average covers the current India calendar day and six days before it.
    bdmr_logs = (
        db.query(WastageLog)
        .filter(
            WastageLog.date >= period_start,
            WastageLog.date <= today,
        )
        .all()
    )

    latest = (
        db.query(WastageLog)
        .filter(WastageLog.date <= today)
        .order_by(WastageLog.date.desc())
        .first()
    )

    if not latest:
        return DashboardSummary()

    avg_bdmr = None
    if bdmr_logs:
        avg_bdmr = round(
            sum(log.bdmr for log in bdmr_logs) / len(bdmr_logs),
            2,
        )

    last_updated = (
        db.query(func.max(WastageLog.entered_at))
        .filter(WastageLog.date <= today)
        .scalar()
    )

    return DashboardSummary(
        avg_bdmr=avg_bdmr,
        plain_wastage=latest.plain_wastage,
        plate_wastage=latest.plate_wastage,
        wastage_date=latest.date,
        last_updated=last_updated,
    )
