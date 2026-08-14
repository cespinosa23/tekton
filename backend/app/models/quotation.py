from sqlalchemy import Column, Integer, String, Boolean, Date, Numeric, JSON, Text
from app.db.database import Base

class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(100), nullable=True)
    status = Column(String(50), default="Draft")
    template_type = Column(String(50), default="Traditional")
    company_name = Column(String(255), nullable=True)
    company_logo_url = Column(Text, nullable=True)  # base64 data-URI, same as Company.logo_url
    company_address = Column(String(255), nullable=True)
    company_contact = Column(String(100), nullable=True)
    company_footer = Column(String(500), nullable=True)
    addressee_name = Column(String(255), nullable=True)
    addressee_address = Column(String(255), nullable=True)
    attention_to = Column(String(255), nullable=True)
    subject = Column(String(500), nullable=True)
    quotation_date = Column(Date, nullable=True)
    signatory_name = Column(String(100), nullable=True)
    signatory_title = Column(String(100), nullable=True)
    project_cost = Column(Numeric(12, 2), default=0)
    estimated_savings = Column(Numeric(12, 2), default=0)
    roi = Column(String(100), nullable=True)
    system_size_kwp = Column(Numeric(10, 2), default=0)
    inverter_brand = Column(String(100), nullable=True)
    battery_brand = Column(String(100), nullable=True)
    panel_brand = Column(String(100), nullable=True)
    # Each entry: { sow_type_id, sow_type_name, sub_items: [...], costing: {...}, bom_items: [...] }
    # costing and bom_items are both per scope type, not shared across the whole quotation.
    scope_of_work_items = Column(JSON, nullable=True)

    terms_of_payment = Column(String(2000), nullable=True)
    other_scope_costs = Column(JSON, nullable=True)
    mode_of_payment = Column(String(255), nullable=True)
    # Rich-text HTML from RichTextEditor (bold/italic/lists only, sanitized on the frontend)
    notes_and_exclusions = Column(Text, nullable=True)
    total_contract_cost = Column(Numeric(12, 2), default=0)
    archived = Column(Boolean, default=False)