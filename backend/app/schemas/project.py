from pydantic import BaseModel
from typing import Optional
from datetime import date

class ProjectCreate(BaseModel):
    owner_company_name: str
    address: Optional[str] = None
    project_name: str
    project_manager: Optional[str] = None
    quotation_date: Optional[date] = None
    status: str = "Active"
    referred_by: Optional[str] = None
    lgu: Optional[str] = None
    meralco_branch: Optional[str] = None
    contract_cost: Optional[float] = 0
    encumbrance: Optional[float] = 0
    other_notes: Optional[str] = None
    scope_wiring_permit: bool = False
    scope_wiring_permit_status: str = "not_included"
    scope_wiring_permit_date: Optional[date] = None
    scope_wiring_permit_notes: Optional[str] = None
    scope_electrical_plan: bool = False
    scope_electrical_plan_status: str = "not_included"
    scope_electrical_plan_date: Optional[date] = None
    scope_electrical_plan_notes: Optional[str] = None
    scope_installation: bool = False
    scope_installation_status: str = "not_included"
    scope_installation_date: Optional[date] = None
    scope_installation_notes: Optional[str] = None
    scope_cfei: bool = False
    scope_cfei_status: str = "not_included"
    scope_cfei_date: Optional[date] = None
    scope_cfei_notes: Optional[str] = None
    scope_supply: bool = False
    scope_supply_status: str = "not_included"
    scope_supply_date: Optional[date] = None
    scope_supply_notes: Optional[str] = None
    scope_meralco: bool = False
    scope_meralco_status: str = "not_included"
    scope_meralco_date: Optional[date] = None
    scope_meralco_notes: Optional[str] = None
    scope_others: bool = False
    scope_others_text: Optional[str] = None
    scope_others_status: str = "not_included"
    scope_others_date: Optional[date] = None
    scope_others_notes: Optional[str] = None

class ProjectUpdate(ProjectCreate):
    owner_company_name: Optional[str] = None
    project_name: Optional[str] = None

class ProjectRead(ProjectCreate):
    id: int
    archived: bool = False
    model_config = {"from_attributes": True}