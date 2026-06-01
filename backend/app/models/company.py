from sqlalchemy import Column, Integer, String, Boolean
from app.db.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    short_name = Column(String(100), nullable=True)
    logo_url = Column(String(500), nullable=True)
    address = Column(String(255), nullable=True)
    contact_number = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    footer_text = Column(String(500), nullable=True)
    default_signatory = Column(String(100), nullable=True)
    signatory_position = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)