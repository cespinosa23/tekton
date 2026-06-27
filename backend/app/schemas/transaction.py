from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date
from decimal import Decimal


class MaterialItem(BaseModel):
    material_id: int
    quantity: float
    unit_cost: float
    brand: Optional[str] = None
    # Preserved from frontend for display purposes
    material_name: Optional[str] = None
    material_type: Optional[str] = None
    unit: Optional[str] = None
    total_cost: Optional[float] = None
    use_fifo: Optional[bool] = None

    @field_validator("quantity", "unit_cost")
    @classmethod
    def must_be_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("must be non-negative")
        return v


class TransactionCreate(BaseModel):
    transaction_type: str
    transaction_date: date
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    is_office_expense: bool = False
    amount: Optional[Decimal] = Decimal("0")
    description: Optional[str] = None
    expenditure_category: Optional[str] = None
    supplier: Optional[str] = None
    materials: Optional[List[MaterialItem]] = None
    use_fifo_pricing: bool = False
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    adjustment_direction: Optional[str] = None

class TransactionUpdate(TransactionCreate):
    transaction_type: Optional[str] = None
    transaction_date: Optional[date] = None

class TransactionRead(TransactionCreate):
    id: int
    archived: bool = False
    archived_by: Optional[str] = None
    model_config = {"from_attributes": True}