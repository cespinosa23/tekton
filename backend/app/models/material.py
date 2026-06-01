from sqlalchemy import Column, Integer, String, Boolean
from app.db.database import Base

class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    rating_size = Column(String(255), nullable=False)
    brand = Column(String(100), nullable=True)
    material_type = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=False)
    description = Column(String(500), nullable=True)
    archived = Column(Boolean, default=False)
    