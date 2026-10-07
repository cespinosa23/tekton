from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import date
from decimal import Decimal

CommissionType = Literal["electrical_plan", "project_management"]


class CommissionRow(BaseModel):
    """One line in the Commissions tab. `id` is None until a payee has been
    assigned or the commission released — before that it's a live
    calculation with nothing saved yet."""
    id: Optional[int] = None
    project_id: int
    project_name: str
    project_reference_id: Optional[str] = None
    project_manager: Optional[str] = None
    project_status: Optional[str] = None
    # True only for a released commission kept visible on an archived project.
    project_archived: bool = False
    commission_type: CommissionType
    rate: Decimal
    # The figure the rate applies to: Electrical Plan cost, or Project Cost
    # minus Expenses. For a released commission, the frozen value.
    base: Decimal
    amount: Decimal
    payee_employee_id: Optional[int] = None
    payee_name: Optional[str] = None
    # Set when the saved payee can't be released to as-is (e.g. the PM changed).
    payee_issue: Optional[str] = None
    is_released: bool = False
    released_date: Optional[date] = None
    released_by: Optional[str] = None


class CommissionPayeeUpdate(BaseModel):
    project_id: int
    commission_type: CommissionType
    payee_employee_id: Optional[int] = None


class CommissionRates(BaseModel):
    """Rates as percentages (5 = 5%) — what a person types and reads. Stored
    as fractions server-side."""
    electrical_plan: Decimal
    project_management: Decimal

    @field_validator("electrical_plan", "project_management")
    @classmethod
    def valid_percent(cls, v: Decimal) -> Decimal:
        if v < 0 or v > 100:
            raise ValueError("must be between 0 and 100")
        if v != v.quantize(Decimal("0.01")):
            raise ValueError("at most 2 decimal places")
        return v


class CommissionRelease(BaseModel):
    project_id: int
    commission_type: CommissionType
    release_date: Optional[date] = None
