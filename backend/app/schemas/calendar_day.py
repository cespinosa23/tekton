from pydantic import BaseModel
from typing import Optional
from datetime import date

class CalendarDayCreate(BaseModel):
    date: date
    day_type: str = "Working Day"
    description: Optional[str] = None

class CalendarDayUpdate(BaseModel):
    day_type: Optional[str] = None
    description: Optional[str] = None

class CalendarDayRead(CalendarDayCreate):
    id: int
    model_config = {"from_attributes": True}