from pydantic import BaseModel
from datetime import date
from decimal import Decimal
from typing import Optional
from app.models.employee import EmployeeStatus

class EmployeeCreate(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    date_hired: Optional[date] = None
    daily_salary: Optional[Decimal] = Decimal("0")
    sss_number: Optional[str] = None
    philhealth_number: Optional[str] = None
    pagibig_number: Optional[str] = None
    tin_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    status: EmployeeStatus = EmployeeStatus.Active
    email: Optional[str] = None

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_hired: Optional[date] = None
    daily_salary: Optional[Decimal] = None
    sss_number: Optional[str] = None
    philhealth_number: Optional[str] = None
    pagibig_number: Optional[str] = None
    tin_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    email: Optional[str] = None

class EmployeeRead(BaseModel):
    id: int
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    date_hired: Optional[date] = None
    daily_salary: Optional[Decimal] = None
    sss_number: Optional[str] = None
    philhealth_number: Optional[str] = None
    pagibig_number: Optional[str] = None
    tin_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    status: EmployeeStatus
    email: Optional[str] = None
    archived: bool

    model_config = {"from_attributes": True}