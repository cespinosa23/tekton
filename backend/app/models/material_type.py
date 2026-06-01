from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class MaterialType(Base):
    __tablename__ = "material_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    archived = Column(Boolean, default=False)
    brands = relationship("MaterialTypeBrand", back_populates="material_type", cascade="all, delete-orphan")

class MaterialTypeBrand(Base):
    __tablename__ = "material_type_brands"

    id = Column(Integer, primary_key=True, index=True)
    material_type_id = Column(Integer, ForeignKey("material_types.id"), nullable=False)
    brand_name = Column(String(100), nullable=False)
    material_type = relationship("MaterialType", back_populates="brands")