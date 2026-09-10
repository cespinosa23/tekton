from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from app.db.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    short_name = Column(String(100), nullable=True)
    logo_url = Column(MEDIUMTEXT, nullable=True)
    address = Column(String(255), nullable=True)  # deprecated: superseded by address_line1/2, city, etc. Kept as fallback until re-entered.
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state_province = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True, default='Philippines')
    contact_number = Column(String(255), nullable=True)
    telephone_number = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    footer_text = Column(String(500), nullable=True)
    default_signatory = Column(String(100), nullable=True)
    signatory_position = Column(String(100), nullable=True)
    pcab_license = Column(String(100), nullable=True)
    signature_url = Column(MEDIUMTEXT, nullable=True)
    letterhead_color = Column(String(20), nullable=True)
    payment_method = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)