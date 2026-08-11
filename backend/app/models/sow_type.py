from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.database import Base

class SowType(Base):
    __tablename__ = "sow_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    archived = Column(Boolean, default=False)
    items = relationship("SowTypeItem", back_populates="sow_type", cascade="all, delete-orphan")

class SowTypeItem(Base):
    __tablename__ = "sow_type_items"

    id = Column(Integer, primary_key=True, index=True)
    sow_type_id = Column(Integer, ForeignKey("sow_types.id"), nullable=False)
    item_name = Column(Text, nullable=False)
    sow_type = relationship("SowType", back_populates="items")
