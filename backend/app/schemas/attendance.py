from datetime import date as date_type
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional

class AttendanceCreate(BaseModel):
    employee_id: int
    employee_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    is_office_based: bool = False
    date: date_type
    regular_time_in: Optional[str] = None
    regular_time_out: Optional[str] = None
    regular_hours: Optional[Decimal] = Decimal("0")
    overtime_time_in: Optional[str] = None
    overtime_time_out: Optional[str] = None
    overtime_hours: Optional[Decimal] = Decimal("0")
    overtime_multiplier: Optional[Decimal] = Decimal("1.15")
    regular_salary: Optional[Decimal] = Decimal("0")
    overtime_salary: Optional[Decimal] = Decimal("0")
    total_salary: Optional[Decimal] = Decimal("0")
    status: str = "Present"
    remarks: Optional[str] = None

class AttendanceUpdate(BaseModel):
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    is_office_based: Optional[bool] = None
    date: Optional[date_type] = None
    regular_time_in: Optional[str] = None
    regular_time_out: Optional[str] = None
    regular_hours: Optional[Decimal] = None
    overtime_time_in: Optional[str] = None
    overtime_time_out: Optional[str] = None
    overtime_hours: Optional[Decimal] = None
    overtime_multiplier: Optional[Decimal] = None
    regular_salary: Optional[Decimal] = None
    overtime_salary: Optional[Decimal] = None
    total_salary: Optional[Decimal] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

class AttendanceRead(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    is_office_based: bool = False
    date: Optional[date_type] = None
    regular_time_in: Optional[str] = None
    regular_time_out: Optional[str] = None
    regular_hours: Optional[Decimal] = None
    overtime_time_in: Optional[str] = None
    overtime_time_out: Optional[str] = None
    overtime_hours: Optional[Decimal] = None
    overtime_multiplier: Optional[Decimal] = None
    regular_salary: Optional[Decimal] = None
    overtime_salary: Optional[Decimal] = None
    total_salary: Optional[Decimal] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    archived: bool = False
    model_config = {"from_attributes": True}