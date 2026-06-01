from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    brand = Column(String(100), nullable=True)
    quantity = Column(Numeric(12, 2), default=0)
    latest_unit_cost = Column(Numeric(12, 2), default=0)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())
    archived = Column(Boolean, default=False)