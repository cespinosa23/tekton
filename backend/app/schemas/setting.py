from pydantic import BaseModel
from typing import Optional

class SettingCreate(BaseModel):
    category: str
    value: str
    is_active: bool = True

class SettingUpdate(SettingCreate):
    category: Optional[str] = None
    value: Optional[str] = None

class SettingRead(SettingCreate):
    id: int
    archived: bool = False
    model_config = {"from_attributes": True}