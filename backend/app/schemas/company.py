from pydantic import BaseModel
from typing import Optional

class CompanyCreate(BaseModel):
    company_name: str
    short_name: Optional[str] = None
    logo_url: Optional[str] = None
    address: Optional[str] = None  # deprecated: superseded by address_line1/2, city, etc.
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "Philippines"
    contact_number: Optional[str] = None
    telephone_number: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    footer_text: Optional[str] = None
    default_signatory: Optional[str] = None
    signatory_position: Optional[str] = None
    pcab_license: Optional[str] = None
    signature_url: Optional[str] = None
    letterhead_color: Optional[str] = None
    payment_method: Optional[str] = None
    is_active: bool = True

class CompanyUpdate(CompanyCreate):
    company_name: Optional[str] = None

class CompanyRead(CompanyCreate):
    id: int
    model_config = {"from_attributes": True}