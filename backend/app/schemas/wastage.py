"""
Pydantic schemas for wastage logs and dashboard summary.
"""

from datetime import date, datetime

from pydantic import BaseModel


class WastageCreate(BaseModel):
    """Staff enters daily wastage figures."""
    date: date
    bdmr: float
    plain_wastage: float
    plate_wastage: float


class WastageResponse(BaseModel):
    id: int
    date: date
    bdmr: float
    plain_wastage: float
    plate_wastage: float
    entered_by: int
    entered_at: datetime

    model_config = {"from_attributes": True}


class DashboardSummary(BaseModel):
    """Student dashboard wastage summary."""
    avg_bdmr: float | None = None
    plain_wastage: float | None = None
    plate_wastage: float | None = None
    last_updated: datetime | None = None
