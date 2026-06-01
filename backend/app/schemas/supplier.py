from pydantic import BaseModel
from typing import Optional

class SupplierCreate(BaseModel):
    name: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    is_active: bool = True

class SupplierUpdate(SupplierCreate):
    name: Optional[str] = None

class SupplierRead(SupplierCreate):
    id: int
    archived: bool = False
    model_config = {"from_attributes": True}