from sqlalchemy import Column, Integer, String, Text, Boolean
from app.db.database import Base

class QuotationTemplateItem(Base):
    __tablename__ = "quotation_template_items"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)  # 'other_note' | 'payment_term'
    text = Column(Text, nullable=False)
    archived = Column(Boolean, default=False)
