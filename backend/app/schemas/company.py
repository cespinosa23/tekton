from pydantic import BaseModel
from typing import Optional

class CompanyCreate(BaseModel):
    company_name: str
    short_name: Optional[str] = None
    logo_url: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    footer_text: Optional[str] = None
    default_signatory: Optional[str] = None
    signatory_position: Optional[str] = None
    is_active: bool = True

class CompanyUpdate(CompanyCreate):
    company_name: Optional[str] = None

class CompanyRead(CompanyCreate):
    id: int
    model_config = {"from_attributes": True}