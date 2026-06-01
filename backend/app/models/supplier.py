from sqlalchemy import Column, Integer, String, Boolean
from app.db.database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=True)
    contact_person = Column(String(100), nullable=True)
    contact_number = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    archived = Column(Boolean, default=False)