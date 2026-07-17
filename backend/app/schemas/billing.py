from pydantic import BaseModel
from typing import Optional
from datetime import date

class BillingCreate(BaseModel):
    project_id: int
    billing_type: str
    billing_date: date
    notes: Optional[str] = None
    dp_amount: Optional[float] = 0
    retention_amount: Optional[float] = 0
    scope_description: Optional[str] = None
    current_percentage: Optional[float] = None

class BillingRead(BaseModel):
    id: int
    project_id: int
    billing_type: str
    sequence_number: int
    billing_date: date
    current_percentage: Optional[float] = None
    previous_percentage: Optional[float] = None
    dp_amount: Optional[float] = None
    retention_amount: Optional[float] = None
    scope_description: Optional[str] = None
    amount: float
    notes: Optional[str] = None
    is_paid: bool = False
    paid_date: Optional[date] = None
    archived: bool = False
    archived_by: Optional[str] = None
    model_config = {"from_attributes": True}

class BillingPaidUpdate(BaseModel):
    is_paid: bool
    paid_date: Optional[date] = None
