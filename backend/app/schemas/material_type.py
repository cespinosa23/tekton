from pydantic import BaseModel
from typing import Optional

class MaterialTypeBrandCreate(BaseModel):
    brand_name: str

class MaterialTypeBrandRead(BaseModel):
    id: int
    material_type_id: int
    brand_name: str
    model_config = {"from_attributes": True}

class MaterialTypeCreate(BaseModel):
    name: str

class MaterialTypeUpdate(BaseModel):
    name: Optional[str] = None

class MaterialTypeRead(BaseModel):
    id: int
    name: str
    archived: bool = False
    brands: list[MaterialTypeBrandRead] = []
    model_config = {"from_attributes": True}