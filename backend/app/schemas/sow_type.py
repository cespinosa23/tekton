from pydantic import BaseModel
from typing import Optional

class SowTypeItemCreate(BaseModel):
    item_name: str

class SowTypeItemRead(BaseModel):
    id: int
    sow_type_id: int
    item_name: str
    model_config = {"from_attributes": True}

class SowTypeCreate(BaseModel):
    name: str

class SowTypeUpdate(BaseModel):
    name: Optional[str] = None

class SowTypeRead(BaseModel):
    id: int
    name: str
    archived: bool = False
    items: list[SowTypeItemRead] = []
    model_config = {"from_attributes": True}
