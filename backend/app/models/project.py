from sqlalchemy import Column, Integer, String, Boolean, Date, Numeric, ForeignKey, Text
from app.db.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    # Set once, at creation, by the Quotation -> Project handoff — lets
    # Quotations know a project already exists for a given quote.
    source_quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    owner_company_name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=True)  # deprecated: superseded by address_line1/2, city, etc. Kept as fallback until re-entered.
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state_province = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True, default='Philippines')
    project_name = Column(String(255), nullable=False)
    project_manager = Column(String(100), nullable=True)
    quotation_date = Column(Date, nullable=True)
    status = Column(String(50), default="Active")
    archived = Column(Boolean, default=False)
    archived_by = Column(String(255), nullable=True)
    referred_by = Column(String(100), nullable=True)
    lgu = Column(String(100), nullable=True)
    meralco_branch = Column(String(100), nullable=True)
    contract_cost = Column(Numeric(12, 2), default=0)
    encumbrance = Column(Numeric(12, 2), default=0)
    other_notes = Column(Text, nullable=True)

    # Scope fields
    scope_wiring_permit = Column(Boolean, default=False)
    scope_wiring_permit_status = Column(String(50), default="not_included")
    scope_wiring_permit_date = Column(Date, nullable=True)
    scope_wiring_permit_notes = Column(String(500), nullable=True)

    scope_electrical_plan = Column(Boolean, default=False)
    scope_electrical_plan_status = Column(String(50), default="not_included")
    scope_electrical_plan_date = Column(Date, nullable=True)
    scope_electrical_plan_notes = Column(String(500), nullable=True)

    scope_installation = Column(Boolean, default=False)
    scope_installation_status = Column(String(50), default="not_included")
    scope_installation_date = Column(Date, nullable=True)
    scope_installation_notes = Column(String(500), nullable=True)

    scope_cfei = Column(Boolean, default=False)
    scope_cfei_status = Column(String(50), default="not_included")
    scope_cfei_date = Column(Date, nullable=True)
    scope_cfei_notes = Column(String(500), nullable=True)

    scope_supply = Column(Boolean, default=False)
    scope_supply_status = Column(String(50), default="not_included")
    scope_supply_date = Column(Date, nullable=True)
    scope_supply_notes = Column(String(500), nullable=True)

    scope_meralco = Column(Boolean, default=False)
    scope_meralco_status = Column(String(50), default="not_included")
    scope_meralco_date = Column(Date, nullable=True)
    scope_meralco_notes = Column(String(500), nullable=True)

    scope_others = Column(Boolean, default=False)
    scope_others_text = Column(String(500), nullable=True)
    scope_others_status = Column(String(50), default="not_included")
    scope_others_date = Column(Date, nullable=True)
    scope_others_notes = Column(String(500), nullable=True)

    # Per-scope contract costs (encumbrance reuses the existing encumbrance column)
    scope_encumbrance = Column(Boolean, default=False)
    scope_wiring_permit_cost = Column(Numeric(12, 2), default=0)
    scope_electrical_plan_cost = Column(Numeric(12, 2), default=0)
    scope_installation_cost = Column(Numeric(12, 2), default=0)
    scope_supply_cost = Column(Numeric(12, 2), default=0)
    scope_meralco_cost = Column(Numeric(12, 2), default=0)
    scope_others_cost = Column(Numeric(12, 2), default=0)