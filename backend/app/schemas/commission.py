from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import date
from decimal import Decimal

CommissionType = Literal["electrical_plan", "project_management"]
# Project Management only:
#   assumed_margin = Project Cost x margin % x rate
#   actual         = (Project Cost - actual expenses) x rate
CommissionMethod = Literal["assumed_margin", "actual"]


def _valid_percent(v: Optional[Decimal]) -> Optional[Decimal]:
    if v is None:
        return v
    if v < 0 or v > 100:
        raise ValueError("must be between 0 and 100")
    if v != v.quantize(Decimal("0.01")):
        raise ValueError("at most 2 decimal places")
    return v


class CommissionRow(BaseModel):
    """One line in the Commissions tab. `id` is None until a payee or terms
    have been set or the commission released — before that it's a live
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
    # Effective terms (rates as fractions). method/margin_rate are None for
    # Electrical Plan, and margin_rate is None for the actual method.
    method: Optional[CommissionMethod] = None
    rate: Decimal
    margin_rate: Optional[Decimal] = None
    # True when this record has its own terms instead of following the defaults.
    custom_terms: bool = False
    # The figure the rate applies to: Electrical Plan cost, Project Cost x
    # margin, or Project Cost minus expenses. For a released commission, the
    # frozen value.
    base: Decimal
    amount: Decimal
    # Live inputs behind `base` (unreleased only), so the page can show the
    # working: project cost, and for the actual method the expense breakdown.
    project_cost: Optional[Decimal] = None
    expenses_materials: Optional[Decimal] = None
    expenses_other: Optional[Decimal] = None
    expenses_labor: Optional[Decimal] = None
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


class CommissionTermsUpdate(BaseModel):
    """A record's own terms, rates as percentages (7 = 7%). All None = follow
    the defaults again. method and margin are ignored for Electrical Plan."""
    project_id: int
    commission_type: CommissionType
    method: Optional[CommissionMethod] = None
    rate: Optional[Decimal] = None
    margin_rate: Optional[Decimal] = None

    @field_validator("rate", "margin_rate")
    @classmethod
    def valid_percent(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _valid_percent(v)


class CommissionRates(BaseModel):
    """Default terms, rates as percentages (5 = 5%) — what a person types and
    reads. Stored as fractions server-side."""
    electrical_plan: Decimal
    project_management: Decimal
    project_management_margin: Decimal
    project_management_method: CommissionMethod

    @field_validator("electrical_plan", "project_management", "project_management_margin")
    @classmethod
    def valid_percent(cls, v: Decimal) -> Decimal:
        return _valid_percent(v)


class CommissionRelease(BaseModel):
    project_id: int
    commission_type: CommissionType
    release_date: Optional[date] = None
