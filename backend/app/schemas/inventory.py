from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime

class InventoryCreate(BaseModel):
    material_id: int
    brand: Optional[str] = None
    quantity: Optional[Decimal] = Decimal("0")
    latest_unit_cost: Optional[Decimal] = Decimal("0")

class InventoryUpdate(InventoryCreate):
    material_id: Optional[int] = None

class InventoryRead(BaseModel):
    id: int
    material_id: int
    brand: Optional[str] = None
    quantity: Optional[Decimal] = None
    latest_unit_cost: Optional[Decimal] = None
    last_updated: Optional[datetime] = None
    archived: bool = False
    model_config = {"from_attributes": True}