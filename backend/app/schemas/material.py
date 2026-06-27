from pydantic import BaseModel
from typing import Optional

class MaterialCreate(BaseModel):
    rating_size: str
    brand: Optional[str] = None
    material_type: Optional[str] = None
    unit: str
    description: Optional[str] = None

class MaterialUpdate(MaterialCreate):
    rating_size: Optional[str] = None
    unit: Optional[str] = None

class MaterialRead(MaterialCreate):
    id: int
    archived: bool = False
    archived_by: Optional[str] = None
    model_config = {"from_attributes": True}