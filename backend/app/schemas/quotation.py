from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date
from decimal import Decimal

class QuotationCreate(BaseModel):
    template_type: str = "Traditional"
    quote_number: Optional[str] = None
    status: str = "Draft"
    company_name: Optional[str] = None
    company_short_name: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_address: Optional[str] = None
    company_email: Optional[str] = None
    company_telephone_number: Optional[str] = None
    company_contact_number: Optional[str] = None
    company_pcab_license: Optional[str] = None
    company_letterhead_color: Optional[str] = None
    company_footer: Optional[str] = None
    addressee_name: Optional[str] = None
    addressee_address: Optional[str] = None
    attention_to: Optional[str] = None
    subject: Optional[str] = None
    quotation_date: Optional[date] = None
    signatory_name: Optional[str] = None
    signatory_title: Optional[str] = None
    signatory_signature_url: Optional[str] = None
    project_cost: Optional[Decimal] = Decimal("0")
    estimated_savings: Optional[Decimal] = Decimal("0")
    roi: Optional[str] = None
    system_size_kwp: Optional[Decimal] = Decimal("0")
    inverter_brand: Optional[str] = None
    battery_brand: Optional[str] = None
    panel_brand: Optional[str] = None
    scope_of_work_items: Optional[List[Any]] = None
    terms_of_payment: Optional[str] = None
    mode_of_payment: Optional[str] = None
    notes_and_exclusions: Optional[str] = None
    total_contract_cost: Optional[Decimal] = Decimal("0")

class QuotationUpdate(QuotationCreate):
    template_type: Optional[str] = None

class QuotationRead(QuotationCreate):
    id: int
    archived: bool = False
    model_config = {"from_attributes": True}