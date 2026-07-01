"""
Pydantic schemas for notices.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class NoticeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    link: str | None = Field(None, max_length=500)


class NoticeResponse(BaseModel):
    id: int
    title: str
    description: str
    link: str | None
    created_at: datetime
    created_by: int

    model_config = {"from_attributes": True}
