"""
Pydantic schemas for weekly menu endpoints.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class MenuSlot(BaseModel):
    """One cell of the 7×3 menu grid."""
    day_of_week: int = Field(..., ge=0, le=6)
    meal_type: str  # "breakfast" | "lunch" | "dinner"
    description: str

    model_config = {"from_attributes": True}


class MenuSlotUpdate(BaseModel):
    """Update the description for one menu slot."""
    description: str = Field(..., min_length=0, max_length=1000)


class MenuSlotResponse(BaseModel):
    id: int
    day_of_week: int
    meal_type: str
    description: str
    updated_by: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class WeeklyMenuResponse(BaseModel):
    """Full weekly menu — list of all slots."""
    slots: list[MenuSlotResponse]
