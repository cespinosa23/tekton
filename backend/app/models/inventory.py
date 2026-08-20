from sqlalchemy import Column, Integer, String, Boolean, Date, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    brand = Column(String(100), nullable=True)
    quantity = Column(Numeric(12, 2), default=0)
    latest_unit_cost = Column(Numeric(12, 2), default=0)
    # Supplier + transaction date of whichever procurement entry set latest_unit_cost
    # (the max of the last 5 procurement costs) — lets callers (e.g. Quotation BOM)
    # show where that price came from and when, not just the number itself.
    latest_cost_supplier = Column(String(255), nullable=True)
    latest_cost_date = Column(Date, nullable=True)
    # True when latest_unit_cost came from a Canvass entry (a market price check,
    # not an actual purchase) rather than real Materials Procurement — callers
    # showing this price should flag it as unverified/not-yet-paid.
    latest_cost_is_canvass = Column(Boolean, default=False)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())
    archived = Column(Boolean, default=False)