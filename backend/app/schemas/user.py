"""
Pydantic schemas for user-related responses.
"""

from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: int
    identifier: str
    email: str | None
    role: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
